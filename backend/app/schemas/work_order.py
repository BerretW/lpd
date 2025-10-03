from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from .client import ClientOut # <-- Nový import

class TaskPreviewOut(BaseModel):
    id: int
    name: str
    status: str
    model_config = ConfigDict(from_attributes=True)

class WorkOrderBase(BaseModel):
    name: str
    description: Optional[str] = None
    client_id: Optional[int] = None # <-- Přidat

class WorkOrderCreateIn(WorkOrderBase):
    pass

class WorkOrderUpdateIn(WorkOrderBase):
    status: Optional[str] = None

class WorkOrderStatusUpdateIn(BaseModel):
    status: str # např. "completed", "in_progress"

class WorkOrderOut(WorkOrderBase):
    id: int
    company_id: int
    status: str
    tasks: List[TaskPreviewOut] = []
    client: Optional[ClientOut] = None # <-- Přidat
    model_config = ConfigDict(from_attributes=True)