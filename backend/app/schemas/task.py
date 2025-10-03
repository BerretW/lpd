from pydantic import BaseModel, ConfigDict
from typing import Optional

class TaskBase(BaseModel):
    name: str
    description: Optional[str] = None

class TaskCreateIn(TaskBase):
    pass

class TaskUpdateIn(TaskBase):
    status: Optional[str] = None

class TaskAssignIn(BaseModel):
    assignee_id: int

class TimeLogCreateIn(BaseModel):
    work_type_id: int
    hours: float

class UsedItemCreateIn(BaseModel):
    inventory_item_id: int
    quantity: int

class TaskOut(TaskBase):
    id: int
    status: str
    assignee_id: Optional[int]
    model_config = ConfigDict(from_attributes=True)