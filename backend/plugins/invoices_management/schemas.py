from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime


INVOICE_STATUSES = ["issued", "sent", "accepted", "paid", "overdue", "cancelled"]


class InvoiceStatusUpdate(BaseModel):
    status: str


class WorkOrderInvoiceIn(BaseModel):
    invoice_number: str
    issue_date: str
    duzp: str
    due_date: str
    variable_symbol: str
    payment_method: str = "převodem"
    note: Optional[str] = None
    total_net: float
    total_vat: float
    total_gross: float


class InvoiceListOut(BaseModel):
    id: int
    company_id: int
    quote_id: Optional[int] = None
    quote_name: Optional[str] = None
    work_order_id: Optional[int] = None
    work_order_name: Optional[str] = None
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    invoice_number: str
    issue_date: str
    duzp: str
    due_date: str
    variable_symbol: str
    payment_method: str
    note: Optional[str] = None
    total_net: float
    total_vat: float
    total_gross: float
    status: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
