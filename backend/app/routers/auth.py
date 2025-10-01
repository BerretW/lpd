from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from jose import jwt, JWTError
from fastapi.security import OAuth2PasswordBearer
from app.db.database import get_db
from app.core.config import settings
from app.core.security import create_access_token
from app.schemas.auth import LoginIn, TokenOut
from app.schemas.company import RegisterCompanyIn, CompanyOut
from app.db.models import Company, User, Membership, RoleEnum
from app.services.user_service import get_user_by_email, create_user, add_membership
from sqlalchemy import select

router = APIRouter(prefix="/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

@router.post("/register_company", response_model=CompanyOut, status_code=201)
async def register_company(payload: RegisterCompanyIn, db: AsyncSession = Depends(get_db)):
    # 1) create company
    c = Company(name=payload.company_name, slug=payload.slug, logo_url=payload.logo_url)
    db.add(c)
    await db.flush()
    # 2) create or reuse admin user
    u = await get_user_by_email(db, payload.admin_email)
    if not u:
        u = await create_user(db, payload.admin_email, payload.admin_password)
    # 3) owner membership
    await add_membership(db, user_id=u.id, company_id=c.id, role=RoleEnum.owner)
    await db.commit()
    await db.refresh(c)
    return c

@router.post("/login", response_model=TokenOut)
async def login(form: LoginIn, db: AsyncSession = Depends(get_db)):
    from app.services.user_service import verify_user_password
    user = await verify_user_password(db, form.email, form.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    # default tenant ids pro token (pro jednoduchost: všechny company_id, kde je členem)
    from sqlalchemy import select
    res = await db.execute(select(Membership.company_id).where(Membership.user_id == user.id))
    tenant_ids = [row[0] for row in res.all()]
    token = create_access_token(str(user.id), extra={"tenants": tenant_ids})
    return TokenOut(access_token=token)
