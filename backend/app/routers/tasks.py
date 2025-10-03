from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import get_db
from app.db.models import Task, TimeLog, UsedInventoryItem, InventoryItem, WorkOrder
from app.schemas.task import TaskCreateIn, TaskOut, TimeLogCreateIn, UsedItemCreateIn
from app.routers.companies import require_company_access

router = APIRouter(prefix="/companies/{company_id}/tasks", tags=["tasks"])

async def get_task_or_404(task_id: int, company_id: int, db: AsyncSession) -> Task:
    # Komplexní dotaz, který ověří, že úkol patří firmě přes zakázku
    stmt = select(Task).join(Task.work_order).where(Task.id == task_id, WorkOrder.company_id == company_id)
    result = await db.execute(stmt)
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    return task

@router.post("/{task_id}/time-logs", status_code=status.HTTP_201_CREATED)
async def log_time_for_task(
    company_id: int, task_id: int, payload: TimeLogCreateIn,
    db: AsyncSession = Depends(get_db),
    token: Dict[str, Any] = Depends(require_company_access)
):
    task = await get_task_or_404(task_id, company_id, db)
    user_id = int(token.get("sub"))
    
    # TODO: Ověřit, že přihlášený uživatel je přiřazen k úkolu (task.assignee_id == user_id)
    
    time_log = TimeLog(**payload.dict(), task_id=task_id, user_id=user_id)
    db.add(time_log)
    await db.commit()
    return {"message": "Time logged successfully."}

@router.post("/{task_id}/inventory", status_code=status.HTTP_201_CREATED)
async def use_inventory_for_task(
    company_id: int, task_id: int, payload: UsedItemCreateIn,
    db: AsyncSession = Depends(get_db),
    token: Dict[str, Any] = Depends(require_company_access)
):
    await get_task_or_404(task_id, company_id, db) # Ověření existence úkolu
    user_id = int(token.get("sub"))

    # Najdeme položku ve skladu a snížíme její stav
    item_stmt = select(InventoryItem).where(InventoryItem.id == payload.inventory_item_id, InventoryItem.company_id == company_id)
    item = (await db.execute(item_stmt)).scalar_one_or_none()
    if not item:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Inventory item not found")
    if item.quantity < payload.quantity:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Not enough items in stock")
    
    item.quantity -= payload.quantity # Snížení stavu skladu

    # Záznam o použití materiálu
    used_item = UsedInventoryItem(**payload.dict(), task_id=task_id)
    db.add(used_item)
    await db.commit()
    return {"message": "Inventory item logged and stock updated."}