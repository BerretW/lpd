# app/schemas/shared.py
from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import date

# Zde budou schémata, která jsou potřeba ve více modulech,
# aby se předešlo cyklickým importům.

class BillingReportTimeLogOut(BaseModel):
    """Detail jednoho časového záznamu pro report."""
    work_date: date
    hours: float
    rate: float
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
    price: Optional[float] = None
    total_price: Optional[float] = None
    task_name: str
    model_config = ConfigDict(from_attributes=True)