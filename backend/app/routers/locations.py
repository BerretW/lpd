# backend/app/routers/locations.py
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import get_db
from app.db.models import Location, ItemLocationStock
from app.schemas.location import LocationCreateIn, LocationOut, LocationUpdateIn
from app.core.dependencies import require_admin_access

router = APIRouter(prefix="/companies/{company_id}/locations", tags=["inventory-locations"])

async def get_location_or_404(db: AsyncSession, company_id: int, location_id: int) -> Location:
    stmt = select(Location).where(Location.id == location_id, Location.company_id == company_id)
    location = (await db.execute(stmt)).scalar_one_or_none()
    if not location:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")
    return location

@router.post("", response_model=LocationOut, status_code=status.HTTP_201_CREATED)
async def create_location(
    company_id: int,
    payload: LocationCreateIn,
    db: AsyncSession = Depends(get_db),
    _ = Depends(require_admin_access)
):
    location = Location(**payload.dict(), company_id=company_id)
    db.add(location)
    await db.commit()
    await db.refresh(location)
    return location

@router.get("", response_model=List[LocationOut])
async def list_locations(
    company_id: int,
    db: AsyncSession = Depends(get_db),
    _ = Depends(require_admin_access)
):
    stmt = select(Location).where(Location.company_id == company_id).order_by(Location.name)
    return (await db.execute(stmt)).scalars().all()

@router.patch("/{location_id}", response_model=LocationOut)
async def update_location(
    company_id: int,
    location_id: int,
    payload: LocationUpdateIn,
    db: AsyncSession = Depends(get_db),
    _ = Depends(require_admin_access)
):
    location = await get_location_or_404(db, company_id, location_id)
    update_data = payload.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(location, key, value)
    await db.commit()
    await db.refresh(location)
    return location

@router.delete("/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_location(
    company_id: int,
    location_id: int,
    db: AsyncSession = Depends(get_db),
    _ = Depends(require_admin_access)
):
    location = await get_location_or_404(db, company_id, location_id)
    
    # Zkontrolujeme, zda na lokaci není nějaké zboží
    stmt = select(ItemLocationStock).where(ItemLocationStock.location_id == location_id, ItemLocationStock.quantity > 0).limit(1)
    if (await db.execute(stmt)).scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete location with stock. Please move items first."
        )
        
    await db.delete(location)
    await db.commit()