# app/schemas/time_log.py
from pydantic import BaseModel, ConfigDict, computed_field, model_validator
from typing import Optional
from datetime import datetime
from .user import UserOut
from .work_type import WorkTypeOut
from app.db.models import TimeLogStatus

class NewTaskData(BaseModel):
    """Data pro vytvoření nového úkolu přímo z time logu."""
    work_order_id: int
    name: str

class TimeLogBase(BaseModel):
    start_time: datetime
    end_time: datetime
    work_type_id: int
    notes: Optional[str] = None
    break_duration_minutes: int = 0
    is_overtime: bool = False

class TimeLogCreateIn(TimeLogBase):
    # Uživatel pošle buď ID existujícího úkolu...
    task_id: Optional[int] = None
    # ...nebo data pro vytvoření nového
    new_task: Optional[NewTaskData] = None

    @model_validator(mode='after')
    def check_task_or_new_task(self):
        if self.task_id is None and self.new_task is None:
            raise ValueError('Either task_id or new_task must be provided.')
        if self.task_id is not None and self.new_task is not None:
            raise ValueError('Cannot provide both task_id and new_task.')
        return self

class TimeLogUpdateIn(TimeLogBase):
    task_id: int # Při úpravě musí být task_id vždy přítomno

class TimeLogStatusUpdateIn(BaseModel):
    status: TimeLogStatus

class TaskPreviewForTimeLog(BaseModel):
    id: int
    name: str
    model_config = ConfigDict(from_attributes=True)

class TimeLogOut(TimeLogBase):
    id: int
    status: TimeLogStatus
    user: UserOut
    work_type: WorkTypeOut
    task: TaskPreviewForTimeLog
    
    @computed_field
    @property
    def duration_hours(self) -> float:
        duration = self.end_time - self.start_time
        return round(duration.total_seconds() / 3600, 2)

    model_config = ConfigDict(from_attributes=True)