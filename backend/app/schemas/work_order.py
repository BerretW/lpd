from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from .client import ClientOut
# Importujeme sdílená schémata z nového souboru
from .shared import BillingReportTimeLogOut, BillingReportUsedItemOut

class TaskPreviewOut(BaseModel):
    id: int
    name: str
    status: str
    model_config = ConfigDict(from_attributes=True)

class WorkOrderBase(BaseModel):
    name: str
    description: Optional[str] = None
    client_id: Optional[int] = None
    # --- PŘIDANÉ POLE ---
    budget_hours: Optional[float] = None

class WorkOrderCreateIn(WorkOrderBase):
    pass

class WorkOrderUpdateIn(WorkOrderBase):
    status: Optional[str] = None

class WorkOrderStatusUpdateIn(BaseModel):
    status: str

class WorkOrderOut(WorkOrderBase):
    id: int
    company_id: int
    status: str
    tasks: List[TaskPreviewOut] = []
    client: Optional[ClientOut] = None
    model_config = ConfigDict(from_attributes=True)

class BillingReportOut(BaseModel):
    """Kompletní report s podklady pro fakturaci zakázky."""
    work_order_name: str
    client_name: Optional[str] = None
    total_hours: float
    total_price_work: float
    total_price_inventory: float
    grand_total: float
    time_logs: List[BillingReportTimeLogOut]
    used_items: List[BillingReportUsedItemOut]