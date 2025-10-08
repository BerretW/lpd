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
    TaskTotalHoursOut
)
# --- OPRAVENÝ IMPORT ZDE ---
# TimeLogOut se importuje ze svého vlastního souboru, ne z task.py
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

    # --- ZMĚNĚNÁ LOGIKA ---
    if payload.from_location_id is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Location must be specified when using an item for a task.")

    # Najdeme záznam o stavu na dané lokaci
    stock_record = await db.get(ItemLocationStock, (payload.inventory_item_id, payload.from_location_id))
    
    # Ověříme, zda je na dané lokaci dostatek kusů
    if not stock_record or stock_record.quantity < payload.quantity:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Not enough items in the specified location.")

    location = await db.get(Location, payload.from_location_id)
    if not location:
         raise HTTPException(status.HTTP_404_NOT_FOUND, "Specified location not found.")

    user_id = int(token.get("sub"))
    original_quantity = stock_record.quantity
    stock_record.quantity -= payload.quantity
    
    # Vytvoříme záznam o použitém materiálu
    used_item = UsedInventoryItem(
        task_id=task_id,
        inventory_item_id=payload.inventory_item_id,
        quantity=payload.quantity,
        from_location_id=payload.from_location_id
    )
    db.add(used_item)

    # Vytvoříme auditní záznam
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
    """
    Vrátí součet všech odpracovaných hodin (typ 'work') zaznamenaných
    pro daný úkol, po odečtení přestávek.
    """
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
    
    # --- OPRAVA ZDE ---
    # Explicitně převedeme výsledek (který může být Decimal nebo None) na float
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
    """
    Vrátí chronologický seznam všech záznamů z docházky (všech typů),
    které jsou navázány na tento konkrétní úkol. Slouží jako výpis aktivit.
    """
    await get_full_task_or_404(work_order_id, task_id, db)

    stmt = (
        select(TimeLog)
        .where(TimeLog.task_id == task_id)
        .options(
            selectinload(TimeLog.user),
            selectinload(TimeLog.work_type),
            # --- OPRAVA ZDE: Přidáme eager loading pro úkol ---
            selectinload(TimeLog.task) 
        )
        .order_by(TimeLog.start_time.asc())
    )

    result = await db.execute(stmt)
    return result.scalars().all()

@router.delete(
    "/{task_id}/inventory/{used_item_id}", 
    response_model=TaskOut, 
    summary="Odebrání použitého materiálu z úkolu"
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
    Odebere záznam o použitém materiálu z úkolu.
    Tato akce je reverzní - materiál se "vrátí" zpět na původní skladovou lokaci
    a vytvoří se o tom auditní záznam.
    """
    # 1. Najdeme záznam o použití materiálu a ověříme, že patří k danému úkolu
    stmt = select(UsedInventoryItem).where(
        UsedInventoryItem.id == used_item_id,
        UsedInventoryItem.task_id == task_id
    )
    used_item_record = (await db.execute(stmt)).scalar_one_or_none()

    if not used_item_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Used item record not found for this task.")

    # 2. Vrátíme množství zpět na skladovou lokaci, pokud byla specifikována
    if used_item_record.from_location_id:
        # Najdeme záznam o stavu na dané lokaci
        stock_record = await db.get(ItemLocationStock, (used_item_record.inventory_item_id, used_item_record.from_location_id))
        
        if stock_record:
            stock_record.quantity += used_item_record.quantity
        else:
            # Pokud by záznam mezitím zmizel (což by nemělo nastat), vytvoříme ho znovu
            new_stock_record = ItemLocationStock(
                inventory_item_id=used_item_record.inventory_item_id,
                location_id=used_item_record.from_location_id,
                quantity=used_item_record.quantity
            )
            db.add(new_stock_record)
    
    # 3. Vytvoříme auditní záznam o vrácení
    user_id = int(token.get("sub"))
    item = await db.get(InventoryItem, used_item_record.inventory_item_id)
    location = await db.get(Location, used_item_record.from_location_id) if used_item_record.from_location_id else None
    
    item_name = item.name if item else "N/A"
    location_name = location.name if location else "Neznámá lokace"

    log_details = (
        f"Vráceno {used_item_record.quantity} ks položky '{item_name}' zpět na sklad (lokace: '{location_name}') "
        f"z úkolu ID: {task_id}."
    )
    
    log_entry = InventoryAuditLog(
        item_id=used_item_record.inventory_item_id,
        user_id=user_id,
        company_id=company_id,
        action=AuditLogAction.quantity_adjusted,
        details=log_details
    )
    db.add(log_entry)
    
    # 4. Smažeme původní záznam o použití materiálu
    await db.delete(used_item_record)
    
    # 5. Uložíme změny a vrátíme aktualizovaný úkol
    await db.commit()
    return await get_full_task_or_404(work_order_id, task_id, db)

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
    """
    Upraví množství materiálu použitého na úkolu. Tato operace je plně svázaná se skladem:
    - Pokud se množství **zvýší**, další kusy se odečtou ze skladu.
    - Pokud se množství **sníží**, rozdíl se vrátí zpět na sklad.
    Vytvoří se odpovídající auditní záznam.
    """
    if payload.quantity <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Quantity must be positive. To remove an item, use the DELETE endpoint."
        )

    # 1. Najdeme záznam o použití materiálu
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

    # Pokud se nic nemění, nic neděláme
    if quantity_diff == 0:
        return await get_full_task_or_404(work_order_id, task_id, db)

    # 2. Upravíme stav skladu podle rozdílu
    if used_item_record.from_location_id:
        stock_record = await db.get(ItemLocationStock, (used_item_record.inventory_item_id, used_item_record.from_location_id))
        if not stock_record:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Source stock location no longer exists.")

        # Zvyšujeme spotřebu -> bereme více ze skladu
        if quantity_diff > 0:
            if stock_record.quantity < quantity_diff:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Not enough stock to increase usage. Only {stock_record.quantity} available, but {quantity_diff} more are needed."
                )
            stock_record.quantity -= quantity_diff
        
        # Snižujeme spotřebu -> vracíme do skladu
        else: # quantity_diff < 0
            stock_record.quantity += abs(quantity_diff)
    
    # 3. Aktualizujeme samotný záznam o použitém materiálu
    used_item_record.quantity = new_quantity
    
    # 4. Vytvoříme auditní záznam
    user_id = int(token.get("sub"))
    item = await db.get(InventoryItem, used_item_record.inventory_item_id)
    location = await db.get(Location, used_item_record.from_location_id) if used_item_record.from_location_id else None
    
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
    
    # 5. Uložíme a vrátíme
    await db.commit()
    return await get_full_task_or_404(work_order_id, task_id, db)