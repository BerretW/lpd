from datetime import datetime, timedelta
from pydantic import BaseModel, EmailStr
from app.db.models import RoleEnum

class InviteCreateIn(BaseModel):
    email: EmailStr
    role: RoleEnum = RoleEnum.member
    ttl_minutes: int = 7*24*60  # 7 dní default

class InviteOut(BaseModel):
    id: int
    email: EmailStr
    role: RoleEnum
    token: str
    expires_at: datetime
    class Config: from_attributes = True

class InviteAcceptIn(BaseModel):
    token: str
    password: str | None = None  # pokud uživatel neexistuje, může si nastavit heslo
