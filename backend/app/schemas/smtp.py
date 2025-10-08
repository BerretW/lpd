# backend/app/schemas/smtp.py
from pydantic import BaseModel, ConfigDict, EmailStr, SecretStr, field_validator
from typing import Dict, Any, Optional
from app.db.models import SecurityProtocolEnum

class SmtpSettingsBase(BaseModel):
    is_enabled: bool
    smtp_host: str
    smtp_port: int
    smtp_user: str
    sender_email: EmailStr
    security_protocol: SecurityProtocolEnum
    notification_settings: Dict[str, Any] = {}

class SmtpSettingsIn(SmtpSettingsBase):
    # SecretStr zajistí, že se heslo nevypíše do logů
    # Bude `None` pokud uživatel posílá data bez změny hesla
    smtp_password: Optional[SecretStr] = None
    
    @field_validator('smtp_port')
    def port_must_be_valid(cls, v):
        if not 0 < v < 65536:
            raise ValueError("Port must be between 1 and 65535")
        return v

class SmtpSettingsOut(SmtpSettingsBase):
    company_id: int
    password_is_set: bool # Místo hesla vracíme jen informaci, zda je nastaveno
    model_config = ConfigDict(from_attributes=True)

class SmtpTestIn(BaseModel):
    recipient_email: Optional[EmailStr] = None