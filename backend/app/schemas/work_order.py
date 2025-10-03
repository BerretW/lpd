from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from .client import ClientOut # <-- Nový import
from datetime import date # <-- PŘIDAT TENTO ŘÁDEK

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

class BillingReportTimeLogOut(BaseModel):
    """Detail jednoho časového záznamu pro report."""
    work_date: date
    hours: float
    rate: float # Sazba
    total_price: float
    work_type_name: str
    user_email: str
    task_name: str
    model_config = ConfigDict(from_attributes=True)

class BillingReportUsedItemOut(BaseModel):
    """Detail jedné materiálové položky pro report."""
    item_name: str
    sku: str
    quantity: int
    price: Optional[float] = None # Cena za kus
    total_price: Optional[float] = None
    task_name: str
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