# app/routers/members.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List

from app.db.database import get_db
from app.db.models import Membership, User, RoleEnum
from app.routers.companies import require_company_access
from app.schemas.member import MemberOut, MemberUpdateIn

router = APIRouter(prefix="/companies/{company_id}/members", tags=["members"])

# Zde bychom vytvorili prisnejsi zavislost, ktera overuje, ze uzivatel je admin nebo owner
async def require_admin_access(
    company_id: int, # Získání company_id přímo z cesty
    payload: dict = Depends(require_company_access), 
    db: AsyncSession = Depends(get_db)
):
    user_id = int(payload.get("sub"))
    
    # Dotaz do databáze na roli daného uživatele v dané firmě
    stmt = select(Membership.role).where(
        Membership.user_id == user_id, 
        Membership.company_id == company_id
    )
    result = await db.execute(stmt)
    role = result.scalar_one_or_none()

    if role not in [RoleEnum.owner, RoleEnum.admin]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Admin or owner access required for this operation."
        )
    
    return payload

@router.get("", response_model=List[MemberOut])
async def list_company_members(company_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_company_access)):
    stmt = (
        select(Membership)
        .where(Membership.company_id == company_id)
        .options(selectinload(Membership.user))
    )
    result = await db.execute(stmt)
    members = result.scalars().all()
    return members

@router.patch("/{user_id}", response_model=MemberOut)
async def update_member_role(company_id: int, user_id: int, payload: MemberUpdateIn, db: AsyncSession = Depends(get_db), _=Depends(require_admin_access)):
    stmt = select(Membership).where(Membership.company_id == company_id, Membership.user_id == user_id)
    result = await db.execute(stmt)
    member = result.scalar_one_or_none()

    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    member.role = payload.role
    await db.commit()
    await db.refresh(member)
    return member

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(company_id: int, user_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_admin_access)):
    stmt = select(Membership).where(Membership.company_id == company_id, Membership.user_id == user_id)
    result = await db.execute(stmt)
    member = result.scalar_one_or_none()

    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    
    await db.delete(member)
    await db.commit()