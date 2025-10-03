from pydantic import BaseModel, ConfigDict

class WorkTypeBase(BaseModel):
    name: str
    rate: float

class WorkTypeCreateIn(WorkTypeBase):
    pass

class WorkTypeOut(WorkTypeBase):
    id: int
    company_id: int
    model_config = ConfigDict(from_attributes=True)