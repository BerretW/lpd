from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from app.db.database import get_db
from app.db.models import Invite, Membership, RoleEnum
from app.schemas.invite import InviteCreateIn, InviteOut, InviteAcceptIn
from app.schemas.user import UserOut
from app.services.invite_service import create_invite, get_invite_by_token
from app.services.user_service import get_user_by_email, create_user, add_membership
from app.routers.companies import require_company_access
from app.services.email_service import send_transactional_email

router = APIRouter(prefix="/invites", tags=["invites"])

@router.post("/companies/{company_id}", response_model=InviteOut, status_code=201)
async def create_company_invite(company_id: int, body: InviteCreateIn,
                                _=Depends(lambda token=Depends(require_company_access): token),
                                db: AsyncSession = Depends(get_db)):
    inv = await create_invite(db, company_id=company_id, email=body.email, role=body.role, ttl_minutes=body.ttl_minutes)
    await db.commit()
    await db.refresh(inv)

    # --- ODESLÁNÍ E-MAILU ---
    # Toto by v reálné aplikaci mělo běžet na pozadí (např. přes Celery/RQ)
    # aby neblokovalo HTTP odpověď. Pro jednoduchost to zde voláme přímo.
    await send_transactional_email(
        db,
        company_id=company_id,
        notification_type="on_invite_created", # Klíč, který bude v JSON nastavení
        recipient=inv.email,
        subject="Pozvánka do společnosti",
        body=f"Byli jste pozváni do společnosti. Pro přijetí pozvánky použijte tento token: {inv.token}"
    )

    return inv

@router.post("/accept", response_model=UserOut)
async def accept_invite(body: InviteAcceptIn, db: AsyncSession = Depends(get_db)):
    inv = await get_invite_by_token(db, body.token)
    if not inv or inv.expires_at < datetime.utcnow():
        raise HTTPException(400, "Invite invalid or expired")
    user = await get_user_by_email(db, inv.email)
    if not user:
        # uživatel neexistuje -> vytvoř
        pwd = body.password or "ChangeMe123!"  # v praxi vyžaduj heslo
        user = await create_user(db, inv.email, pwd)
    # přidej členství (idempotentně)
    exists = await db.execute(select(Membership).where(Membership.user_id == user.id, Membership.company_id == inv.company_id))
    if not exists.scalar_one_or_none():
        await add_membership(db, user.id, inv.company_id, inv.role)
    inv.accepted_at = datetime.utcnow()
    await db.commit()
    await db.refresh(user)
    return user
