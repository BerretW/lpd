from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import get_db
from app.db.models import WorkType
from app.schemas.work_type import WorkTypeCreateIn, WorkTypeOut
from app.routers.companies import require_company_access
from app.core.dependencies import require_admin_access # <--- Přidat import
from app.schemas.work_type import WorkTypeCreateIn, WorkTypeOut, WorkTypeUpdateIn # <--- Přidat WorkTypeUpdateIn
router = APIRouter(prefix="/companies/{company_id}/work-types", tags=["work-types"])

# Zde by měla být závislost na roli admin/owner
def require_admin_access(payload: dict = Depends(require_company_access)):
    return payload

@router.post("", response_model=WorkTypeOut, status_code=status.HTTP_201_CREATED)
async def create_work_type(company_id: int, payload: WorkTypeCreateIn, db: AsyncSession = Depends(get_db), _=Depends(require_admin_access)):
    wt = WorkType(**payload.dict(), company_id=company_id)
    db.add(wt)
    await db.commit()
    await db.refresh(wt)
    return wt

@router.get("", response_model=List[WorkTypeOut])
async def list_work_types(company_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_company_access)):
    stmt = select(WorkType).where(WorkType.company_id == company_id)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.patch("/{work_type_id}", response_model=WorkTypeOut, summary="Úprava typu práce")
async def update_work_type(
    company_id: int,
    work_type_id: int,
    payload: WorkTypeUpdateIn,
    db: AsyncSession = Depends(get_db),
    _ = Depends(require_admin_access) # Vyžadujeme admin práva pro úpravu sazeb
):
    stmt = select(WorkType).where(WorkType.id == work_type_id, WorkType.company_id == company_id)
    work_type = (await db.execute(stmt)).scalar_one_or_none()
    
    if not work_type:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Work type not found")

    update_data = payload.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(work_type, key, value)
    
    await db.commit()
    await db.refresh(work_type)
    return work_type