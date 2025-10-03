# app/schemas/task.py
from pydantic import BaseModel, ConfigDict
from typing import Optional
from .user import UserOut # <-- Nový import

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
    # Umožníme nastavit ID nebo null pro odebrání
    assignee_id: Optional[int] = None

# Tyto schémata zůstávají pro ostatní moduly
class TimeLogCreateIn(BaseModel):
    work_type_id: int
    hours: float

class UsedItemCreateIn(BaseModel):
    inventory_item_id: int
    quantity: int

class TaskOut(TaskBase):
    id: int
    status: str
    work_order_id: int
    # Místo ID vracíme celý objekt uživatele
    assignee: Optional[UserOut] = None
    
    model_config = ConfigDict(from_attributes=True)