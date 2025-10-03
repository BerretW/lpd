from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from datetime import date

from app.db.database import get_db
from app.db.models import TimeLog, Task, WorkOrder, TimeLogStatus, UsedInventoryItem
from app.schemas.time_log import TimeLogCreateIn, TimeLogOut, TimeLogUpdateIn, TimeLogStatusUpdateIn
from app.routers.members import require_admin_access
from app.core.dependencies import require_company_access
from app.services.timesheet_service import upsert_timelog

from app.schemas.time_log import ServiceReportDataOut
from app.schemas.work_order import WorkOrderOut
from app.schemas.task import TaskOut

router = APIRouter(prefix="/companies/{company_id}/time-logs", tags=["time-logs"])

async def get_log_or_404(time_log_id: int, company_id: int, db: AsyncSession) -> TimeLog:
    """Načte záznam času s plnými detaily. Zvládá i záznamy bez úkolu (např. dovolená)."""
    stmt = (
        select(TimeLog)
        # Primární a spolehlivé filtrování přímo na hlavní tabulce
        .where(TimeLog.id == time_log_id, TimeLog.company_id == company_id)
        # Použití outerjoin pro volitelné vztahy
        .outerjoin(TimeLog.task)
        .options(
            selectinload(TimeLog.user),
            selectinload(TimeLog.work_type),
            selectinload(TimeLog.task)
        )
    )
    log = (await db.execute(stmt)).scalar_one_or_none()
    if not log:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Time log not found")
    return log

@router.post("", response_model=TimeLogOut, status_code=status.HTTP_201_CREATED)
async def create_time_log(
    company_id: int, payload: TimeLogCreateIn,
    db: AsyncSession = Depends(get_db), token: Dict[str, Any] = Depends(require_company_access)
):
    """Vytvoří nový záznam o čase. Může při tom i vytvořit nový úkol."""
    user_id = int(token.get("sub"))
    try:
        new_log = await upsert_timelog(db, user_id, company_id, payload)
        await db.commit()
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e))
    
    return await get_log_or_404(new_log.id, company_id, db)

@router.get("", response_model=List[TimeLogOut])
async def list_time_logs(
    company_id: int, work_date: date, user_id_filter: int | None = None,
    db: AsyncSession = Depends(get_db), token: Dict[str, Any] = Depends(require_company_access)
):
    """Získá seznam záznamů času pro konkrétní den (včetně absencí)."""
    current_user_id = int(token.get("sub"))
    target_user_id = user_id_filter if user_id_filter else current_user_id
    
    # TODO: Ověřit, že admin může vidět ostatní
    
    stmt = (
        select(TimeLog)
        # Primární filtrování
        .where(
            TimeLog.company_id == company_id, 
            TimeLog.user_id == target_user_id, 
            func.date(TimeLog.start_time) == work_date
        )
        .outerjoin(TimeLog.task)
        .options(
            selectinload(TimeLog.user),
            selectinload(TimeLog.work_type),
            selectinload(TimeLog.task)
        )
        .order_by(TimeLog.start_time)
    )
    return (await db.execute(stmt)).scalars().all()

@router.patch("/{time_log_id}", response_model=TimeLogOut)
async def update_time_log(
    company_id: int, time_log_id: int, payload: TimeLogUpdateIn,
    db: AsyncSession = Depends(get_db), token: Dict[str, Any] = Depends(require_company_access)
):
    """Upraví existující záznam."""
    log_to_update = await get_log_or_404(time_log_id, company_id, db)
    user_id = int(token.get("sub"))

    if log_to_update.user_id != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only edit your own time logs.")
    if log_to_update.status != TimeLogStatus.pending:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot edit a log that has already been processed.")
    
    await db.delete(log_to_update)
    await db.flush()

    try:
        create_payload = TimeLogCreateIn(**payload.dict())
        updated_log = await upsert_timelog(db, user_id, company_id, create_payload)
        await db.commit()
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e))
        
    return await get_log_or_404(updated_log.id, company_id, db)

@router.post("/{time_log_id}/status", response_model=TimeLogOut, summary="Schválení/zamítnutí záznamu (pro adminy)")
async def update_time_log_status(
    company_id: int, time_log_id: int, payload: TimeLogStatusUpdateIn,
    db: AsyncSession = Depends(get_db), _=Depends(require_admin_access)
):
    """Změní stav záznamu (schváleno/zamítnuto)."""
    log = await get_log_or_404(time_log_id, company_id, db)
    log.status = payload.status
    await db.commit()
    # Po změně statusu znovu načteme s plnými detaily
    return await get_log_or_404(time_log_id, company_id, db)

@router.delete("/{time_log_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Smazání záznamu času")
async def delete_time_log(
    company_id: int, time_log_id: int,
    db: AsyncSession = Depends(get_db), token: Dict[str, Any] = Depends(require_company_access)
):
    """Umožní uživateli smazat svůj vlastní neschválený záznam."""
    log = await get_log_or_404(time_log_id, company_id, db)
    current_user_id = int(token.get("sub"))

    if log.user_id != current_user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only delete your own time logs.")
    if log.status != TimeLogStatus.pending:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot delete a log that has already been processed.")

    await db.delete(log)
    await db.commit()

@router.get(
    "/{time_log_id}/service-report-data",
    response_model=ServiceReportDataOut,
    summary="Získání dat pro servisní list z jednoho záznamu docházky"
)
async def get_service_report_data(
    company_id: int,
    time_log_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access)
):
    """
    Na základě ID jednoho záznamu docházky (`time_log_id`) najde související
    úkol a zakázku a vrátí jejich kompletní detaily.
    
    Tento endpoint je ideální pro rychlé načtení celého kontextu práce
    pro zobrazení např. v mobilní aplikaci technika nebo pro generování
    servisního/montážního listu.
    """
    # 1. Načteme TimeLog a ověříme jeho existenci a příslušnost k firmě
    log = await get_log_or_404(time_log_id, company_id, db)

    # 2. Zjistíme, zda má záznam přiřazený úkol
    if not log.task or not log.task.work_order_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This time log is not associated with a specific task or work order (e.g., vacation)."
        )

    # 3. Načteme plné detaily úkolu a zakázky pomocí jejich ID
    # Použijeme pomocné funkce z jejich vlastních routerů, pokud je máme,
    # nebo si je zde znovu načteme s plnými detaily.
    
    # Načtení plného detailu úkolu
    task_stmt = (
        select(Task)
        .where(Task.id == log.task_id)
        .options(
            selectinload(Task.assignee),
            selectinload(Task.used_items).selectinload(UsedInventoryItem.inventory_item)
        )
    )
    full_task = (await db.execute(task_stmt)).scalar_one_or_none()

    # Načtení plného detailu zakázky
    work_order_stmt = (
        select(WorkOrder)
        .where(WorkOrder.id == log.task.work_order_id)
        .options(
            selectinload(WorkOrder.tasks),
            selectinload(WorkOrder.client)
        )
    )
    full_work_order = (await db.execute(work_order_stmt)).scalar_one_or_none()
    
    if not full_task or not full_work_order:
         raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Could not retrieve full task or work order details.")

    # 4. Sestavíme a vrátíme finální objekt
    return ServiceReportDataOut(
        work_order=full_work_order,
        task=full_task
    )