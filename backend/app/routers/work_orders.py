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
    """Pomocná funkce pro načtení zakázky s plně načtenými vztahy."""
    query = select(WorkOrder).where(WorkOrder.id == work_order_id, WorkOrder.company_id == company_id)
    if load_relations:
        query = query.options(
            selectinload(WorkOrder.tasks),
            selectinload(WorkOrder.client)
        )
    
    result = await db.execute(query)
    wo = result.scalar_one_or_none()
    if not wo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Work order not found")
    return wo

@router.post("", response_model=WorkOrderOut, status_code=status.HTTP_201_CREATED)
async def create_work_order(company_id: int, payload: WorkOrderCreateIn, db: AsyncSession = Depends(get_db), _=Depends(require_company_access)):
    """Vytvoří zakázku a vrátí ji s plně načtenými daty."""
    wo = WorkOrder(**payload.dict(), company_id=company_id)
    db.add(wo)
    await db.commit()
    
    # OPRAVA: Místo db.refresh() použijeme naši pomocnou funkci pro načtení všech vztahů
    full_wo = await get_work_order_or_404(company_id, wo.id, db)
    return full_wo

@router.get("", response_model=List[WorkOrderOut])
async def list_work_orders(company_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_company_access)):
    """Získá seznam zakázek (pro seznam stačí načíst jen klienta)."""
    stmt = select(WorkOrder).where(WorkOrder.company_id == company_id).options(selectinload(WorkOrder.client))
    return (await db.execute(stmt)).scalars().all()

@router.get("/{work_order_id}", response_model=WorkOrderOut)
async def get_work_order(company_id: int, work_order_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_company_access)):
    """Získá detail jedné zakázky s plně načtenými daty."""
    return await get_work_order_or_404(company_id, work_order_id, db)

@router.patch("/{work_order_id}", response_model=WorkOrderOut, summary="Úprava zakázky")
async def update_work_order(company_id: int, work_order_id: int, payload: WorkOrderUpdateIn, db: AsyncSession = Depends(get_db), _=Depends(require_company_access)):
    """Upraví zakázku a vrátí ji s plně načtenými daty."""
    # Zde načteme bez vztahů, protože je budeme aktualizovat
    wo = await get_work_order_or_404(company_id, work_order_id, db, load_relations=False)
    update_data = payload.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(wo, key, value)
    await db.commit()
    
    # OPRAVA: Po uložení znovu načteme s plnými daty pro odpověď
    full_wo = await get_work_order_or_404(company_id, work_order_id, db)
    return full_wo

@router.post("/{work_order_id}/status", response_model=WorkOrderOut, summary="Změna stavu zakázky")
async def update_work_order_status(company_id: int, work_order_id: int, payload: WorkOrderStatusUpdateIn, db: AsyncSession = Depends(get_db), _=Depends(require_company_access)):
    """Změní stav zakázky a vrátí ji s plně načtenými daty."""
    wo = await get_work_order_or_404(company_id, work_order_id, db, load_relations=False)
    wo.status = payload.status
    await db.commit()
    
    # OPRAVA: Po uložení znovu načteme s plnými daty pro odpověď
    full_wo = await get_work_order_or_404(company_id, work_order_id, db)
    return full_wo

@router.post("/{work_order_id}/copy", response_model=WorkOrderOut, status_code=status.HTTP_201_CREATED, summary="Kopírování zakázky")
async def copy_work_order(company_id: int, work_order_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_company_access)):
    """Vytvoří hlubokou kopii zakázky a vrátí ji s plně načtenými daty."""
    original_wo = await get_work_order_or_404(company_id, work_order_id, db, load_relations=True)
    
    new_wo = WorkOrder(
        company_id=original_wo.company_id, client_id=original_wo.client_id,
        name=f"{original_wo.name} (Kopie)", description=original_wo.description,
        status="new"
    )
    new_tasks = [Task(name=task.name, description=task.description, status="todo") for task in original_wo.tasks]
    new_wo.tasks = new_tasks
    
    db.add(new_wo)
    await db.commit()
    
    # OPRAVA: Po uložení znovu načteme s plnými daty pro odpověď
    full_wo = await get_work_order_or_404(company_id, new_wo.id, db)
    return full_wo