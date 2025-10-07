# app/schemas/member.py
from pydantic import BaseModel, EmailStr
from typing import List
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

class HoursBreakdown(BaseModel):
    """Detailní rozpad hodin podle typu."""
    type: str
    hours: float

class MonthlyHoursSummaryOut(BaseModel):
    """Finální struktura odpovědi pro měsíční souhrn hodin."""
    user_id: int
    user_email: EmailStr
    year: int
    month: int
    total_paid_hours: float
    total_unpaid_hours: float
    paid_breakdown: List[HoursBreakdown]
    unpaid_breakdown: List[HoursBreakdown]

class MemberCreateIn(BaseModel):
    """Schéma pro vytvoření nového člena."""
    email: EmailStr
    password: str
    role: RoleEnum = RoleEnum.member # Defaultní hodnota je 'member'