# backend/app/routers/triggers.py
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db
from app.db.models import NotificationTrigger
from app.schemas.trigger import (
    NotificationTriggerCreateIn,
    NotificationTriggerOut,
    NotificationTriggerUpdateIn
)
from app.core.dependencies import require_admin_access

router = APIRouter(prefix="/companies/{company_id}/triggers", tags=["notification-triggers"])

async def get_trigger_or_404(db: AsyncSession, company_id: int, trigger_id: int) -> NotificationTrigger:
    trigger = await db.get(NotificationTrigger, trigger_id)
    if not trigger or trigger.company_id != company_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trigger not found")
    return trigger

@router.post("", response_model=NotificationTriggerOut, status_code=status.HTTP_201_CREATED)
async def create_trigger(
    company_id: int,
    payload: NotificationTriggerCreateIn,
    db: AsyncSession = Depends(get_db),
    _ = Depends(require_admin_access)
):
    stmt = select(NotificationTrigger).where(
        NotificationTrigger.company_id == company_id,
        NotificationTrigger.trigger_type == payload.trigger_type
    )
    if (await db.execute(stmt)).scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
            detail=f"Trigger of type '{payload.trigger_type.value}' already exists for this company.")

    trigger = NotificationTrigger(**payload.dict(), company_id=company_id)
    db.add(trigger)
    await db.commit()
    await db.refresh(trigger)
    return trigger

@router.get("", response_model=List[NotificationTriggerOut])
async def list_triggers(
    company_id: int,
    db: AsyncSession = Depends(get_db),
    _ = Depends(require_admin_access)
):
    stmt = select(NotificationTrigger).where(NotificationTrigger.company_id == company_id)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.patch("/{trigger_id}", response_model=NotificationTriggerOut)
async def update_trigger(
    company_id: int,
    trigger_id: int,
    payload: NotificationTriggerUpdateIn,
    db: AsyncSession = Depends(get_db),
    _ = Depends(require_admin_access)
):
    trigger = await get_trigger_or_404(db, company_id, trigger_id)
    update_data = payload.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(trigger, key, value)
    await db.commit()
    await db.refresh(trigger)
    return trigger

@router.delete("/{trigger_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_trigger(
    company_id: int,
    trigger_id: int,
    db: AsyncSession = Depends(get_db),
    _ = Depends(require_admin_access)
):
    trigger = await get_trigger_or_404(db, company_id, trigger_id)
    await db.delete(trigger)
    await db.commit()