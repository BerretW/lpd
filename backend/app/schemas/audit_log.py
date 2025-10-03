# app/schemas/audit_log.py
from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime
from app.db.models import AuditLogAction

class AuditLogUserOut(BaseModel):
    """Zjednodušený pohled na uživatele pro audit log."""
    id: int
    email: str
    model_config = ConfigDict(from_attributes=True)

class AuditLogItemOut(BaseModel):
    """Zjednodušený pohled na skladovou položku pro audit log."""
    id: int
    name: str
    sku: str
    model_config = ConfigDict(from_attributes=True)

class AuditLogOut(BaseModel):
    """Kompletní schéma pro jeden záznam v auditním logu."""
    id: int
    action: AuditLogAction
    details: Optional[str] = None
    timestamp: datetime
    
    # Záznam může odkazovat na uživatele nebo položku, která byla mezitím smazána,
    # proto jsou Optional.
    user: Optional[AuditLogUserOut] = None
    inventory_item: Optional[AuditLogItemOut] = None
    
    model_config = ConfigDict(from_attributes=True)