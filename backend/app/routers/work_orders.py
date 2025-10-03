from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.db.database import get_db
from app.db.models import WorkOrder, Task
from app.schemas.work_order import WorkOrderCreateIn, WorkOrderOut, WorkOrderUpdateIn, WorkOrderStatusUpdateIn
from app.routers.companies import require_company_access

router = APIRouter(prefix="/companies/{company_id}/work-orders", tags=["work-orders"])

async def get_work_order_or_404(company_id: int, work_order_id: int, db: AsyncSession, load_relations: bool = True) -> WorkOrder:
    """Pomocná funkce pro načtení zakázky nebo vrácení 404."""
    query = select(WorkOrder).where(WorkOrder.id == work_order_id, WorkOrder.company_id == company_id)
    if load_relations:
        query = query.options(selectinload(WorkOrder.tasks), selectinload(WorkOrder.client))
    
    result = await db.execute(query)
    wo = result.scalar_one_or_none()
    if not wo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Work order not found")
    return wo

@router.post("", response_model=WorkOrderOut, status_code=status.HTTP_201_CREATED)
async def create_work_order(company_id: int, payload: WorkOrderCreateIn, db: AsyncSession = Depends(get_db), _=Depends(require_company_access)):
    wo = WorkOrder(**payload.dict(), company_id=company_id)
    db.add(wo)
    await db.commit()
    await db.refresh(wo)
    return wo

@router.get("", response_model=List[WorkOrderOut])
async def list_work_orders(company_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_company_access)):
    stmt = select(WorkOrder).where(WorkOrder.company_id == company_id).options(selectinload(WorkOrder.client))
    return (await db.execute(stmt)).scalars().all()

@router.get("/{work_order_id}", response_model=WorkOrderOut)
async def get_work_order(company_id: int, work_order_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_company_access)):
    return await get_work_order_or_404(company_id, work_order_id, db)

@router.patch("/{work_order_id}", response_model=WorkOrderOut, summary="Úprava zakázky")
async def update_work_order(company_id: int, work_order_id: int, payload: WorkOrderUpdateIn, db: AsyncSession = Depends(get_db), _=Depends(require_company_access)):
    wo = await get_work_order_or_404(company_id, work_order_id, db, load_relations=False)
    update_data = payload.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(wo, key, value)
    await db.commit()
    await db.refresh(wo)
    return wo

@router.post("/{work_order_id}/status", response_model=WorkOrderOut, summary="Změna stavu zakázky (uzavření/znovuotevření)")
async def update_work_order_status(company_id: int, work_order_id: int, payload: WorkOrderStatusUpdateIn, db: AsyncSession = Depends(get_db), _=Depends(require_company_access)):
    wo = await get_work_order_or_404(company_id, work_order_id, db)
    wo.status = payload.status
    await db.commit()
    await db.refresh(wo)
    return wo

@router.post("/{work_order_id}/copy", response_model=WorkOrderOut, status_code=status.HTTP_201_CREATED, summary="Kopírování zakázky")
async def copy_work_order(company_id: int, work_order_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_company_access)):
    """
    Vytvoří hlubokou kopii existující zakázky včetně všech jejích úkolů.
    Nová zakázka a úkoly budou mít výchozí status.
    """
    original_wo = await get_work_order_or_404(company_id, work_order_id, db, load_relations=True)
    
    # Vytvoření kopie zakázky
    new_wo = WorkOrder(
        company_id=original_wo.company_id,
        client_id=original_wo.client_id,
        name=f"{original_wo.name} (Kopie)",
        description=original_wo.description,
        status="new" # Výchozí status
    )

    # Vytvoření kopií úkolů
    new_tasks = [
        Task(
            name=task.name,
            description=task.description,
            status="todo", # Výchozí status
            assignee_id=None # Přiřazení se nekopíruje
        )
        for task in original_wo.tasks
    ]
    new_wo.tasks = new_tasks
    
    db.add(new_wo)
    await db.commit()
    await db.refresh(new_wo)
    return new_wo