from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime, date


# ─── Category Assembly ────────────────────────────────────────────────────────

class QuoteCategoryAssemblyIn(BaseModel):
    category_name: str
    assembly_price_per_unit: float = 0.0
    vat_rate: float = 21.0


class QuoteCategoryAssemblyOut(BaseModel):
    id: int
    quote_id: int
    category_name: str
    assembly_price_per_unit: float
    vat_rate: float = 21.0
    model_config = ConfigDict(from_attributes=True)


# ─── Quote Item ───────────────────────────────────────────────────────────────

class QuoteItemIn(BaseModel):
    name: str
    unit: str = "ks"
    quantity: float = 1.0
    material_price: float = 0.0
    assembly_price: float = 0.0
    inventory_item_id: Optional[int] = None
    inventory_category_name: Optional[str] = None
    sort_order: int = 0
    is_reduced_work: bool = False


class QuoteItemUpdate(BaseModel):
    name: Optional[str] = None
    unit: Optional[str] = None
    quantity: Optional[float] = None
    material_price: Optional[float] = None
    assembly_price: Optional[float] = None
    inventory_item_id: Optional[int] = None
    inventory_category_name: Optional[str] = None
    sort_order: Optional[int] = None
    is_reduced_work: Optional[bool] = None


class QuoteItemOut(BaseModel):
    id: int
    section_id: int
    name: str
    unit: str
    quantity: float
    material_price: float
    assembly_price: float
    inventory_item_id: Optional[int] = None
    inventory_category_name: Optional[str] = None
    sort_order: int
    is_reduced_work: bool
    model_config = ConfigDict(from_attributes=True)


# ─── Quote Section ────────────────────────────────────────────────────────────

class QuoteSectionIn(BaseModel):
    name: str
    prefix: Optional[str] = None
    sort_order: int = 0
    is_extras: bool = False


class QuoteSectionUpdate(BaseModel):
    name: Optional[str] = None
    prefix: Optional[str] = None
    sort_order: Optional[int] = None
    is_extras: Optional[bool] = None


class QuoteSectionOut(BaseModel):
    id: int
    quote_id: int
    name: str
    prefix: Optional[str] = None
    sort_order: int
    is_extras: bool
    items: list[QuoteItemOut] = []
    model_config = ConfigDict(from_attributes=True)


# ─── Quote ────────────────────────────────────────────────────────────────────

class QuoteIn(BaseModel):
    name: str
    site_id: Optional[int] = None
    parent_quote_id: Optional[int] = None
    status: str = "draft"
    customer_id: Optional[int] = None
    prepared_by: Optional[str] = None
    prepared_by_phone: Optional[str] = None
    validity_days: int = 14
    currency: str = "CZK"
    vat_rate: float = 21.0
    global_discount: float = 0.0
    global_discount_type: str = "percent"
    global_hourly_rate: float = 0.0
    notes: Optional[str] = None


class QuoteUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    customer_id: Optional[int] = None
    prepared_by: Optional[str] = None
    prepared_by_phone: Optional[str] = None
    validity_days: Optional[int] = None
    currency: Optional[str] = None
    vat_rate: Optional[float] = None
    global_discount: Optional[float] = None
    global_discount_type: Optional[str] = None
    global_hourly_rate: Optional[float] = None
    notes: Optional[str] = None


class QuoteListOut(BaseModel):
    id: int
    company_id: int
    site_id: Optional[int] = None
    parent_quote_id: Optional[int] = None
    name: str
    version: int = 1
    status: str
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class QuoteOut(BaseModel):
    id: int
    company_id: int
    site_id: Optional[int] = None
    parent_quote_id: Optional[int] = None
    name: str
    version: int = 1
    status: str
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    prepared_by: Optional[str] = None
    prepared_by_phone: Optional[str] = None
    validity_days: int
    currency: str
    vat_rate: float
    global_discount: float
    global_discount_type: str
    global_hourly_rate: float
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    sections: list[QuoteSectionOut] = []
    category_assemblies: list[QuoteCategoryAssemblyOut] = []
    sub_quotes: list[QuoteListOut] = []
    model_config = ConfigDict(from_attributes=True)


# ─── Quote Invoice ─────────────────────────────────────────────────────────────

class QuoteInvoiceIn(BaseModel):
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


class QuoteInvoiceOut(BaseModel):
    id: int
    quote_id: int
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
    status: str = "issued"
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
