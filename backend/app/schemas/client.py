from pydantic import BaseModel, ConfigDict, EmailStr
from typing import Optional

class ClientBase(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None

class ClientCreateIn(ClientBase):
    pass

class ClientUpdateIn(ClientBase):
    pass

class ClientOut(ClientBase):
    id: int
    company_id: int
    model_config = ConfigDict(from_attributes=True)