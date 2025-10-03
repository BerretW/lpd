# app/services/timesheet_service.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from datetime import datetime
from app.db.models import TimeLog, Task, WorkOrder # <-- Nové importy
from app.schemas.time_log import TimeLogCreateIn

async def upsert_timelog(db: AsyncSession, user_id: int, company_id: int, new_log_data: TimeLogCreateIn) -> TimeLog:
    """
    Vloží nebo aktualizuje časový záznam. Pokud je potřeba, nejprve vytvoří nový úkol.
    Poté automaticky vyřeší překryvy s existujícími záznamy.
    """
    task_id = new_log_data.task_id

    # --- KROK 1: Zajisti existenci úkolu ---
    if new_log_data.new_task:
        # Ověříme, že zakázka patří dané firmě
        work_order_id = new_log_data.new_task.work_order_id
        stmt_wo = select(WorkOrder).where(WorkOrder.id == work_order_id, WorkOrder.company_id == company_id)
        if not (await db.execute(stmt_wo)).scalar_one_or_none():
            raise ValueError(f"Work order with id {work_order_id} not found in this company.")

        # Vytvoříme nový úkol
        new_task = Task(
            name=new_log_data.new_task.name,
            work_order_id=work_order_id,
            assignee_id=user_id # Automaticky přiřadíme úkol tomu, kdo loguje čas
        )
        db.add(new_task)
        await db.flush()
        task_id = new_task.id
    
    if task_id is None:
        raise ValueError("Task ID could not be determined.")

    new_start = new_log_data.start_time
    new_end = new_log_data.end_time
    
    if new_start >= new_end:
        raise ValueError("Start time must be before end time.")

    # --- KROK 2: Vyřeš překryvy (logika zůstává stejná) ---
    stmt = select(TimeLog).where(
        and_(
            TimeLog.user_id == user_id,
            TimeLog.start_time < new_end,
            TimeLog.end_time > new_start
        )
    )
    overlapping_logs = (await db.execute(stmt)).scalars().all()

    for log in overlapping_logs:
        if log.start_time >= new_start and log.end_time <= new_end:
            await db.delete(log)
            continue
        
        if log.start_time < new_start < log.end_time:
            log.end_time = new_start
            
        if log.end_time > new_end > log.start_time:
            log.start_time = new_end

        if log.start_time >= log.end_time:
            await db.delete(log)
            
    # --- KROK 3: Vytvoř nový záznam času ---
    new_log = TimeLog(
        task_id=task_id,
        user_id=user_id,
        work_type_id=new_log_data.work_type_id,
        start_time=new_log_data.start_time,
        end_time=new_log_data.end_time,
        notes=new_log_data.notes,
        break_duration_minutes=new_log_data.break_duration_minutes,
        is_overtime=new_log_data.is_overtime,
    )
    db.add(new_log)
    
    await db.flush()
    return new_log