# app/schemas/location.py
from pydantic import BaseModel, ConfigDict, EmailStr
from typing import Optional, List
from .user import UserOut

class LocationBase(BaseModel):
    name: str
    description: Optional[str] = None

class LocationCreateIn(LocationBase):
    pass

class LocationUpdateIn(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class LocationOut(LocationBase):
    id: int
    authorized_users: List[UserOut] = []
    model_config = ConfigDict(from_attributes=True)

class LocationPermissionCreateIn(BaseModel):
    user_email: EmailStr

# --- NOVÁ SCHÉMATA PRO SEZNAM POLOŽEK V LOKACI ---

class ItemDetailsForLocationOut(BaseModel):
    """Zjednodušený pohled na skladovou položku pro výpis v lokaci."""
    id: int
    name: str
    sku: str
    image_url: Optional[str] = None
    price: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)

class LocationStockItemOut(BaseModel):
    """
    Reprezentuje jednu položku a její množství na konkrétní lokaci.
    Toto je hlavní schéma pro odpověď z endpointu /locations/{id}/inventory.
    """
    quantity: int
    inventory_item: ItemDetailsForLocationOut

    model_config = ConfigDict(from_attributes=True)