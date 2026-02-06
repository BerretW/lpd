from pydantic import BaseModel, ConfigDict
from typing import Optional # <--- Přidat import

class WorkTypeBase(BaseModel):
    name: str
    rate: float

class WorkTypeCreateIn(WorkTypeBase):
    pass

# --- PŘIDÁNO ---
class WorkTypeUpdateIn(BaseModel):
    name: Optional[str] = None
    rate: Optional[float] = None
# ----------------

class WorkTypeOut(WorkTypeBase):
    id: int
    company_id: int
    model_config = ConfigDict(from_attributes=True)