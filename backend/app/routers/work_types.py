from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import get_db
from app.db.models import WorkType
from app.schemas.work_type import WorkTypeCreateIn, WorkTypeOut
from app.routers.companies import require_company_access

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