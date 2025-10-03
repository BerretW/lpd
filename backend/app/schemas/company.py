from pydantic import BaseModel, EmailStr
from typing import Optional
from app.db.models import RoleEnum

class RegisterCompanyIn(BaseModel):
    company_name: str
    slug: str
    admin_email: EmailStr
    admin_password: str
    logo_url: str | None = None

class CompanyOut(BaseModel):
    id: int
    name: str
    slug: str
    logo_url: str | None = None
    class Config: from_attributes = True

class CompanyBillingInfoIn(BaseModel):
    """Schéma pro aktualizaci fakturačních údajů firmy."""
    legal_name: Optional[str] = None
    address: Optional[str] = None
    ico: Optional[str] = None
    dic: Optional[str] = None
    executive: Optional[str] = None
    bank_account: Optional[str] = None
    iban: Optional[str] = None

class CompanyOut(BaseModel):
    id: int
    name: str
    slug: str
    logo_url: Optional[str] = None
    
    # --- ZOBRAZENÍ FAKTURAČNÍCH ÚDAJŮ V ODPOVĚDI ---
    legal_name: Optional[str] = None
    address: Optional[str] = None
    ico: Optional[str] = None
    dic: Optional[str] = None
    executive: Optional[str] = None
    bank_account: Optional[str] = None
    iban: Optional[str] = None
    
    class Config:
        from_attributes = True