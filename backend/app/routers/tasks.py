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

async def get_full_task_or_404(work_order_id: int, task_id: int, db: AsyncSession) -> Task:
    """Načte úkol s VŠEMI potřebnými vnořenými vztahy (assignee, used_items), jinak 404."""
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
    # Místo refresh() voláme funkci, která načte všechny vztahy
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
    # Pro úpravu stačí načíst jen základní objekt
    stmt = select(Task).where(Task.id == task_id, Task.work_order_id == work_order_id)
    task = (await db.execute(stmt)).scalar_one_or_none()
    if not task:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")

    update_data = payload.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(task, key, value)
    await db.commit()
    # Pro odpověď ale načteme plný objekt
    return await get_full_task_or_404(work_order_id, task_id, db)

@router.post("/{task_id}/assign", response_model=TaskOut, summary="Přiřazení úkolu zaměstnanci")
async def assign_task(
    company_id: int, work_order_id: int, task_id: int, payload: TaskAssignIn,
    db: AsyncSession = Depends(get_db), _=Depends(require_company_access)
):
    stmt = select(Task).where(Task.id == task_id, Task.work_order_id == work_order_id)
    task = (await db.execute(stmt)).scalar_one_or_none()
    if not task:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    
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
    if not task:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")

    await db.delete(task)
    await db.commit()

@router.post("/{task_id}/inventory", status_code=status.HTTP_200_OK, summary="Zapsání použitého materiálu k úkolu")
async def use_inventory_for_task(
    company_id: int, work_order_id: int, task_id: int, payload: UsedItemCreateIn,
    db: AsyncSession = Depends(get_db), _=Depends(require_company_access)
):
    stmt = select(Task).where(Task.id == task_id, Task.work_order_id == work_order_id)
    if not (await db.execute(stmt)).scalar_one_or_none():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    
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