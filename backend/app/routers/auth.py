# app/routers/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
# --- PŘIDÁN NOVÝ IMPORT ---
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from jose import jwt, JWTError

from app.db.database import get_db
from app.core.config import settings
from app.core.security import create_access_token
# --- LoginIn už nepotřebujeme pro tento endpoint ---
from app.schemas.auth import TokenOut
from app.schemas.company import RegisterCompanyIn, CompanyOut
from app.db.models import Company, User, Membership, RoleEnum
from app.services.user_service import get_user_by_email, create_user, add_membership
from sqlalchemy import select

router = APIRouter(prefix="/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

@router.post("/register_company", response_model=CompanyOut, status_code=201)
async def register_company(payload: RegisterCompanyIn, db: AsyncSession = Depends(get_db)):
    # ... (tato funkce zůstává beze změny)
    c = Company(name=payload.company_name, slug=payload.slug, logo_url=payload.logo_url)
    db.add(c)
    await db.flush()
    u = await get_user_by_email(db, payload.admin_email)
    if not u:
        u = await create_user(db, payload.admin_email, payload.admin_password)
    await add_membership(db, user_id=u.id, company_id=c.id, role=RoleEnum.owner)
    await db.commit()
    await db.refresh(c)
    return c

@router.post("/login", response_model=TokenOut)
# --- ZMĚNA ZDE ---
async def login(form: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    from app.services.user_service import verify_user_password
    
    # --- A ZMĚNA ZDE ---
    # Místo form.email používáme form.username, jak očekává OAuth2 standard
    user = await verify_user_password(db, form.username, form.password)
    
    if not user:
        # FastAPI pro OAuth2 vyžaduje specifickou hlavičku, pokud selže autentizace
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    # Zbytek funkce zůstává stejný
    res = await db.execute(select(Membership.company_id).where(Membership.user_id == user.id))
    tenant_ids = [row[0] for row in res.all()]
    token = create_access_token(str(user.id), extra={"tenants": tenant_ids})
    return TokenOut(access_token=token)