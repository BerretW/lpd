# backend/app/schemas/shared.py
from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import date

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
    
    # --- NOVÁ POLE PRO KALKULACI ---
    unit_cost: float        # Nákupní cena (InventoryItem.price)
    margin_applied: float   # Použitá marže v %
    unit_price_sold: float  # Prodejní cena za kus (Cost * Marže)
    
    total_price: float      # Celková cena řádku
    task_name: str
    model_config = ConfigDict(from_attributes=True)