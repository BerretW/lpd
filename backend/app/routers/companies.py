# backend/app/routers/companies.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db
from app.db.models import Company
from app.schemas.company import CompanyOut, CompanyBillingInfoIn
from app.core.dependencies import require_company_access, require_admin_access

router = APIRouter(prefix="/companies", tags=["companies"])

@router.get("/{company_id}", response_model=CompanyOut, summary="Získání detailu společnosti")
async def get_company(
    company_id: int, 
    _=Depends(require_company_access), 
    db: AsyncSession = Depends(get_db)
):
    company = await db.get(Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company

@router.patch("/{company_id}/billing", response_model=CompanyOut, summary="Aktualizace fakturačních údajů firmy (pouze pro adminy)")
async def update_company_billing_info(
    company_id: int,
    payload: CompanyBillingInfoIn,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin_access)
):
    company = await db.get(Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
        
    update_data = payload.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(company, key, value)
        
    await db.commit()
    await db.refresh(company)
    return company