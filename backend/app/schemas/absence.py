# app/schemas/absence.py
from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import date
from app.db.models import AbsenceType, AbsenceStatus
from .user import UserOut

class AbsenceBase(BaseModel):
    absence_type: AbsenceType
    start_date: date
    end_date: date
    notes: Optional[str] = None

class AbsenceCreateIn(AbsenceBase):
    pass

class AbsenceStatusUpdateIn(BaseModel):
    status: AbsenceStatus

class AbsenceOut(AbsenceBase):
    id: int
    status: AbsenceStatus
    user: UserOut
    model_config = ConfigDict(from_attributes=True)