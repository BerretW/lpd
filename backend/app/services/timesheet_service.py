# backend/app/services/timesheet_service.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone
from app.db.models import TimeLog, Task, WorkOrder, TimeLogEntryType
from app.schemas.time_log import TimeLogCreateIn

def ensure_utc(dt: datetime) -> datetime:
    """Pomocná funkce, která zajistí, že datetime je 'aware' a v UTC."""
    if dt.tzinfo is None:
        # Pokud je 'naive', předpokládáme, že je to UTC a přidáme zónu
        return dt.replace(tzinfo=timezone.utc)
    # Pokud je 'aware', převedeme ho na UTC
    return dt.astimezone(timezone.utc)

async def upsert_timelog(db: AsyncSession, user_id: int, company_id: int, new_log_data: TimeLogCreateIn) -> TimeLog:
    """
    Vloží nebo aktualizuje časový záznam, inteligentně řeší překryvy
    a defenzivně pracuje s časovými zónami.
    """
    
    # 1. Validace časů
    new_start = ensure_utc(new_log_data.start_time)
    new_end = ensure_utc(new_log_data.end_time)
    
    if new_start >= new_end:
        raise ValueError("Start time must be before end time.")

    # Validace pauzy (aby nebyla delší než samotná práce)
    duration_minutes = (new_end - new_start).total_seconds() / 60
    if new_log_data.break_duration_minutes >= duration_minutes:
        raise ValueError("Break duration cannot be longer than the work duration.")

    # 2. Získání nebo vytvoření task_id
    task_id = None
    if new_log_data.entry_type == TimeLogEntryType.WORK:
        # A) Vytvoření nového úkolu "on-the-fly"
        if new_log_data.new_task:
            work_order_id = new_log_data.new_task.work_order_id
            # Kontrola, zda WorkOrder patří firmě
            stmt_wo = select(WorkOrder).where(WorkOrder.id == work_order_id, WorkOrder.company_id == company_id)
            if not (await db.execute(stmt_wo)).scalar_one_or_none():
                raise ValueError(f"Work order with id {work_order_id} not found in this company.")
            
            new_task = Task(name=new_log_data.new_task.name, work_order_id=work_order_id, assignee_id=user_id)
            db.add(new_task)
            await db.flush() # Potřebujeme ID hned
            task_id = new_task.id
        
        # B) Použití existujícího task_id
        else:
            task_id = new_log_data.task_id
            if task_id:
                # --- BEZPEČNOSTNÍ KONTROLA ---
                # Ověříme, že task patří do WorkOrderu, který patří naší Company
                stmt_check = (
                    select(Task.id)
                    .join(WorkOrder)
                    .where(Task.id == task_id, WorkOrder.company_id == company_id)
                )
                if not (await db.execute(stmt_check)).scalar_one_or_none():
                    raise ValueError(f"Task {task_id} does not belong to company {company_id}.")

        if task_id is None:
            raise ValueError("Task ID could not be determined for a 'WORK' entry.")

    # 3. Řešení překryvů (Overlaps)
    # Najdeme všechny logy uživatele, které se jakkoliv dotýkají nového intervalu
    stmt = select(TimeLog).where(
        and_(
            TimeLog.user_id == user_id, 
            TimeLog.start_time < new_end, 
            TimeLog.end_time > new_start
        )
    )
    overlapping_logs = (await db.execute(stmt)).scalars().all()
    
    for log in overlapping_logs:
        # Převedeme DB časy na UTC aware pro bezpečné porovnání
        log_start = ensure_utc(log.start_time)
        log_end = ensure_utc(log.end_time)

        # Scénář A: Nový log je UVNITŘ starého (Starý: 8-12, Nový: 9-10) -> Rozdělit starý
        if log_start < new_start and log_end > new_end:
            # Vytvoříme druhou část starého logu (10-12)
            second_part = TimeLog(
                company_id=log.company_id, 
                user_id=log.user_id, 
                entry_type=log.entry_type,
                task_id=log.task_id, 
                work_type_id=log.work_type_id,
                start_time=new_end, 
                end_time=log_end,
                is_overtime=log.is_overtime, 
                notes=log.notes, 
                status=log.status,
                # break_duration_minutes nepřenášíme, zůstává v první části, nebo bychom ho museli dělit
                break_duration_minutes=0 
            )
            db.add(second_part)
            
            # První část zkrátíme (8-9)
            log.end_time = new_start
            continue

        # Scénář B: Nový log zcela PŘEKRÝVÁ starý (Starý: 9-10, Nový: 8-11) -> Smazat starý
        if log_start >= new_start and log_end <= new_end:
            await db.delete(log)
            continue
        
        # Scénář C: Překryv zprava (Starý: 8-10, Nový: 9-11) -> Zkrátit starý na 8-9
        if log_start < new_start < log_end:
            log.end_time = new_start
            
        # Scénář D: Překryv zleva (Starý: 9-11, Nový: 8-10) -> Posunout začátek starého na 10-11
        if log_end > new_end > log_start:
            log.start_time = new_end

        # Pojistka: Pokud by úpravou vznikl nulový nebo záporný čas, smažeme ho
        if log.start_time >= log.end_time:
            await db.delete(log)
            
    # 4. Vytvoření nového záznamu
    new_log = TimeLog(
        company_id=company_id, 
        user_id=user_id,
        entry_type=new_log_data.entry_type, 
        task_id=task_id, 
        work_type_id=new_log_data.work_type_id,
        start_time=new_start, 
        end_time=new_end,
        notes=new_log_data.notes, 
        break_duration_minutes=new_log_data.break_duration_minutes,
        is_overtime=new_log_data.is_overtime
    )
    db.add(new_log)
    
    await db.flush()
    return new_log