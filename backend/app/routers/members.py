# backend/app/routers/members.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List
from datetime import datetime, timedelta
import calendar
from collections import defaultdict

from app.db.database import get_db
from app.db.models import (
    Membership, User, TimeLog, TimeLogEntryType, RoleEnum,
    Task, WorkOrder, UsedInventoryItem
)
# --- PŘIDÁN IMPORT nového schématu a servisních funkcí ---
from app.schemas.member import MemberOut, MemberUpdateIn, MonthlyHoursSummaryOut, HoursBreakdown, MemberCreateIn
from app.schemas.task import AssignedTaskOut
from app.services.user_service import get_user_by_email, create_user
from app.core.dependencies import require_company_access, require_admin_access

router = APIRouter(prefix="/companies/{company_id}/members", tags=["members"])

async def get_member_or_404(company_id: int, user_id: int, db: AsyncSession) -> Membership:
    """Načte člena firmy nebo vyvolá chybu 404."""
    stmt = (
        select(Membership)
        .where(Membership.company_id == company_id, Membership.user_id == user_id)
        .options(selectinload(Membership.user))
    )
    member = (await db.execute(stmt)).scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found in this company")
    return member

# --- NOVÝ ENDPOINT PRO VYTVOŘENÍ ČLENA ---

@router.post(
    "", 
    response_model=MemberOut, 
    status_code=status.HTTP_201_CREATED,
    summary="Přidání nového člena do firmy (pouze pro adminy)"
)
async def create_member(
    company_id: int,
    payload: MemberCreateIn,
    db: AsyncSession = Depends(get_db),
    _ = Depends(require_admin_access)
):
    """
    Vytvoří nového uživatele (pokud ještě neexistuje) a rovnou ho přidá jako
    člena do firmy s danou rolí. Pokud uživatel existuje, jen ho přidá do firmy.
    """
    # 1. Zjistíme, zda uživatel s daným e-mailem existuje
    user = await get_user_by_email(db, payload.email)

    if user:
        # Uživatel existuje, zkontrolujeme, zda už není členem této firmy
        stmt = select(Membership).where(
            Membership.user_id == user.id,
            Membership.company_id == company_id
        )
        existing_membership = (await db.execute(stmt)).scalar_one_or_none()
        if existing_membership:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User with this email is already a member of this company."
            )
    else:
        # Uživatel neexistuje, vytvoříme ho
        user = await create_user(db, payload.email, payload.password)
        # Není potřeba flush/commit, create_user se o to postará

    # 2. Vytvoříme nové členství
    new_membership = Membership(
        user_id=user.id,
        company_id=company_id,
        role=payload.role
    )
    db.add(new_membership)
    await db.commit()
    
    # 3. Načteme čerstvá data pro správnou odpověď
    await db.refresh(new_membership, attribute_names=['user'])
    
    return new_membership

# --- STÁVAJÍCÍ ENDPOINTY ---

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
    member = await get_member_or_404(company_id, user_id, db)
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
    member = await get_member_or_404(company_id, user_id, db)
    await db.delete(member)
    await db.commit()


@router.get(
    "/{user_id}/tasks",
    response_model=List[AssignedTaskOut],
    summary="Získání všech úkolů přiřazených konkrétnímu členovi"
)
async def get_assigned_tasks_for_member(
    company_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db),
    payload: dict = Depends(require_company_access)
):
    """
    Vrátí seznam všech úkolů přiřazených danému uživateli (`user_id`).
    - Běžný uživatel může zobrazit pouze své vlastní úkoly.
    - Admin nebo vlastník může zobrazit úkoly libovolného člena firmy.
    """
    requesting_user_id = int(payload.get("sub"))
    
    # Ověření, zda je uživatel, jehož úkoly chceme vidět, vůbec členem firmy
    member_to_view = await get_member_or_404(company_id, user_id, db)

    # Autorizační logika
    if requesting_user_id != user_id:
        # Pokud se uživatel snaží zobrazit úkoly někoho jiného, ověříme, zda je admin
        stmt_role = select(Membership.role).where(
            Membership.user_id == requesting_user_id,
            Membership.company_id == company_id
        )
        role = (await db.execute(stmt_role)).scalar_one_or_none()
        if role not in [RoleEnum.owner, RoleEnum.admin]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only view your own assigned tasks."
            )

    # Sestavení dotazu pro načtení úkolů
    stmt = (
        select(Task)
        .join(Task.work_order)
        .where(
            Task.assignee_id == user_id,
            WorkOrder.company_id == company_id
        )
        .options(
            selectinload(Task.work_order).selectinload(WorkOrder.client),
            selectinload(Task.assignee),
            selectinload(Task.used_items).selectinload(UsedInventoryItem.inventory_item)
        )
        .order_by(Task.created_at.desc())
    )
    
    result = await db.execute(stmt)
    return result.scalars().all()

@router.get(
    "/{user_id}/hours-summary",
    response_model=MonthlyHoursSummaryOut,
    summary="Získání měsíčního souhrnu hodin zaměstnance (pouze pro adminy)"
)
async def get_member_monthly_hours_summary(
    company_id: int,
    user_id: int,
    year: int,
    month: int,
    db: AsyncSession = Depends(get_db),
    _ = Depends(require_admin_access)
):
    # ... (tato funkce zůstává beze změny)
    member = await get_member_or_404(company_id, user_id, db)
    try:
        _, num_days = calendar.monthrange(year, month)
        start_date = datetime(year, month, 1)
        end_date = datetime(year, month, num_days, 23, 59, 59)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid year or month")
    stmt = select(TimeLog).where(
        TimeLog.user_id == user_id,
        TimeLog.company_id == company_id,
        TimeLog.start_time >= start_date,
        TimeLog.start_time <= end_date
    )
    time_logs = (await db.execute(stmt)).scalars().all()
    PAID_TYPES = {TimeLogEntryType.WORK, TimeLogEntryType.VACATION, TimeLogEntryType.SICK_DAY, TimeLogEntryType.DOCTOR}
    paid_hours_breakdown = defaultdict(float)
    unpaid_hours_breakdown = defaultdict(float)
    for log in time_logs:
        duration_hours = (log.end_time - log.start_time).total_seconds() / 3600
        duration_hours -= log.break_duration_minutes / 60
        entry_type_str = log.entry_type.value
        if log.entry_type in PAID_TYPES:
            paid_hours_breakdown[entry_type_str] += duration_hours
        else:
            unpaid_hours_breakdown[entry_type_str] += duration_hours
    total_paid = sum(paid_hours_breakdown.values())
    total_unpaid = sum(unpaid_hours_breakdown.values())
    return MonthlyHoursSummaryOut(
        user_id=user_id, user_email=member.user.email, year=year, month=month,
        total_paid_hours=round(total_paid, 2), total_unpaid_hours=round(total_unpaid, 2),
        paid_breakdown=[HoursBreakdown(type=k, hours=round(v, 2)) for k, v in paid_hours_breakdown.items()],
        unpaid_breakdown=[HoursBreakdown(type=k, hours=round(v, 2)) for k, v in unpaid_hours_breakdown.items()]
    )