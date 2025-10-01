from pydantic import BaseModel, EmailStr
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
