from pydantic import BaseModel, ConfigDict

# --- Manufacturer Schemas ---
class ManufacturerBase(BaseModel):
    name: str

class ManufacturerCreateIn(ManufacturerBase):
    pass

class ManufacturerOut(ManufacturerBase):
    id: int
    company_id: int
    model_config = ConfigDict(from_attributes=True)

# --- Supplier Schemas ---
class SupplierBase(BaseModel):
    name: str

class SupplierCreateIn(SupplierBase):
    pass

class SupplierOut(SupplierBase):
    id: int
    company_id: int
    model_config = ConfigDict(from_attributes=True)