from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import get_db
from app.db.models import User
from app.core.dependencies import oauth2_scheme
from jose import jwt
from app.core.config import settings
from pydantic import BaseModel, EmailStr

router = APIRouter(prefix="/users", tags=["users"])

class UserUpdateIn(BaseModel):
    email: EmailStr

@router.get("/me")
async def get_me(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)):
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALG])
    user_id = int(payload.get("sub"))
    user = await db.get(User, user_id)
    return {"id": user.id, "email": user.email}

@router.patch("/me")
async def update_me(payload: UserUpdateIn, token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)):
    token_payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALG])
    user_id = int(token_payload.get("sub"))
    user = await db.get(User, user_id)
    
    # Kontrola, zda email už neexistuje
    from sqlalchemy import select
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Email už používá někdo jiný")
        
    user.email = payload.email
    await db.commit()
    return {"status": "ok", "email": user.email}