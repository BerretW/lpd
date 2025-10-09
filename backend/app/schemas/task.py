from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from .user import UserOut
from .work_order import WorkOrderPreviewOut


class UsedItemInventoryPreviewOut(BaseModel):
    """Zjednodušený pohled na skladovou položku pro seznam materiálu."""
    id: int
    name: str
    sku: str
    model_config = ConfigDict(from_attributes=True)

class UsedItemOut(BaseModel):
    """Reprezentuje jeden záznam o použitém materiálu na úkolu."""
    id: int
    quantity: int
    inventory_item: UsedItemInventoryPreviewOut
    model_config = ConfigDict(from_attributes=True)

# --- PŮVODNÍ SCHÉMATA S ÚPRAVAMI ---

class TaskBase(BaseModel):
    name: str
    description: Optional[str] = None

class TaskCreateIn(TaskBase):
    pass

class TaskUpdateIn(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None

class TaskAssignIn(BaseModel):
    assignee_id: Optional[int] = None

class UsedItemCreateIn(BaseModel):
    inventory_item_id: int
    quantity: int
    # --- NOVÉ POLE ---
    from_location_id: Optional[int] = None

# --- NOVÉ SCHÉMA PRO PŘÍMÉ PŘIŘAZENÍ ---
class DirectAssignItemIn(BaseModel):
    inventory_item_id: int
    quantity: int
    details: Optional[str] = None


class TaskOut(TaskBase):
    id: int
    status: str
    work_order_id: int
    assignee: Optional[UserOut] = None
    used_items: List[UsedItemOut] = []
    
    model_config = ConfigDict(from_attributes=True)

class AssignedTaskOut(TaskOut):
    """
    Rozšířené schéma úkolu, které obsahuje i detail nadřazené zakázky.
    """
    work_order: WorkOrderPreviewOut
    model_config = ConfigDict(from_attributes=True)

class TaskTotalHoursOut(BaseModel):
    task_id: int
    total_hours: float
    
class UsedItemUpdateIn(BaseModel):
    quantity: int