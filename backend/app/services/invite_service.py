import secrets
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.models import Invite, RoleEnum

async def create_invite(db: AsyncSession, company_id: int, email: str, role: RoleEnum, ttl_minutes: int) -> Invite:
    token = secrets.token_urlsafe(32)
    inv = Invite(
        company_id=company_id,
        email=email,
        role=role,
        token=token,
        expires_at=datetime.utcnow() + timedelta(minutes=ttl_minutes),
    )
    db.add(inv)
    await db.flush()
    return inv

async def get_invite_by_token(db: AsyncSession, token: str) -> Invite | None:
    res = await db.execute(select(Invite).where(Invite.token == token))
    return res.scalar_one_or_none()
