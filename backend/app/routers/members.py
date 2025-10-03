# backend/app/routers/members.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List

from app.db.database import get_db
from app.db.models import Membership
from app.schemas.member import MemberOut, MemberUpdateIn
from app.core.dependencies import require_company_access, require_admin_access

router = APIRouter(prefix="/companies/{company_id}/members", tags=["members"])

@router.get("", response_model=List[MemberOut])
async def list_company_members(
    company_id: int, 
    db: AsyncSession = Depends(get_db), 
    _=Depends(require_company_access)
):
    stmt = select(Membership).where(Membership.company_id == company_id).options(selectinload(Membership.user))
    result = await db.execute(stmt)
    return result.scalars().all()

@router.patch("/{user_id}", response_model=MemberOut)
async def update_member_role(
    company_id: int, user_id: int, payload: MemberUpdateIn, 
    db: AsyncSession = Depends(get_db), 
    _=Depends(require_admin_access)
):
    stmt = select(Membership).where(Membership.company_id == company_id, Membership.user_id == user_id)
    member = (await db.execute(stmt)).scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    member.role = payload.role
    await db.commit()
    await db.refresh(member)
    return member

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    company_id: int, user_id: int, 
    db: AsyncSession = Depends(get_db), 
    _=Depends(require_admin_access)
):
    stmt = select(Membership).where(Membership.company_id == company_id, Membership.user_id == user_id)
    member = (await db.execute(stmt)).scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    
    await db.delete(member)
    await db.commit()