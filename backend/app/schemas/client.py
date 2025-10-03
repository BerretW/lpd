# app/schemas/client.py
from pydantic import BaseModel, ConfigDict, EmailStr
from typing import Optional

class ClientBase(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    # --- PŘIDÁNÍ FAKTURAČNÍCH ÚDAJŮ ---
    legal_name: Optional[str] = None
    contact_person: Optional[str] = None
    ico: Optional[str] = None
    dic: Optional[str] = None

class ClientCreateIn(ClientBase):
    pass

class ClientUpdateIn(ClientBase):
    pass # Toto schéma již automaticky pokryje nová pole

class ClientOut(ClientBase):
    id: int
    company_id: int
    model_config = ConfigDict(from_attributes=True)