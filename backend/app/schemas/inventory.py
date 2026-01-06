# app/schemas/inventory.py
from pydantic import BaseModel, ConfigDict, computed_field, field_validator
from typing import Optional, List
from .category import CategoryOut
from .location import LocationOut

class ItemLocationStockOut(BaseModel):
    quantity: int
    location: LocationOut
    model_config = ConfigDict(from_attributes=True)

class InventoryItemBase(BaseModel):
    name: str
    sku: str
    description: Optional[str] = None
    # Změna: Nyní přijímáme seznam ID kategorií
    category_ids: List[int] = []
    ean: Optional[str] = None
    image_url: Optional[str] = None
    price: Optional[float] = None
    vat_rate: Optional[float] = None
    is_monitored_for_stock: bool = False
    low_stock_threshold: Optional[int] = None

class InventoryItemCreateIn(InventoryItemBase):
    pass

class InventoryItemUpdateIn(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    description: Optional[str] = None
    # Změna: Aktualizace seznamu kategorií
    category_ids: Optional[List[int]] = None
    ean: Optional[str] = None
    price: Optional[float] = None
    vat_rate: Optional[float] = None
    is_monitored_for_stock: Optional[bool] = None
    low_stock_threshold: Optional[int] = None

class InventoryItemOut(InventoryItemBase):
    id: int
    company_id: int
    # Změna: Vracíme seznam kategorií
    categories: List[CategoryOut] = []
    locations: List[ItemLocationStockOut] = []

    @computed_field
    @property
    def total_quantity(self) -> int:
        return sum(loc.quantity for loc in self.locations)
    
    model_config = ConfigDict(from_attributes=True)

class PlaceStockIn(BaseModel):
    inventory_item_id: int
    location_id: int
    quantity: int
    details: Optional[str] = None

class TransferStockIn(BaseModel):
    inventory_item_id: int
    from_location_id: int
    to_location_id: int
    quantity: int
    details: Optional[str] = None

class WriteOffStockIn(BaseModel):
    inventory_item_id: int
    location_id: int
    quantity: int
    details: str

    @field_validator('quantity')
    def quantity_must_be_positive(cls, v):
        if v <= 0:
            raise ValueError("Quantity must be positive")
        return v