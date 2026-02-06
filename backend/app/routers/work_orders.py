# backend/app/routers/work_orders.py
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from datetime import date

from app.db.database import get_db
from app.db.models import (
    WorkOrder, Task, TimeLog, UsedInventoryItem, TimeLogEntryType,
    ClientCategoryMargin, InventoryItem, Client, InventoryCategory
)
from app.schemas.work_order import (
    WorkOrderCreateIn, WorkOrderOut, WorkOrderUpdateIn, WorkOrderStatusUpdateIn,
    BillingReportOut
)
from app.schemas.shared import BillingReportTimeLogOut, BillingReportUsedItemOut
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

# --- CRUD operace se zakázkami (beze změn) ---

@router.post("", response_model=WorkOrderOut, status_code=status.HTTP_201_CREATED)
async def create_work_order(
    company_id: int, 
    payload: WorkOrderCreateIn, 
    db: AsyncSession = Depends(get_db), 
    _=Depends(require_company_access)
):
    wo = WorkOrder(**payload.dict(), company_id=company_id)
    db.add(wo)
    await db.commit()
    return await get_full_work_order_or_404(company_id, wo.id, db)

@router.get("", response_model=List[WorkOrderOut])
async def list_work_orders(
    company_id: int, 
    db: AsyncSession = Depends(get_db), 
    _=Depends(require_company_access)
):
    stmt = (
        select(WorkOrder)
        .where(WorkOrder.company_id == company_id)
        .options(selectinload(WorkOrder.tasks), selectinload(WorkOrder.client))
    )
    return (await db.execute(stmt)).scalars().all()

@router.get("/{work_order_id}", response_model=WorkOrderOut)
async def get_work_order(
    company_id: int, 
    work_order_id: int, 
    db: AsyncSession = Depends(get_db), 
    _=Depends(require_company_access)
):
    return await get_full_work_order_or_404(company_id, work_order_id, db)

@router.patch("/{work_order_id}", response_model=WorkOrderOut, summary="Úprava zakázky")
async def update_work_order(
    company_id: int, 
    work_order_id: int, 
    payload: WorkOrderUpdateIn, 
    db: AsyncSession = Depends(get_db), 
    _=Depends(require_company_access)
):
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
async def update_work_order_status(
    company_id: int, 
    work_order_id: int, 
    payload: WorkOrderStatusUpdateIn, 
    db: AsyncSession = Depends(get_db), 
    _=Depends(require_company_access)
):
    stmt = select(WorkOrder).where(WorkOrder.id == work_order_id, WorkOrder.company_id == company_id)
    wo = (await db.execute(stmt)).scalar_one_or_none()
    if not wo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Work order not found")
    wo.status = payload.status
    await db.commit()
    return await get_full_work_order_or_404(company_id, work_order_id, db)

@router.post("/{work_order_id}/copy", response_model=WorkOrderOut, status_code=status.HTTP_201_CREATED, summary="Kopírování zakázky")
async def copy_work_order(
    company_id: int, 
    work_order_id: int, 
    db: AsyncSession = Depends(get_db), 
    _=Depends(require_company_access)
):
    original_wo = await get_full_work_order_or_404(company_id, work_order_id, db)
    new_wo = WorkOrder(
        company_id=original_wo.company_id, 
        client_id=original_wo.client_id, 
        name=f"{original_wo.name} (Kopie)", 
        description=original_wo.description, 
        status="new"
    )
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
    db: AsyncSession = Depends(get_db)
):
    # 1. Načtení zakázky a klienta
    wo = await get_full_work_order_or_404(company_id, work_order_id, db)
    
    client_global_margin = 0.0
    margin_map = {} # {category_id: margin_percentage}
    category_parent_map = {} # {category_id: parent_id}

    if wo.client:
        client_global_margin = wo.client.margin_percentage if wo.client.margin_percentage is not None else 0.0
        
        # 2a. Načtení specifických marží klienta
        margin_stmt = select(ClientCategoryMargin).where(ClientCategoryMargin.client_id == wo.client_id)
        margins_results = (await db.execute(margin_stmt)).scalars().all()
        margin_map = {m.category_id: m.margin_percentage for m in margins_results}
        
        # 2b. Načtení stromové struktury kategorií (pro dědičnost marží)
        # Načteme ID a ParentID všech kategorií firmy, abychom mohli procházet strom nahoru
        cats_stmt = select(InventoryCategory.id, InventoryCategory.parent_id).where(InventoryCategory.company_id == company_id)
        cats_results = (await db.execute(cats_stmt)).all()
        category_parent_map = {row.id: row.parent_id for row in cats_results}

    # 3. Načtení času
    time_log_query = (
        select(TimeLog)
        .join(TimeLog.task)
        .where(
            Task.work_order_id == work_order_id, 
            TimeLog.entry_type == TimeLogEntryType.WORK
        )
        .options(
            selectinload(TimeLog.user), 
            selectinload(TimeLog.work_type), 
            selectinload(TimeLog.task)
        )
    )
    if start_date:
        time_log_query = time_log_query.where(func.date(TimeLog.start_time) >= start_date)
    if end_date:
        time_log_query = time_log_query.where(func.date(TimeLog.start_time) <= end_date)
        
    time_logs_result = (await db.execute(time_log_query)).scalars().all()

    # 4. Načtení materiálu
    used_items_query = (
        select(UsedInventoryItem)
        .join(UsedInventoryItem.task)
        .where(Task.work_order_id == work_order_id)
        .options(
            selectinload(UsedInventoryItem.inventory_item).selectinload(InventoryItem.categories),
            selectinload(UsedInventoryItem.task)
        )
    )
    
    if start_date:
        used_items_query = used_items_query.where(func.date(UsedInventoryItem.log_date) >= start_date)
    if end_date:
        used_items_query = used_items_query.where(func.date(UsedInventoryItem.log_date) <= end_date)
        
    used_items_result = (await db.execute(used_items_query)).scalars().all()
    
    # --- Zpracování času ---
    report_time_logs = []
    total_hours = 0.0
    total_price_work = 0.0
    
    for log in time_logs_result:
        duration = (log.end_time - log.start_time).total_seconds() / 3600
        rate = log.work_type.rate if log.work_type else 0.0
        price = duration * rate
        
        report_time_logs.append(BillingReportTimeLogOut(
            work_date=log.start_time.date(), 
            hours=round(duration, 2), 
            rate=rate, 
            total_price=round(price, 2), 
            work_type_name=log.work_type.name if log.work_type else "N/A", 
            user_email=log.user.email if log.user else "N/A", 
            task_name=log.task.name if log.task else "N/A"
        ))
        total_hours += duration
        total_price_work += price
        
    # --- Zpracování materiálu s DĚDIČNOSTÍ MARŽÍ ---
    report_used_items = []
    total_price_inventory = 0.0
    
    for item in used_items_result:
        inv_item = item.inventory_item
        unit_cost = inv_item.price if inv_item and inv_item.price is not None else 0.0
        
        # Logika hledání marže:
        # Pokud má položka více kategorií, vezmeme tu "nejlepší" (nejvyšší) marži, kterou najdeme v jejích stromech.
        # Defaultně začínáme s globální marží klienta.
        best_margin = client_global_margin
        
        if inv_item and inv_item.categories:
            for cat in inv_item.categories:
                current_cat_id = cat.id
                
                # Procházíme strom kategorie nahoru (Category -> Parent -> Grandparent -> Root)
                # dokud nenajdeme definovanou marži nebo nedojdeme na konec.
                while current_cat_id is not None:
                    if current_cat_id in margin_map:
                        found_margin = margin_map[current_cat_id]
                        # Pokud najdeme marži, porovnáme ji s dosud nejlepší nalezenou
                        # (To řeší situaci, kdy je položka ve více kategoriích s různými maržemi)
                        if found_margin > best_margin:
                            best_margin = found_margin
                        # Jakmile najdeme marži v této větvi stromu, končíme prohledávání této větve
                        # (specifičtější/nižší kategorie má přednost, ale zde hledáme první shodu odspodu)
                        # Poznámka: Pokud je marže definovaná na 'Kamery' i 'Slaboproud', tento cyklus najde 'Kamery' první.
                        # Pokud bychom chtěli zdědit marži z rodiče POUZE pokud není na dítěti, 'break' je správně.
                        break 
                    
                    # Posuneme se o úroveň výš
                    current_cat_id = category_parent_map.get(current_cat_id)

        # C. Výpočet prodejní ceny
        unit_price_sold = unit_cost * (1 + best_margin / 100.0)
        total_line_price = item.quantity * unit_price_sold
        
        report_used_items.append(BillingReportUsedItemOut(
            item_name=inv_item.name if inv_item else "N/A",
            sku=inv_item.sku if inv_item else "N/A",
            quantity=item.quantity,
            
            unit_cost=round(unit_cost, 2),
            margin_applied=round(best_margin, 2),
            unit_price_sold=round(unit_price_sold, 2),
            
            total_price=round(total_line_price, 2),
            task_name=item.task.name if item.task else "N/A"
        ))
        total_price_inventory += total_line_price
        
    return BillingReportOut(
        work_order_name=wo.name, 
        client_name=wo.client.name if wo.client else None, 
        total_hours=round(total_hours, 2), 
        total_price_work=round(total_price_work, 2), 
        total_price_inventory=round(total_price_inventory, 2), 
        grand_total=round(total_price_work + total_price_inventory, 2), 
        time_logs=report_time_logs, 
        used_items=report_used_items
    )