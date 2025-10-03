# app/routers/audit_logs.py
from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from datetime import date

from app.db.database import get_db
from app.db.models import InventoryAuditLog
from app.schemas.audit_log import AuditLogOut
from app.routers.members import require_admin_access # Předpokládáme, že logy vidí jen admini

router = APIRouter(prefix="/companies/{company_id}/audit-logs", tags=["audit-logs"])

@router.get("", response_model=List[AuditLogOut], summary="Získání historie skladových pohybů s filtry")
async def list_audit_logs(
    company_id: int,
    item_id: Optional[int] = None,
    user_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin_access)
):
    """
    Vrátí seznam záznamů z auditního logu skladu pro danou firmu.
    
    Umožňuje filtrování podle:
    - **item_id**: Zobrazí historii pouze pro jednu konkrétní položku.
    - **user_id**: Zobrazí všechny akce provedené jedním konkrétním uživatelem.
    - **start_date**: Začátek časového rozsahu.
    - **end_date**: Konec časového rozsahu.
    
    Výsledky jsou stránkované a seřazené od nejnovějšího po nejstarší.
    """
    # Základní dotaz, který vybírá logy pro danou firmu
    stmt = select(InventoryAuditLog).where(InventoryAuditLog.company_id == company_id)
    
    # Přidání filtrů podle parametrů v URL
    if item_id:
        stmt = stmt.where(InventoryAuditLog.item_id == item_id)
    if user_id:
        stmt = stmt.where(InventoryAuditLog.user_id == user_id)
    if start_date:
        stmt = stmt.where(func.date(InventoryAuditLog.timestamp) >= start_date)
    if end_date:
        stmt = stmt.where(func.date(InventoryAuditLog.timestamp) <= end_date)
        
    # Eager loading pro související objekty, abychom předešli N+1 problému a MissingGreenlet chybě
    stmt = stmt.options(
        selectinload(InventoryAuditLog.user),
        selectinload(InventoryAuditLog.inventory_item)
    )
    
    # Seřazení od nejnovějšího a stránkování
    stmt = stmt.order_by(InventoryAuditLog.timestamp.desc()).offset(skip).limit(limit)
    
    result = await db.execute(stmt)
    return result.scalars().all()