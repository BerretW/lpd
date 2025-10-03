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

async def get_full_work_order_or_404(company_id: int, work_order_id: int, db: AsyncSession) -> WorkOrder:
    """Pomocná funkce, která VŽDY načte zakázku se všemi potřebnými vztahy."""
    stmt = (
        select(WorkOrder)
        .where(WorkOrder.id == work_order_id, WorkOrder.company_id == company_id)
        .options(
            selectinload(WorkOrder.tasks),
            selectinload(WorkOrder.client)
        )
    )
    result = await db.execute(stmt)
    wo = result.scalar_one_or_none()
    if not wo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Work order not found")
    return wo

@router.post("", response_model=WorkOrderOut, status_code=status.HTTP_201_CREATED)
async def create_work_order(company_id: int, payload: WorkOrderCreateIn, db: AsyncSession = Depends(get_db), _=Depends(require_company_access)):
    wo = WorkOrder(**payload.dict(), company_id=company_id)
    db.add(wo)
    await db.commit()
    return await get_full_work_order_or_404(company_id, wo.id, db)

@router.get("", response_model=List[WorkOrderOut])
async def list_work_orders(company_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_company_access)):
    """Získá seznam zakázek s plně načtenými vztahy."""
    # OPRAVA: Přidáno načítání 'tasks' i pro seznam
    stmt = (
        select(WorkOrder)
        .where(WorkOrder.company_id == company_id)
        .options(
            selectinload(WorkOrder.tasks),
            selectinload(WorkOrder.client)
        )
    )
    return (await db.execute(stmt)).scalars().all()

@router.get("/{work_order_id}", response_model=WorkOrderOut)
async def get_work_order(company_id: int, work_order_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_company_access)):
    return await get_full_work_order_or_404(company_id, work_order_id, db)

@router.patch("/{work_order_id}", response_model=WorkOrderOut, summary="Úprava zakázky")
async def update_work_order(company_id: int, work_order_id: int, payload: WorkOrderUpdateIn, db: AsyncSession = Depends(get_db), _=Depends(require_company_access)):
    # Zde načteme bez vztahů, protože je to pro úpravu efektivnější
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
    
    new_wo = WorkOrder(
        company_id=original_wo.company_id, client_id=original_wo.client_id,
        name=f"{original_wo.name} (Kopie)", description=original_wo.description,
        status="new"
    )
    new_tasks = [Task(name=task.name, description=task.description, status="todo") for task in original_wo.tasks]
    new_wo.tasks = new_tasks
    
    db.add(new_wo)
    await db.commit()
    
    return await get_full_work_order_or_404(company_id, new_wo.id, db)