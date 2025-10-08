# backend/app/schemas/trigger.py
from pydantic import BaseModel, ConfigDict, EmailStr
from typing import List, Optional
from app.db.models import TriggerType, TriggerCondition

class NotificationTriggerBase(BaseModel):
    is_active: bool
    trigger_type: TriggerType
    condition: TriggerCondition
    threshold_value: float
    recipient_emails: List[EmailStr]

class NotificationTriggerCreateIn(NotificationTriggerBase):
    pass

class NotificationTriggerUpdateIn(BaseModel):
    is_active: Optional[bool] = None
    threshold_value: Optional[float] = None
    recipient_emails: Optional[List[EmailStr]] = None

class NotificationTriggerOut(NotificationTriggerBase):
    id: int
    company_id: int
    model_config = ConfigDict(from_attributes=True)