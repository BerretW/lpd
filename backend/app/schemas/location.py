# app/schemas/location.py
from pydantic import BaseModel, ConfigDict
from typing import Optional

class LocationBase(BaseModel):
    name: str
    description: Optional[str] = None

class LocationCreateIn(LocationBase):
    pass

class LocationUpdateIn(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class LocationOut(LocationBase):
    id: int
    model_config = ConfigDict(from_attributes=True)