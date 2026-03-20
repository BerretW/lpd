from pydantic import BaseModel, ConfigDict
from typing import Optional


# ─── Tech Field ───────────────────────────────────────────────────────────────

class ObjTechFieldIn(BaseModel):
    name: str
    type: str  # text, number, date, select
    show_in_overview: bool = False
    is_main: bool = False
    options: Optional[list[str]] = None
    inventory_param: Optional[str] = None
    sort_order: int = 0


class ObjTechFieldUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    show_in_overview: Optional[bool] = None
    is_main: Optional[bool] = None
    options: Optional[list[str]] = None
    inventory_param: Optional[str] = None
    sort_order: Optional[int] = None


class ObjTechFieldOut(BaseModel):
    id: int
    tech_type_id: int
    name: str
    type: str
    show_in_overview: bool
    is_main: bool = False
    options: Optional[list[str]] = None
    inventory_param: Optional[str] = None
    sort_order: int = 0
    model_config = ConfigDict(from_attributes=True)


# ─── Accessory Type ───────────────────────────────────────────────────────────

class ObjAccessoryTypeIn(BaseModel):
    name: str
    unit: str = "ks"


class ObjAccessoryTypeUpdate(BaseModel):
    name: Optional[str] = None
    unit: Optional[str] = None


class ObjAccessoryTypeOut(BaseModel):
    id: int
    tech_type_id: int
    name: str
    unit: str
    model_config = ConfigDict(from_attributes=True)


# ─── Tech Type ────────────────────────────────────────────────────────────────

class ObjTechTypeIn(BaseModel):
    name: str
    color: str = "bg-blue-600"


class ObjTechTypeUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None


class ObjTechTypeOut(BaseModel):
    id: int
    company_id: int
    name: str
    color: str
    fields: list[ObjTechFieldOut] = []
    accessory_types: list[ObjAccessoryTypeOut] = []
    element_count: int = 0
    model_config = ConfigDict(from_attributes=True)


# ─── Tech Element ─────────────────────────────────────────────────────────────

class ObjTechElementIn(BaseModel):
    quantity: int = 1
    fields: dict[str, str] = {}
    accessories: list[dict] = []
    inventory_item_id: Optional[int] = None
    inventory_item_name: Optional[str] = None
    inventory_item_sku: Optional[str] = None
    inventory_item_manufacturer: Optional[str] = None
    is_main: bool = False


class ObjTechElementOut(BaseModel):
    id: int
    instance_id: int
    quantity: int
    fields: dict[str, str] = {}
    accessories: list[dict] = []
    inventory_item_id: Optional[int] = None
    inventory_item_name: Optional[str] = None
    inventory_item_sku: Optional[str] = None
    inventory_item_manufacturer: Optional[str] = None
    is_main: bool = False
    model_config = ConfigDict(from_attributes=True)


# ─── Tech Instance ────────────────────────────────────────────────────────────

class ObjTechInstanceOut(BaseModel):
    id: int
    site_id: int
    tech_type_id: int
    tech_type: ObjTechTypeOut
    elements: list[ObjTechElementOut] = []
    model_config = ConfigDict(from_attributes=True)


# ─── Site ─────────────────────────────────────────────────────────────────────

class ObjSiteIn(BaseModel):
    name: str
    address: Optional[str] = None
    city: Optional[str] = None
    zip: Optional[str] = None
    phone: Optional[str] = None
    customer_id: Optional[int] = None
    contact_person: Optional[str] = None
    contact_email: Optional[str] = None


class ObjSiteUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    zip: Optional[str] = None
    phone: Optional[str] = None
    customer_id: Optional[int] = None
    contact_person: Optional[str] = None
    contact_email: Optional[str] = None


class ObjSiteOut(BaseModel):
    id: int
    company_id: int
    name: str
    address: Optional[str] = None
    city: Optional[str] = None
    zip: Optional[str] = None
    phone: Optional[str] = None
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    contact_person: Optional[str] = None
    contact_email: Optional[str] = None
    technologies: list[ObjTechInstanceOut] = []
    model_config = ConfigDict(from_attributes=True)


# ─── Tech instance create ─────────────────────────────────────────────────────

class ObjTechInstanceIn(BaseModel):
    tech_type_id: int
