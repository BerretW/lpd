# app/schemas/inventory.py
from pydantic import BaseModel, ConfigDict
from typing import Optional
from .category import CategoryOut

class InventoryItemBase(BaseModel):
    name: str
    sku: str
    description: Optional[str] = None
    quantity: int = 0
    category_id: Optional[int] = None
    
    # --- NOVÁ POLE ---
    ean: Optional[str] = None
    image_url: Optional[str] = None
    price: Optional[float] = None
    vat_rate: Optional[float] = None

class InventoryItemCreateIn(InventoryItemBase):
    pass

class InventoryItemUpdateIn(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    description: Optional[str] = None
    quantity: Optional[int] = None
    category_id: Optional[int] = None
    
    # --- NOVÁ POLE ---
    ean: Optional[str] = None
    price: Optional[float] = None
    vat_rate: Optional[float] = None
    # image_url se bude nastavovat přes samostatný endpoint

class InventoryItemOut(InventoryItemBase):
    id: int
    company_id: int
    category: Optional[CategoryOut] = None
    
    model_config = ConfigDict(from_attributes=True)