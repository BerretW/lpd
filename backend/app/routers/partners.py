from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db
from app.db.models import Manufacturer, Supplier
from app.schemas.partners import (
    ManufacturerCreateIn, ManufacturerOut,
    SupplierCreateIn, SupplierOut
)
from app.core.dependencies import require_company_access

router = APIRouter(prefix="/companies/{company_id}", tags=["partners"])

# --- MANUFACTURERS ---

@router.get("/manufacturers", response_model=List[ManufacturerOut])
async def list_manufacturers(
    company_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access)
):
    stmt = select(Manufacturer).where(Manufacturer.company_id == company_id).order_by(Manufacturer.name)
    return (await db.execute(stmt)).scalars().all()

@router.post("/manufacturers", response_model=ManufacturerOut, status_code=status.HTTP_201_CREATED)
async def create_manufacturer(
    company_id: int,
    payload: ManufacturerCreateIn,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access)
):
    # Kontrola duplicity
    stmt = select(Manufacturer).where(Manufacturer.company_id == company_id, Manufacturer.name == payload.name)
    if (await db.execute(stmt)).scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, f"Manufacturer '{payload.name}' already exists.")

    new_obj = Manufacturer(**payload.dict(), company_id=company_id)
    db.add(new_obj)
    await db.commit()
    await db.refresh(new_obj)
    return new_obj

# --- SUPPLIERS ---

@router.get("/suppliers", response_model=List[SupplierOut])
async def list_suppliers(
    company_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access)
):
    stmt = select(Supplier).where(Supplier.company_id == company_id).order_by(Supplier.name)
    return (await db.execute(stmt)).scalars().all()

@router.post("/suppliers", response_model=SupplierOut, status_code=status.HTTP_201_CREATED)
async def create_supplier(
    company_id: int,
    payload: SupplierCreateIn,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access)
):
    stmt = select(Supplier).where(Supplier.company_id == company_id, Supplier.name == payload.name)
    if (await db.execute(stmt)).scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, f"Supplier '{payload.name}' already exists.")

    new_obj = Supplier(**payload.dict(), company_id=company_id)
    db.add(new_obj)
    await db.commit()
    await db.refresh(new_obj)
    return new_obj