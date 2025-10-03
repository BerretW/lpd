# backend/app/routers/work_orders.py
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from datetime import date

from app.db.database import get_db
from app.db.models import WorkOrder, Task, TimeLog, UsedInventoryItem, TimeLogEntryType
from app.schemas.work_order import (
    WorkOrderCreateIn, WorkOrderOut, WorkOrderUpdateIn, WorkOrderStatusUpdateIn,
    BillingReportOut, BillingReportTimeLogOut, BillingReportUsedItemOut
)
from app.core.dependencies import require_company_access, require_admin_access

router = APIRouter(prefix="/companies/{company_id}/work-orders", tags=["work-orders"])

async def get_full_work_order_or_404(company_id: int, work_order_id: int, db: AsyncSession) -> WorkOrder:
    """Vždy načte zakázku se všemi potřebnými vztahy."""
    stmt = (
        select(WorkOrder)
        .where(WorkOrder.id == work_order_id, WorkOrder.company_id == company_id)
        .options(selectinload(WorkOrder.tasks), selectinload(WorkOrder.client))
    )
    result = await db.execute(stmt)
    wo = result.scalar_one_or_none()
    if not wo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Work order not found")
    return wo

# --- CRUD operace se zakázkami ---

@router.post("", response_model=WorkOrderOut, status_code=status.HTTP_201_CREATED)
async def create_work_order(company_id: int, payload: WorkOrderCreateIn, db: AsyncSession = Depends(get_db), _=Depends(require_company_access)):
    wo = WorkOrder(**payload.dict(), company_id=company_id)
    db.add(wo)
    await db.commit()
    return await get_full_work_order_or_404(company_id, wo.id, db)

@router.get("", response_model=List[WorkOrderOut])
async def list_work_orders(company_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_company_access)):
    stmt = select(WorkOrder).where(WorkOrder.company_id == company_id).options(selectinload(WorkOrder.tasks), selectinload(WorkOrder.client))
    return (await db.execute(stmt)).scalars().all()

@router.get("/{work_order_id}", response_model=WorkOrderOut)
async def get_work_order(company_id: int, work_order_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_company_access)):
    return await get_full_work_order_or_404(company_id, work_order_id, db)

@router.patch("/{work_order_id}", response_model=WorkOrderOut, summary="Úprava zakázky")
async def update_work_order(company_id: int, work_order_id: int, payload: WorkOrderUpdateIn, db: AsyncSession = Depends(get_db), _=Depends(require_company_access)):
    stmt = select(WorkOrder).where(WorkOrder.id == work_order_id, WorkOrder.company_id == company_id)
    wo = (await db.execute(stmt)).scalar_one_or_none()
    if not wo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Work order not found")
    update_data = payload.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(wo, key, value)
    await db.commit()
    return await get_full_work_order_or_404(company_id, work_order_id, db)

@router.post("/{work_order_id}/status", response_model=WorkOrderOut, summary="Změna stavu zakázky")
async def update_work_order_status(company_id: int, work_order_id: int, payload: WorkOrderStatusUpdateIn, db: AsyncSession = Depends(get_db), _=Depends(require_company_access)):
    stmt = select(WorkOrder).where(WorkOrder.id == work_order_id, WorkOrder.company_id == company_id)
    wo = (await db.execute(stmt)).scalar_one_or_none()
    if not wo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Work order not found")
    wo.status = payload.status
    await db.commit()
    return await get_full_work_order_or_404(company_id, work_order_id, db)

@router.post("/{work_order_id}/copy", response_model=WorkOrderOut, status_code=status.HTTP_201_CREATED, summary="Kopírování zakázky")
async def copy_work_order(company_id: int, work_order_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_company_access)):
    original_wo = await get_full_work_order_or_404(company_id, work_order_id, db)
    new_wo = WorkOrder(company_id=original_wo.company_id, client_id=original_wo.client_id, name=f"{original_wo.name} (Kopie)", description=original_wo.description, status="new")
    new_tasks = [Task(name=task.name, description=task.description, status="todo") for task in original_wo.tasks]
    new_wo.tasks = new_tasks
    db.add(new_wo)
    await db.commit()
    return await get_full_work_order_or_404(company_id, new_wo.id, db)

# --- Fakturační report ---

@router.get("/{work_order_id}/billing-report", response_model=BillingReportOut, summary="Získání podkladů pro fakturaci zakázky")
async def get_billing_report(
    company_id: int, work_order_id: int,
    start_date: Optional[date] = None, end_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db), _=Depends(require_admin_access)
):
    wo = await get_full_work_order_or_404(company_id, work_order_id, db)
    
    time_log_query = select(TimeLog).join(TimeLog.task).where(Task.work_order_id == work_order_id, TimeLog.entry_type == TimeLogEntryType.WORK).options(selectinload(TimeLog.user), selectinload(TimeLog.work_type), selectinload(TimeLog.task))
    if start_date:
        time_log_query = time_log_query.where(func.date(TimeLog.start_time) >= start_date)
    if end_date:
        time_log_query = time_log_query.where(func.date(TimeLog.start_time) <= end_date)
    time_logs_result = (await db.execute(time_log_query)).scalars().all()

    used_items_query = select(UsedInventoryItem).join(UsedInventoryItem.task).where(Task.work_order_id == work_order_id).options(selectinload(UsedInventoryItem.inventory_item), selectinload(UsedInventoryItem.task))
    # Robustnější filtrování materiálu podle data práce
    if start_date or end_date:
        relevant_task_ids_stmt = select(Task.id).join(Task.time_logs).where(Task.work_order_id == work_order_id)
        if start_date:
            relevant_task_ids_stmt = relevant_task_ids_stmt.where(func.date(TimeLog.start_time) >= start_date)
        if end_date:
            relevant_task_ids_stmt = relevant_task_ids_stmt.where(func.date(TimeLog.start_time) <= end_date)
        relevant_task_ids = (await db.execute(relevant_task_ids_stmt)).scalars().all()
        used_items_query = used_items_query.where(UsedInventoryItem.task_id.in_(relevant_task_ids))
    used_items_result = (await db.execute(used_items_query)).scalars().all()
    
    report_time_logs, total_hours, total_price_work = [], 0.0, 0.0
    for log in time_logs_result:
        duration = (log.end_time - log.start_time).total_seconds() / 3600
        rate = log.work_type.rate if log.work_type else 0.0
        price = duration * rate
        report_time_logs.append(BillingReportTimeLogOut(work_date=log.start_time.date(), hours=round(duration, 2), rate=rate, total_price=round(price, 2), work_type_name=log.work_type.name if log.work_type else "N/A", user_email=log.user.email if log.user else "N/A", task_name=log.task.name if log.task else "N/A"))
        total_hours += duration
        total_price_work += price
        
    report_used_items, total_price_inventory = [], 0.0
    for item in used_items_result:
        price_per_unit = item.inventory_item.price if item.inventory_item and item.inventory_item.price is not None else 0.0
        price = item.quantity * price_per_unit
        report_used_items.append(BillingReportUsedItemOut(item_name=item.inventory_item.name if item.inventory_item else "N/A", sku=item.inventory_item.sku if item.inventory_item else "N/A", quantity=item.quantity, price=price_per_unit, total_price=round(price, 2), task_name=item.task.name if item.task else "N/A"))
        total_price_inventory += price
        
    return BillingReportOut(work_order_name=wo.name, client_name=wo.client.name if wo.client else None, total_hours=round(total_hours, 2), total_price_work=round(total_price_work, 2), total_price_inventory=round(total_price_inventory, 2), grand_total=round(total_price_work + total_price_inventory, 2), time_logs=report_time_logs, used_items=report_used_items)