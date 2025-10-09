# app/schemas/picking_order.py
from pydantic import BaseModel, ConfigDict, model_validator
from typing import Optional, List
from datetime import datetime

from .user import UserOut
from .location import LocationOut
from .inventory import InventoryItemOut
from app.db.models import PickingOrderStatus

# --- Schémata pro vytváření ---

class PickingOrderItemCreateIn(BaseModel):
    inventory_item_id: Optional[int] = None
    requested_item_description: Optional[str] = None
    requested_quantity: int

    @model_validator(mode='after')
    def check_item_or_description(self):
        if self.inventory_item_id is None and self.requested_item_description is None:
            raise ValueError("Either inventory_item_id or requested_item_description must be provided.")
        if self.inventory_item_id is not None and self.requested_item_description is not None:
            raise ValueError("Cannot provide both inventory_item_id and requested_item_description.")
        return self

class PickingOrderCreateIn(BaseModel):
    source_location_id: int
    destination_location_id: int
    notes: Optional[str] = None
    items: List[PickingOrderItemCreateIn]

# --- Schémata pro splnění ---

class PickingOrderItemFulfillIn(BaseModel):
    picking_order_item_id: int # ID původní položky v požadavku
    picked_quantity: int
    inventory_item_id: Optional[int] = None # Povinné, pokud původní byl jen text

class PickingOrderFulfillIn(BaseModel):
    items: List[PickingOrderItemFulfillIn]

# --- NOVÉ SCHÉMA PRO ZMĚNU STAVU ---
class PickingOrderStatusUpdateIn(BaseModel):
    status: PickingOrderStatus

# --- Schémata pro zobrazení ---

class PickingOrderItemOut(BaseModel):
    id: int
    requested_quantity: int
    picked_quantity: Optional[int] = None
    inventory_item: Optional[InventoryItemOut] = None
    requested_item_description: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class PickingOrderOut(BaseModel):
    id: int
    status: PickingOrderStatus
    notes: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    
    requester: UserOut
    source_location: LocationOut
    destination_location: LocationOut
    
    items: List[PickingOrderItemOut] = []
    
    model_config = ConfigDict(from_attributes=True)