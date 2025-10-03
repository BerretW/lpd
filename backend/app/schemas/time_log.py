from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import date
from .user import UserOut
from .work_type import WorkTypeOut
from app.db.models import TimeLogStatus

class TimeLogBase(BaseModel):
    task_id: int
    work_type_id: int
    hours: float
    work_date: date
    notes: Optional[str] = None

class TimeLogCreateIn(TimeLogBase):
    pass

class TimeLogUpdateIn(BaseModel):
    task_id: Optional[int] = None
    work_type_id: Optional[int] = None
    hours: Optional[float] = None
    work_date: Optional[date] = None
    notes: Optional[str] = None

class TimeLogStatusUpdateIn(BaseModel):
    status: TimeLogStatus

class TaskPreviewForTimeLog(BaseModel):
    id: int
    name: str

class TimeLogOut(TimeLogBase):
    id: int
    status: TimeLogStatus
    user: UserOut
    work_type: WorkTypeOut
    task: TaskPreviewForTimeLog
    
    model_config = ConfigDict(from_attributes=True)