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
def require_admin_access(payload: dict = Depends(require_company_access)):
    # Toto je zjednodusena ukazka, v realite byste roli ziskali z databaze
    # a zkontrolovali ji vuci company_id.
    # Pro jednoduchost ted predpokladame, ze payload muze obsahovat i roli.
    # V praxi byste dekodovali user_id z tokenu a dotazali se na jeho roli v dane firme.
    # if payload.get("role") not in [RoleEnum.owner, RoleEnum.admin]:
    #     raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
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