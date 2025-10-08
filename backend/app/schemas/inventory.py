# app/schemas/inventory.py
from pydantic import BaseModel, ConfigDict, computed_field
from typing import Optional, List
from .category import CategoryOut
from .location import LocationOut

# --- NOVÉ SCHÉMA PRO ZOBRAZENÍ STAVU NA LOKACI ---
class ItemLocationStockOut(BaseModel):
    quantity: int
    location: LocationOut
    model_config = ConfigDict(from_attributes=True)

class InventoryItemBase(BaseModel):
    name: str
    sku: str
    description: Optional[str] = None
    category_id: Optional[int] = None
    ean: Optional[str] = None
    image_url: Optional[str] = None
    price: Optional[float] = None
    vat_rate: Optional[float] = None
    is_monitored_for_stock: bool = False
    low_stock_threshold: Optional[int] = None

class InventoryItemCreateIn(InventoryItemBase):
    # Při vytváření již nezadáváme množství
    pass

class InventoryItemUpdateIn(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    description: Optional[str] = None
    # --- ZMĚNA: Pole 'quantity' je odebráno, bude se měnit přes vlastní endpointy ---
    category_id: Optional[int] = None
    ean: Optional[str] = None
    price: Optional[float] = None
    vat_rate: Optional[float] = None
    is_monitored_for_stock: Optional[bool] = None
    low_stock_threshold: Optional[int] = None
    # image_url se bude nastavovat přes samostatný endpoint

class InventoryItemOut(InventoryItemBase):
    id: int
    company_id: int
    category: Optional[CategoryOut] = None
    # --- NOVÁ POLE ---
    locations: List[ItemLocationStockOut] = []

    @computed_field
    @property
    def total_quantity(self) -> int:
        """Dynamicky spočítá celkové množství ze všech lokací."""
        return sum(loc.quantity for loc in self.locations)
    
    model_config = ConfigDict(from_attributes=True)

# --- NOVÁ SCHÉMATA PRO POHYBY ---
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