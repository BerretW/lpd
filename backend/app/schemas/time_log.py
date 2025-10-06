from pydantic import BaseModel, ConfigDict, computed_field, model_validator
from typing import Optional, List
from datetime import datetime, date

from app.db.models import TimeLogStatus, TimeLogEntryType
from .user import UserOut
from .work_type import WorkTypeOut
from .work_order import WorkOrderOut
from .task import TaskOut

# --- Schémata pro vytváření a úpravu ---

class NewTaskData(BaseModel):
    """Data pro vytvoření nového úkolu přímo z time logu."""
    work_order_id: int
    name: str

class TimeLogBase(BaseModel):
    start_time: datetime
    end_time: datetime
    entry_type: TimeLogEntryType
    notes: Optional[str] = None
    
    # Pole specifická pro 'WORK'
    work_type_id: Optional[int] = None
    task_id: Optional[int] = None
    new_task: Optional[NewTaskData] = None
    break_duration_minutes: int = 0
    is_overtime: bool = False

class TimeLogCreateIn(TimeLogBase):

    @model_validator(mode='after')
    def check_fields_for_entry_type(self):
        # Pokud je to práce, musí mít task_id nebo new_task a work_type_id
        if self.entry_type == TimeLogEntryType.WORK:
            if self.work_type_id is None:
                raise ValueError("work_type_id is required for entry_type 'WORK'")
            if self.task_id is None and self.new_task is None:
                raise ValueError("Either task_id or new_task is required for entry_type 'WORK'")
            if self.task_id is not None and self.new_task is not None:
                raise ValueError("Cannot provide both task_id and new_task.")
        # Pokud to není práce, nesmí mít pole specifická pro práci
        else:
            if self.work_type_id is not None or self.task_id is not None or self.new_task is not None:
                raise ValueError("work_type_id, task_id and new_task are not allowed for non-WORK entries.")
        return self

class TimeLogUpdateIn(TimeLogBase):
    # Při úpravě musíme vždy vědět, ke kterému úkolu se vztahuje, pokud je to práce
    # Pro jednoduchost bude úprava fungovat jako nové vložení, které vyžaduje stejná data.
    pass

class TimeLogStatusUpdateIn(BaseModel):
    status: TimeLogStatus

# --- Schémata pro zobrazování (výstup z API) ---

class TaskPreviewForTimeLog(BaseModel):
    id: int
    name: str
    model_config = ConfigDict(from_attributes=True)

class TimeLogOut(TimeLogBase):
    id: int
    status: TimeLogStatus
    user: UserOut
    
    # Vracíme je jako volitelné, protože pro absenci nebudou existovat
    work_type: Optional[WorkTypeOut] = None
    task: Optional[TaskPreviewForTimeLog] = None
    
    @computed_field
    @property
    def duration_hours(self) -> float:
        """Vypočítá celkovou délku v hodinách."""
        duration = self.end_time - self.start_time
        return round(duration.total_seconds() / 3600, 2)

    model_config = ConfigDict(from_attributes=True)

class ServiceReportDataOut(BaseModel):
    """
    Struktura dat, která vrací kontext pro servisní/montážní list
    záznamu z docházky.
    """
    work_order: WorkOrderOut
    task: TaskOut