# app/schemas/member.py
from pydantic import BaseModel, EmailStr
from app.db.models import RoleEnum

# Schema pro zobrazeni detailu uzivatele v ramci clenstvi
class MemberUserOut(BaseModel):
    id: int
    email: EmailStr
    class Config: from_attributes = True

# Kompletni schema pro zobrazeni clena tymu
class MemberOut(BaseModel):
    user: MemberUserOut
    role: RoleEnum
    class Config: from_attributes = True

# Schema pro update role clena
class MemberUpdateIn(BaseModel):
    role: RoleEnum