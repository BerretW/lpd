from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.models import User, Membership, Company, RoleEnum
from app.core.security import hash_password, verify_password

async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    res = await db.execute(select(User).where(User.email == email))
    return res.scalar_one_or_none()

async def create_user(db: AsyncSession, email: str, password: str) -> User:
    u = User(email=email, password_hash=hash_password(password))
    db.add(u)
    await db.flush()
    return u

async def add_membership(db: AsyncSession, user_id: int, company_id: int, role: RoleEnum):
    m = Membership(user_id=user_id, company_id=company_id, role=role)
    db.add(m)
    await db.flush()
    return m

async def verify_user_password(db: AsyncSession, email: str, password: str) -> User | None:
    u = await get_user_by_email(db, email)
    if not u: return None
    if not verify_password(password, u.password_hash): return None
    return u
