# backend/app/routers/tasks.py
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from sqlalchemy.orm import selectinload

from app.db.database import get_db
from app.db.models import (
    Task, UsedInventoryItem, InventoryItem, WorkOrder, Membership,
    InventoryAuditLog, AuditLogAction, ItemLocationStock, Location,
    TimeLog, TimeLogEntryType
)
from app.schemas.task import (
    TaskCreateIn, TaskOut, UsedItemCreateIn, TaskUpdateIn,
    TaskAssignIn, UsedItemUpdateIn, AssignedTaskOut,
    TaskTotalHoursOut, DirectAssignItemIn
)
from app.schemas.time_log import TimeLogOut
from app.core.dependencies import require_company_access
from app.routers.inventory import get_full_inventory_item

router = APIRouter(prefix="/companies/{company_id}/work-orders/{work_order_id}/tasks", tags=["tasks"])

async def get_full_task_or_404(work_order_id: int, task_id: int, db: AsyncSession) -> Task:
    # ... (tato funkce zůstává beze změny) ...
    stmt = (
        select(Task)
        .where(Task.id == task_id, Task.work_order_id == work_order_id)
        .options(
            selectinload(Task.assignee),
            selectinload(Task.used_items).selectinload(UsedInventoryItem.inventory_item)
        )
    )
    task = (await db.execute(stmt)).scalar_one_or_none()
    if not task:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found in this work order")
    return task

# ... (ostatní CRUD operace s úkoly zůstávají beze změny) ...
@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED, summary="Vytvoření nového úkolu v zakázce")
async def create_task_in_work_order(
    company_id: int, work_order_id: int, payload: TaskCreateIn,
    db: AsyncSession = Depends(get_db), _=Depends(require_company_access)
):
    res = await db.execute(select(WorkOrder).where(WorkOrder.id == work_order_id, WorkOrder.company_id == company_id))
    if not res.scalar_one_or_none():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Work order not found in this company.")
    task = Task(**payload.dict(), work_order_id=work_order_id)
    db.add(task)
    await db.commit()
    return await get_full_task_or_404(work_order_id, task.id, db)

@router.get("", response_model=List[TaskOut], summary="Získání seznamu všech úkolů v zakázce")
async def list_tasks_in_work_order(
    company_id: int, work_order_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_company_access)
):
    stmt = (
        select(Task)
        .where(Task.work_order_id == work_order_id)
        .options(
            selectinload(Task.assignee),
            selectinload(Task.used_items).selectinload(UsedInventoryItem.inventory_item)
        )
    )
    return (await db.execute(stmt)).scalars().all()

@router.get("/{task_id}", response_model=TaskOut, summary="Získání detailu úkolu")
async def get_task(
    company_id: int, work_order_id: int, task_id: int,
    db: AsyncSession = Depends(get_db), _=Depends(require_company_access)
):
    return await get_full_task_or_404(work_order_id, task_id, db)

@router.patch("/{task_id}", response_model=TaskOut, summary="Úprava úkolu")
async def update_task(
    company_id: int, work_order_id: int, task_id: int, payload: TaskUpdateIn,
    db: AsyncSession = Depends(get_db), _=Depends(require_company_access)
):
    stmt = select(Task).where(Task.id == task_id, Task.work_order_id == work_order_id)
    task = (await db.execute(stmt)).scalar_one_or_none()
    if not task: raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    update_data = payload.dict(exclude_unset=True)
    for key, value in update_data.items(): setattr(task, key, value)
    await db.commit()
    return await get_full_task_or_404(work_order_id, task_id, db)

@router.post("/{task_id}/assign", response_model=TaskOut, summary="Přiřazení úkolu zaměstnanci")
async def assign_task(
    company_id: int, work_order_id: int, task_id: int, payload: TaskAssignIn,
    db: AsyncSession = Depends(get_db), _=Depends(require_company_access)
):
    stmt = select(Task).where(Task.id == task_id, Task.work_order_id == work_order_id)
    task = (await db.execute(stmt)).scalar_one_or_none()
    if not task: raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    if payload.assignee_id is not None:
        stmt_mem = select(Membership).where(Membership.user_id == payload.assignee_id, Membership.company_id == company_id)
        if not (await db.execute(stmt_mem)).scalar_one_or_none():
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "User to be assigned is not a member of this company.")
    task.assignee_id = payload.assignee_id
    await db.commit()
    return await get_full_task_or_404(work_order_id, task_id, db)

@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Smazání úkolu")
async def delete_task(
    company_id: int, work_order_id: int, task_id: int,
    db: AsyncSession = Depends(get_db), _=Depends(require_company_access)
):
    stmt = select(Task).where(Task.id == task_id, Task.work_order_id == work_order_id)
    task = (await db.execute(stmt)).scalar_one_or_none()
    if not task: raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    await db.delete(task)
    await db.commit()


# --- Správa materiálu v rámci úkolu ---

@router.post("/{task_id}/inventory", response_model=TaskOut, summary="Zapsání použitého materiálu k úkolu")
async def use_inventory_for_task(
    company_id: int, work_order_id: int, task_id: int, payload: UsedItemCreateIn,
    db: AsyncSession = Depends(get_db), token: Dict[str, Any] = Depends(require_company_access)
):
    """
    Zaznamená materiál použitý na úkol, sníží jeho stav na konkrétní LOKACI
    a vytvoří auditní záznam.
    """
    await get_full_task_or_404(work_order_id, task_id, db)

    if payload.from_location_id is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Location must be specified when using an item for a task.")

    stock_record = await db.get(ItemLocationStock, (payload.inventory_item_id, payload.from_location_id))
    
    if not stock_record or stock_record.quantity < payload.quantity:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Not enough items in the specified location.")

    location = await db.get(Location, payload.from_location_id)
    if not location:
         raise HTTPException(status.HTTP_404_NOT_FOUND, "Specified location not found.")

    user_id = int(token.get("sub"))
    original_quantity = stock_record.quantity
    stock_record.quantity -= payload.quantity
    
    used_item = UsedInventoryItem(
        task_id=task_id,
        inventory_item_id=payload.inventory_item_id,
        quantity=payload.quantity,
        from_location_id=payload.from_location_id
    )
    db.add(used_item)

    log_entry = InventoryAuditLog(
        item_id=payload.inventory_item_id,
        user_id=user_id,
        company_id=company_id,
        action=AuditLogAction.location_withdrawn,
        details=(
            f"Odebráno {payload.quantity} ks z lokace '{location.name}' pro úkol ID: {task_id}. "
            f"Stav na lokaci změněn z {original_quantity} na {stock_record.quantity}."
        )
    )
    db.add(log_entry)

    await db.commit()
    return await get_full_task_or_404(work_order_id, task_id, db)

@router.post(
    "/{task_id}/inventory/direct-assign",
    response_model=TaskOut,
    summary="Naskladnění a okamžité vyskladnění materiálu přímo na úkol"
)
async def direct_assign_inventory_to_task(
    company_id: int,
    work_order_id: int,
    task_id: int,
    payload: DirectAssignItemIn,
    db: AsyncSession = Depends(get_db),
    token: Dict[str, Any] = Depends(require_company_access)
):
    """
    Tato operace simuluje naskladnění a okamžité vyskladnění materiálu,
    který přišel rovnou na stavbu (k zakázce), aniž by prošel skladem.
    Vytvoří auditní záznam o příjmu a rovnou materiál zapíše jako spotřebovaný k úkolu.
    Celkový stav na skladech se nemění.
    """
    await get_full_task_or_404(work_order_id, task_id, db)
    
    item = await db.get(InventoryItem, payload.inventory_item_id)
    if not item or item.company_id != company_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inventory item not found in this company.")

    user_id = int(token.get("sub"))

    log_details = (
        f"Přímý příjem {payload.quantity} ks položky '{item.name}' (SKU: {item.sku}) "
        f"a okamžité přiřazení k úkolu ID: {task_id}. {payload.details or ''}".strip()
    )
    audit_log = InventoryAuditLog(
        item_id=item.id,
        user_id=user_id,
        company_id=company_id,
        action=AuditLogAction.quantity_adjusted, 
        details=log_details
    )
    db.add(audit_log)

    used_item = UsedInventoryItem(
        task_id=task_id,
        inventory_item_id=payload.inventory_item_id,
        quantity=payload.quantity,
        from_location_id=None 
    )
    db.add(used_item)
    
    await db.commit()
    
    return await get_full_task_or_404(work_order_id, task_id, db)


# ... (get_task_total_hours a get_task_time_logs zůstávají stejné) ...
@router.get(
    "/{task_id}/total-hours",
    response_model=TaskTotalHoursOut,
    summary="Získání celkového počtu odpracovaných hodin na úkolu"
)
async def get_task_total_hours(
    company_id: int,
    work_order_id: int,
    task_id: int,
    db: AsyncSession = Depends(get_db),
    _ = Depends(require_company_access)
):
    await get_full_task_or_404(work_order_id, task_id, db)
    total_seconds_expr = func.timestampdiff(text('SECOND'), TimeLog.start_time, TimeLog.end_time)
    total_break_seconds_expr = TimeLog.break_duration_minutes * 60
    stmt = (
        select(func.sum(total_seconds_expr - total_break_seconds_expr))
        .where(
            TimeLog.task_id == task_id,
            TimeLog.entry_type == TimeLogEntryType.WORK
        )
    )
    result_from_db = (await db.execute(stmt)).scalar_one_or_none()
    total_seconds = float(result_from_db or 0)
    total_hours = round(total_seconds / 3600.0, 2)
    return TaskTotalHoursOut(task_id=task_id, total_hours=total_hours)

@router.get(
    "/{task_id}/time-logs",
    response_model=List[TimeLogOut],
    summary="Získání všech záznamů z docházky pro daný úkol"
)
async def get_task_time_logs(
    company_id: int,
    work_order_id: int,
    task_id: int,
    db: AsyncSession = Depends(get_db),
    _ = Depends(require_company_access)
):
    await get_full_task_or_404(work_order_id, task_id, db)
    stmt = (
        select(TimeLog)
        .where(TimeLog.task_id == task_id)
        .options(
            selectinload(TimeLog.user),
            selectinload(TimeLog.work_type),
            selectinload(TimeLog.task) 
        )
        .order_by(TimeLog.start_time.asc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()

# --- UPRAVENÁ FUNKCE ---
@router.delete(
    "/{task_id}/inventory/{used_item_id}", 
    response_model=TaskOut, 
    summary="Odebrání použitého materiálu z úkolu s logikou pro vratku"
)
async def remove_used_inventory_from_task(
    company_id: int,
    work_order_id: int,
    task_id: int,
    used_item_id: int,
    db: AsyncSession = Depends(get_db),
    token: Dict[str, Any] = Depends(require_company_access)
):
    """
    Odebere záznam o použitém materiálu z úkolu a provede vratku.
    - Pokud byl materiál vydán ze skladu, vrátí se na původní lokaci.
    - Pokud šlo o přímý nákup, naskladní se na výchozí sklad firmy.
    """
    stmt = select(UsedInventoryItem).where(
        UsedInventoryItem.id == used_item_id,
        UsedInventoryItem.task_id == task_id
    )
    used_item_record = (await db.execute(stmt)).scalar_one_or_none()

    if not used_item_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Used item record not found for this task.")

    user_id = int(token.get("sub"))
    item = await db.get(InventoryItem, used_item_record.inventory_item_id)
    log_details = ""

    # Případ 1: Standardní vratka na původní lokaci
    if used_item_record.from_location_id:
        location = await db.get(Location, used_item_record.from_location_id)
        stock_record = await db.get(ItemLocationStock, (used_item_record.inventory_item_id, used_item_record.from_location_id))
        
        if stock_record:
            stock_record.quantity += used_item_record.quantity
        else:
            stock_record = ItemLocationStock(
                inventory_item_id=used_item_record.inventory_item_id,
                location_id=used_item_record.from_location_id,
                quantity=used_item_record.quantity
            )
            db.add(stock_record)
        
        log_details = (
            f"Vratka {used_item_record.quantity} ks položky '{item.name}' na původní lokaci '{location.name if location else 'N/A'}' "
            f"po smazání ze spotřeby u úkolu ID: {task_id}."
        )

    # Případ 2: Přímý nákup se přesouvá na výchozí sklad
    else:
        # Najdeme výchozí lokaci (první podle abecedy)
        default_loc_stmt = select(Location).where(Location.company_id == company_id).order_by(Location.name.asc()).limit(1)
        default_location = (await db.execute(default_loc_stmt)).scalar_one_or_none()

        if not default_location:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove direct assignment item because no warehouse location is defined for this company. Please create a location first."
            )

        stock_record = await db.get(ItemLocationStock, (used_item_record.inventory_item_id, default_location.id))

        if stock_record:
            stock_record.quantity += used_item_record.quantity
        else:
            stock_record = ItemLocationStock(
                inventory_item_id=used_item_record.inventory_item_id,
                location_id=default_location.id,
                quantity=used_item_record.quantity
            )
            db.add(stock_record)

        log_details = (
            f"Naskladněno {used_item_record.quantity} ks položky '{item.name}' na výchozí sklad '{default_location.name}' "
            f"po smazání z přímého nákupu u úkolu ID: {task_id}."
        )
    
    # Vytvoření auditního záznamu
    log_entry = InventoryAuditLog(
        item_id=used_item_record.inventory_item_id,
        user_id=user_id,
        company_id=company_id,
        action=AuditLogAction.quantity_adjusted,
        details=log_details
    )
    db.add(log_entry)
    
    # Smazání původního záznamu o spotřebě
    await db.delete(used_item_record)
    
    await db.commit()
    return await get_full_task_or_404(work_order_id, task_id, db)

# ... (update_used_inventory_quantity zůstává beze změny) ...
@router.patch(
    "/{task_id}/inventory/{used_item_id}",
    response_model=TaskOut,
    summary="Úprava množství použitého materiálu na úkolu"
)
async def update_used_inventory_quantity(
    company_id: int,
    work_order_id: int,
    task_id: int,
    used_item_id: int,
    payload: UsedItemUpdateIn,
    db: AsyncSession = Depends(get_db),
    token: Dict[str, Any] = Depends(require_company_access)
):
    if payload.quantity <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Quantity must be positive. To remove an item, use the DELETE endpoint."
        )

    stmt = select(UsedInventoryItem).where(
        UsedInventoryItem.id == used_item_id,
        UsedInventoryItem.task_id == task_id
    )
    used_item_record = (await db.execute(stmt)).scalar_one_or_none()

    if not used_item_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Used item record not found for this task.")

    original_quantity = used_item_record.quantity
    new_quantity = payload.quantity
    quantity_diff = new_quantity - original_quantity

    if quantity_diff == 0:
        return await get_full_task_or_404(work_order_id, task_id, db)

    # Logika pro přímý nákup - nelze měnit množství, pouze smazat a vytvořit znovu.
    if used_item_record.from_location_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change quantity of a direct assignment item. Please remove it and add a new one."
        )

    stock_record = await db.get(ItemLocationStock, (used_item_record.inventory_item_id, used_item_record.from_location_id))
    if not stock_record:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Source stock location no longer exists.")

    if quantity_diff > 0:
        if stock_record.quantity < quantity_diff:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Not enough stock to increase usage. Only {stock_record.quantity} available, but {quantity_diff} more are needed."
            )
        stock_record.quantity -= quantity_diff
    else: 
        stock_record.quantity += abs(quantity_diff)
    
    used_item_record.quantity = new_quantity
    
    user_id = int(token.get("sub"))
    item = await db.get(InventoryItem, used_item_record.inventory_item_id)
    location = await db.get(Location, used_item_record.from_location_id)
    
    log_details = (
        f"Množství položky '{item.name if item else 'N/A'}' pro úkol ID:{task_id} "
        f"upraveno z {original_quantity} na {new_quantity}. "
        f"Změna stavu na lokaci '{location.name if location else 'N/A'}': {-quantity_diff:+d} ks."
    )
    
    log_entry = InventoryAuditLog(
        item_id=used_item_record.inventory_item_id, user_id=user_id, company_id=company_id,
        action=AuditLogAction.quantity_adjusted, details=log_details
    )
    db.add(log_entry)
    
    await db.commit()
    return await get_full_task_or_404(work_order_id, task_id, db)