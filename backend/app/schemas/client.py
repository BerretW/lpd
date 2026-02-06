# app/schemas/client.py
from pydantic import BaseModel, ConfigDict, EmailStr
from typing import Optional, List
# Importujeme sdílená schémata z nového souboru
from .shared import BillingReportTimeLogOut, BillingReportUsedItemOut

class ClientBase(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    legal_name: Optional[str] = None
    contact_person: Optional[str] = None
    ico: Optional[str] = None
    dic: Optional[str] = None
    margin_percentage: Optional[float] = None

class ClientCreateIn(ClientBase):
    pass

class ClientUpdateIn(ClientBase):
    pass

class ClientOut(ClientBase):
    id: int
    company_id: int
    model_config = ConfigDict(from_attributes=True)

class ClientBillingReportOut(BaseModel):
    """Kompletní report s podklady pro fakturaci pro jednoho klienta."""
    client_name: str
    total_hours: float
    total_price_work: float
    total_price_inventory: float
    grand_total: float
    time_logs: List[BillingReportTimeLogOut]
    used_items: List[BillingReportUsedItemOut]