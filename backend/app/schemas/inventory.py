# app/schemas/inventory.py
from pydantic import BaseModel, ConfigDict
from typing import Optional
from .category import CategoryOut # <-- Import nového schématu

class InventoryItemBase(BaseModel):
    name: str
    sku: str
    description: Optional[str] = None
    quantity: int = 0
    category_id: Optional[int] = None # <-- Přidat category_id

class InventoryItemCreateIn(InventoryItemBase):
    pass

class InventoryItemUpdateIn(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    description: Optional[str] = None
    quantity: Optional[int] = None
    category_id: Optional[int] = None # <-- Přidat category_id

class InventoryItemOut(InventoryItemBase):
    id: int
    company_id: int
    category: Optional[CategoryOut] = None # <-- Přidat celý objekt kategorie pro zobrazení
    
    model_config = ConfigDict(from_attributes=True)