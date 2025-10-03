# app/routers/tasks.py
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.database import get_db
from app.db.models import Task, UsedInventoryItem, InventoryItem, WorkOrder, Membership
from app.schemas.task import TaskCreateIn, TaskOut, UsedItemCreateIn, TaskUpdateIn, TaskAssignIn
from app.routers.companies import require_company_access

router = APIRouter(prefix="/companies/{company_id}/work-orders/{work_order_id}/tasks", tags=["tasks"])

async def get_task_or_404(work_order_id: int, task_id: int, db: AsyncSession) -> Task:
    """Načte úkol s detailem přiřazeného uživatele, ověří příslušnost, jinak 404."""
    stmt = (
        select(Task)
        .where(Task.id == task_id, Task.work_order_id == work_order_id)
        .options(selectinload(Task.assignee)) # Vždy načteme i detail uživatele
    )
    task = (await db.execute(stmt)).scalar_one_or_none()
    if not task:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found in this work order")
    return task

@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED, summary="Vytvoření nového úkolu v zakázce")
async def create_task_in_work_order(
    company_id: int, work_order_id: int, payload: TaskCreateIn,
    db: AsyncSession = Depends(get_db), _=Depends(require_company_access)
):
    """Vytvoří nový úkol a přiřadí ho k existující zakázce."""
    res = await db.execute(select(WorkOrder).where(WorkOrder.id == work_order_id, WorkOrder.company_id == company_id))
    if not res.scalar_one_or_none():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Work order not found in this company.")
        
    task = Task(**payload.dict(), work_order_id=work_order_id)
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task

@router.get("", response_model=List[TaskOut], summary="Získání seznamu všech úkolů v zakázce")
async def list_tasks_in_work_order(
    company_id: int, work_order_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_company_access)
):
    """Vrátí seznam všech úkolů pro danou zakázku."""
    stmt = (
        select(Task)
        .where(Task.work_order_id == work_order_id)
        .options(selectinload(Task.assignee))
    )
    tasks = (await db.execute(stmt)).scalars().all()
    return tasks

@router.get("/{task_id}", response_model=TaskOut, summary="Získání detailu úkolu")
async def get_task(
    company_id: int, work_order_id: int, task_id: int,
    db: AsyncSession = Depends(get_db), _=Depends(require_company_access)
):
    """Vrátí detail jednoho konkrétního úkolu."""
    return await get_task_or_404(work_order_id, task_id, db)

@router.patch("/{task_id}", response_model=TaskOut, summary="Úprava úkolu")
async def update_task(
    company_id: int, work_order_id: int, task_id: int, payload: TaskUpdateIn,
    db: AsyncSession = Depends(get_db), _=Depends(require_company_access)
):
    """Aktualizuje název, popis nebo status úkolu."""
    task = await get_task_or_404(work_order_id, task_id, db)
    update_data = payload.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(task, key, value)
    await db.commit()
    await db.refresh(task, attribute_names=['assignee']) # Načteme assignee pro odpověď
    return task

@router.post("/{task_id}/assign", response_model=TaskOut, summary="Přiřazení úkolu zaměstnanci")
async def assign_task(
    company_id: int, work_order_id: int, task_id: int, payload: TaskAssignIn,
    db: AsyncSession = Depends(get_db), _=Depends(require_company_access)
):
    """Přiřadí nebo odebere zaměstnance (assignee) z úkolu."""
    task = await get_task_or_404(work_order_id, task_id, db)
    
    if payload.assignee_id is not None:
        # Ověření, že přiřazovaný uživatel je členem dané firmy
        stmt = select(Membership).where(Membership.user_id == payload.assignee_id, Membership.company_id == company_id)
        membership = (await db.execute(stmt)).scalar_one_or_none()
        if not membership:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "User to be assigned is not a member of this company.")
    
    task.assignee_id = payload.assignee_id
    await db.commit()
    await db.refresh(task, attribute_names=['assignee']) # Načteme assignee pro odpověď
    return task

@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Smazání úkolu")
async def delete_task(
    company_id: int, work_order_id: int, task_id: int,
    db: AsyncSession = Depends(get_db), _=Depends(require_company_access)
):
    """Smaže úkol. Automaticky smaže i všechny navázané záznamy o čase a materiálu."""
    task = await get_task_or_404(work_order_id, task_id, db)
    await db.delete(task)
    await db.commit()

@router.post("/{task_id}/inventory", status_code=status.HTTP_200_OK, summary="Zapsání použitého materiálu k úkolu")
async def use_inventory_for_task(
    company_id: int, work_order_id: int, task_id: int, payload: UsedItemCreateIn,
    db: AsyncSession = Depends(get_db), _=Depends(require_company_access)
):
    """Zaznamená materiál použitý na úkol a sníží jeho stav ve skladu."""
    await get_task_or_404(work_order_id, task_id, db)
    
    item_stmt = select(InventoryItem).where(InventoryItem.id == payload.inventory_item_id, InventoryItem.company_id == company_id)
    item = (await db.execute(item_stmt)).scalar_one_or_none()
    if not item:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Inventory item not found")
    if item.quantity < payload.quantity:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Not enough items in stock")
    
    item.quantity -= payload.quantity
    used_item = UsedInventoryItem(**payload.dict(), task_id=task_id)
    db.add(used_item)
    await db.commit()
    return {"message": "Inventory item logged and stock updated successfully."}