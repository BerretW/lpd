# backend/app/core/dependencies.py
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import jwt, JWTError
from typing import Dict

from app.core.config import settings
from app.db.database import get_db
from app.db.models import Membership, RoleEnum

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def require_company_access(
    company_id: int,
    token: str = Depends(oauth2_scheme)
) -> Dict:
    """
    Závislost, která ověří, že uživatel má v JWT tokenu přístup k dané company_id.
    Vrací dekódovaný payload tokenu.
    """
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALG])
        user_id = payload.get("sub")
        tenants = payload.get("tenants", [])
        
        if user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
            
        if company_id not in tenants:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No access to this company")
            
        return payload
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

async def require_admin_access(
    company_id: int,
    payload: dict = Depends(require_company_access), 
    db: AsyncSession = Depends(get_db)
) -> Dict:
    """
    Závislost, která ověří, že uživatel je 'owner' nebo 'admin' v dané společnosti.
    Vrací dekódovaný payload tokenu.
    """
    user_id = int(payload.get("sub"))
    
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

