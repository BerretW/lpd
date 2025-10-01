from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import jwt, JWTError
from fastapi.security import OAuth2PasswordBearer
from app.core.config import settings
from app.db.database import get_db
from app.db.models import Company
from app.schemas.company import CompanyOut

router = APIRouter(prefix="/companies", tags=["companies"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def require_company_access(token: str = Depends(oauth2_scheme), company_id: int | None = None):
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALG])
        tenants = payload.get("tenants", [])
        if company_id is not None and company_id not in tenants:
            raise HTTPException(status_code=403, detail="No access to this company")
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

@router.get("/{company_id}", response_model=CompanyOut)
async def get_company(company_id: int, _=Depends(require_company_access), db: AsyncSession = Depends(get_db)):
    from app.db.models import Company
    res = await db.execute(select(Company).where(Company.id == company_id))
    c = res.scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Company not found")
    return c
