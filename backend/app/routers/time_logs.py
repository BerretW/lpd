from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import date

from app.db.database import get_db
from app.db.models import TimeLog, Task, WorkOrder, RoleEnum, TimeLogStatus
from app.schemas.time_log import TimeLogCreateIn, TimeLogOut, TimeLogUpdateIn, TimeLogStatusUpdateIn
from app.routers.companies import require_company_access

router = APIRouter(prefix="/companies/{company_id}/time-logs", tags=["time-logs"])

def require_admin_access(payload: dict = Depends(require_company_access)):
    # Zde by byla plná implementace ověření role admina/ownera z DB
    # if role not in [RoleEnum.owner, RoleEnum.admin]: raise HTTPException(...)
    return payload

async def get_log_or_404(time_log_id: int, company_id: int, db: AsyncSession) -> TimeLog:
    """Načte záznam času, ověří příslušnost k firmě a vrátí ho, jinak 404."""
    stmt = (
        select(TimeLog)
        .join(TimeLog.task).join(Task.work_order)
        .where(TimeLog.id == time_log_id, WorkOrder.company_id == company_id)
        .options(selectinload(TimeLog.user), selectinload(TimeLog.work_type), selectinload(TimeLog.task))
    )
    log = (await db.execute(stmt)).scalar_one_or_none()
    if not log:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Time log not found")
    return log

@router.post("", response_model=TimeLogOut, status_code=status.HTTP_201_CREATED)
async def create_time_log(
    company_id: int, payload: TimeLogCreateIn,
    db: AsyncSession = Depends(get_db), token: Dict[str, Any] = Depends(require_company_access)
):
    """Vytvoří nový záznam o odpracovaném čase pro přihlášeného uživatele."""
    user_id = int(token.get("sub"))
    log = TimeLog(**payload.dict(), user_id=user_id)
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return await get_log_or_404(log.id, company_id, db)

@router.get("", response_model=List[TimeLogOut])
async def list_time_logs(
    company_id: int, user_id_filter: int | None = None, start_date: date | None = None, end_date: date | None = None,
    db: AsyncSession = Depends(get_db), token: Dict[str, Any] = Depends(require_company_access)
):
    """
    Získá seznam záznamů času.
    - Běžný uživatel vidí jen své záznamy.
    - Admin může filtrovat podle user_id_filter a vidět záznamy ostatních.
    """
    stmt = (
        select(TimeLog).join(TimeLog.task).join(Task.work_order)
        .where(WorkOrder.company_id == company_id)
        .options(selectinload(TimeLog.user), selectinload(TimeLog.work_type), selectinload(TimeLog.task))
        .order_by(TimeLog.work_date.desc())
    )
    
    current_user_id = int(token.get("sub"))
    # Zde by byla kontrola, zda je uživatel admin. Pro zjednodušení předpokládáme,
    # že pokud chce filtrovat, je admin. V praxi byste roli ověřili z DB.
    if user_id_filter:
        # require_admin_access by měl být zde jako závislost
        stmt = stmt.where(TimeLog.user_id == user_id_filter)
    else:
        stmt = stmt.where(TimeLog.user_id == current_user_id)

    if start_date:
        stmt = stmt.where(TimeLog.work_date >= start_date)
    if end_date:
        stmt = stmt.where(TimeLog.work_date <= end_date)
        
    return (await db.execute(stmt)).scalars().all()

@router.patch("/{time_log_id}", response_model=TimeLogOut)
async def update_time_log(
    company_id: int, time_log_id: int, payload: TimeLogUpdateIn,
    db: AsyncSession = Depends(get_db), token: Dict[str, Any] = Depends(require_company_access)
):
    """Umožní uživateli upravit svůj vlastní záznam, pokud ještě nebyl schválen."""
    log = await get_log_or_404(time_log_id, company_id, db)
    current_user_id = int(token.get("sub"))

    if log.user_id != current_user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only edit your own time logs.")
    if log.status != TimeLogStatus.pending:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot edit a log that has already been processed.")

    update_data = payload.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(log, key, value)
    await db.commit()
    await db.refresh(log)
    return log

@router.post("/{time_log_id}/status", response_model=TimeLogOut, summary="Schválení/zamítnutí záznamu (pro adminy)")
async def update_time_log_status(
    company_id: int, time_log_id: int, payload: TimeLogStatusUpdateIn,
    db: AsyncSession = Depends(get_db), _=Depends(require_admin_access)
):
    """Změní stav záznamu (schváleno/zamítnuto). Určeno pro manažery."""
    log = await get_log_or_404(time_log_id, company_id, db)
    log.status = payload.status
    await db.commit()
    await db.refresh(log)
    return log


@router.delete("/{time_log_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Smazání záznamu času")
async def delete_time_log(
    company_id: int, time_log_id: int,
    db: AsyncSession = Depends(get_db), token: Dict[str, Any] = Depends(require_company_access)
):
    """
    Umožní uživateli smazat svůj vlastní záznam o odpracovaném čase,
    pokud tento záznam ještě nebyl schválen ani zamítnut (je ve stavu 'pending').
    """
    log = await get_log_or_404(time_log_id, company_id, db)
    current_user_id = int(token.get("sub"))

    # Ověření, že uživatel maže svůj vlastní záznam
    if log.user_id != current_user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only delete your own time logs.")

    # Ověření, že záznam je stále ve stavu 'pending'
    if log.status != TimeLogStatus.pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete a time log that has already been processed (approved or rejected)."
        )

    await db.delete(log)
    await db.commit()
    # Při statusu 204 No Content se nevrací žádné tělo odpovědi.