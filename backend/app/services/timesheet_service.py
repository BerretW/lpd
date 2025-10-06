# backend/app/services/timesheet_service.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
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
    task_id = None
    if new_log_data.entry_type == TimeLogEntryType.WORK:
        # ... (logika pro zjištění task_id zůstává stejná) ...
        task_id = new_log_data.task_id
        if new_log_data.new_task:
            work_order_id = new_log_data.new_task.work_order_id
            stmt_wo = select(WorkOrder).where(WorkOrder.id == work_order_id, WorkOrder.company_id == company_id)
            if not (await db.execute(stmt_wo)).scalar_one_or_none():
                raise ValueError(f"Work order with id {work_order_id} not found in this company.")
            new_task = Task(name=new_log_data.new_task.name, work_order_id=work_order_id, assignee_id=user_id)
            db.add(new_task)
            await db.flush()
            task_id = new_task.id
        if task_id is None:
            raise ValueError("Task ID could not be determined for a 'WORK' entry.")

    # --- DEFenzivní sjednocení časových zón ---
    new_start = ensure_utc(new_log_data.start_time)
    new_end = ensure_utc(new_log_data.end_time)
    
    if new_start >= new_end:
        raise ValueError("Start time must be before end time.")

    # --- Krok 2: Najde a zpracuje překryvy ---
    stmt = select(TimeLog).where(and_(TimeLog.user_id == user_id, TimeLog.start_time < new_end, TimeLog.end_time > new_start))
    overlapping_logs = (await db.execute(stmt)).scalars().all()
    
    for log in overlapping_logs:
        # --- DEFenzivní porovnání ---
        log_start = ensure_utc(log.start_time)
        log_end = ensure_utc(log.end_time)

        if log_start < new_start and log_end > new_end:
            second_part = TimeLog(
                company_id=log.company_id, user_id=log.user_id, entry_type=log.entry_type,
                task_id=log.task_id, work_type_id=log.work_type_id,
                start_time=new_end, end_time=log_end, # Používáme již převedené časy
                is_overtime=log.is_overtime, notes=log.notes, status=log.status
            )
            db.add(second_part)
            log.end_time = new_start
            continue

        if log_start >= new_start and log_end <= new_end:
            await db.delete(log)
            continue
        
        if log_start < new_start < log_end:
            log.end_time = new_start
            
        if log_end > new_end > log_start:
            log.start_time = new_end

        if log.start_time >= log.end_time:
            await db.delete(log)
            
    # --- Krok 3: Vytvoření nového hlavního záznamu ---
    new_log = TimeLog(
        company_id=company_id, user_id=user_id,
        entry_type=new_log_data.entry_type, task_id=task_id, work_type_id=new_log_data.work_type_id,
        start_time=new_start, end_time=new_end,
        notes=new_log_data.notes, break_duration_minutes=new_log_data.break_duration_minutes,
        is_overtime=new_log_data.is_overtime
    )
    db.add(new_log)
    
    await db.flush()
    return new_log