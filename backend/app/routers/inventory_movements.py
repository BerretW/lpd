# backend/app/routers/inventory_movements.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import Dict, Any

from app.db.database import get_db
from app.db.models import InventoryItem, Location, ItemLocationStock, InventoryAuditLog, AuditLogAction
from app.schemas.inventory import PlaceStockIn, TransferStockIn, InventoryItemOut
from app.core.dependencies import require_admin_access
from app.routers.inventory import get_full_inventory_item # Znovu použijeme pomocnou funkci

router = APIRouter(prefix="/companies/{company_id}/inventory/movements", tags=["inventory-movements"])

@router.post("/place", response_model=InventoryItemOut, summary="Naskladnění položky na konkrétní lokaci")
async def place_stock(
    company_id: int,
    payload: PlaceStockIn,
    db: AsyncSession = Depends(get_db),
    token: Dict[str, Any] = Depends(require_admin_access)
):
    """
    Přidá nové kusy položky na sklad na specifikované umístění.
    Pokud položka na daném místě ještě není, vytvoří nový záznam.
    Pokud již existuje, navýší počet kusů.
    Vždy vytváří auditní záznam.
    """
    # Ověření existence položky
    item_stmt = select(InventoryItem).where(InventoryItem.id == payload.inventory_item_id, InventoryItem.company_id == company_id)
    item = (await db.execute(item_stmt)).scalar_one_or_none()
    if not item:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Inventory item not found.")
    
    # Ověření existence lokace
    loc_stmt = select(Location).where(Location.id == payload.location_id, Location.company_id == company_id)
    location = (await db.execute(loc_stmt)).scalar_one_or_none()
    if not location:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Location not found.")

    # Najdeme nebo vytvoříme záznam o stavu na lokaci
    stock_record = await db.get(ItemLocationStock, (payload.inventory_item_id, payload.location_id))
    if stock_record:
        stock_record.quantity += payload.quantity
    else:
        stock_record = ItemLocationStock(
            inventory_item_id=payload.inventory_item_id,
            location_id=payload.location_id,
            quantity=payload.quantity
        )
        db.add(stock_record)
        
    # Auditní log
    user_id = int(token.get("sub"))
    log = InventoryAuditLog(
        item_id=item.id, user_id=user_id, company_id=company_id,
        action=AuditLogAction.location_placed,
        details=f"Naskladněno {payload.quantity} ks na lokaci '{location.name}'. {payload.details or ''}".strip()
    )
    db.add(log)
    
    await db.commit()
    return await get_full_inventory_item(item.id, db)


@router.post("/transfer", response_model=InventoryItemOut, summary="Přesun položky mezi lokacemi")
async def transfer_stock(
    company_id: int,
    payload: TransferStockIn,
    db: AsyncSession = Depends(get_db),
    token: Dict[str, Any] = Depends(require_admin_access)
):
    """
    Přesune zadaný počet kusů položky z jedné lokace na druhou.
    Celkový počet kusů na skladě se nemění.
    """
    if payload.from_location_id == payload.to_location_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot transfer to the same location.")

    # Načtení záznamu ze zdrojové lokace
    from_stock = await db.get(ItemLocationStock, (payload.inventory_item_id, payload.from_location_id))
    if not from_stock or from_stock.quantity < payload.quantity:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Not enough stock at the source location.")

    # Načtení lokací pro auditní záznam
    from_loc = await db.get(Location, payload.from_location_id)
    to_loc = await db.get(Location, payload.to_location_id)
    if not from_loc or not to_loc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Source or destination location not found.")

    # Snížení stavu na zdrojové lokaci
    from_stock.quantity -= payload.quantity
    
    # Navýšení stavu na cílové lokaci
    to_stock = await db.get(ItemLocationStock, (payload.inventory_item_id, payload.to_location_id))
    if to_stock:
        to_stock.quantity += payload.quantity
    else:
        to_stock = ItemLocationStock(
            inventory_item_id=payload.inventory_item_id,
            location_id=payload.to_location_id,
            quantity=payload.quantity
        )
        db.add(to_stock)

    # Auditní log
    user_id = int(token.get("sub"))
    log = InventoryAuditLog(
        item_id=payload.inventory_item_id, user_id=user_id, company_id=company_id,
        action=AuditLogAction.location_transferred,
        details=f"Přesunuto {payload.quantity} ks z '{from_loc.name}' na '{to_loc.name}'. {payload.details or ''}".strip()
    )
    db.add(log)
    
    await db.commit()
    return await get_full_inventory_item(payload.inventory_item_id, db)
