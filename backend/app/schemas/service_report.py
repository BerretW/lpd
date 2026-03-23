from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime, date


class ServiceReportCreateIn(BaseModel):
    work_order_id: int
    task_id: int
    date: date
    technicians: List[str] = []
    arrival_time: Optional[str] = None
    work_hours: float = 0
    km_driven: int = 0
    work_description: str
    is_warranty_repair: bool = False
    materials_used: List[dict] = []
    notes: Optional[str] = None
    work_type: List[str] = []
    photos: List[dict] = []
    technician_signature: Optional[str] = None
    customer_signature: Optional[str] = None


class ServiceReportOut(BaseModel):
    id: int
    company_id: int
    work_order_id: int
    task_id: int
    date: date
    technicians: List[str]
    arrival_time: Optional[str]
    work_hours: float
    km_driven: int
    work_description: str
    is_warranty_repair: bool
    materials_used: List[dict]
    notes: Optional[str]
    work_type: List[str]
    photos: List[dict]
    technician_signature: Optional[str]
    customer_signature: Optional[str]
    created_at: datetime
    # Denormalizovaná jména pro zobrazení v seznamu
    task_name: Optional[str] = None
    work_order_name: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)
