# backend/app/routers/picking_orders.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

from app.db.database import get_db
from app.db.models import (
    PickingOrder, PickingOrderItem, Location, User, Membership, RoleEnum,
    ItemLocationStock, InventoryItem, InventoryAuditLog, AuditLogAction,
    PickingOrderStatus, InventoryCategory
)
from app.schemas.picking_order import (
    PickingOrderCreateIn, PickingOrderOut, PickingOrderFulfillIn,
    PickingOrderStatusUpdateIn
)
from app.core.dependencies import require_company_access

router = APIRouter(prefix="/companies/{company_id}/picking-orders", tags=["picking-orders"])

# --- UPRAVENÁ FUNKCE ---
async def get_picking_order_or_404(db: AsyncSession, company_id: int, order_id: int) -> PickingOrder:
    stmt = (
        select(PickingOrder)
        .where(PickingOrder.company_id == company_id, PickingOrder.id == order_id)
        .options(
            selectinload(PickingOrder.requester),
            selectinload(PickingOrder.source_location).selectinload(Location.authorized_users),
            selectinload(PickingOrder.destination_location).selectinload(Location.authorized_users),
            selectinload(PickingOrder.items)
                .selectinload(PickingOrderItem.inventory_item)
                .selectinload(ItemLocationStock.location),
            selectinload(PickingOrder.items)
                .selectinload(PickingOrderItem.inventory_item)
                .selectinload(InventoryItem.categories)  # <--- OPRAVENO Z category
                .selectinload(InventoryCategory.children)
        )
    )
    order = (await db.execute(stmt)).scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Picking order not found")
    return order


@router.post("", response_model=PickingOrderOut, status_code=status.HTTP_201_CREATED)
async def create_picking_order(
    company_id: int,
    payload: PickingOrderCreateIn,
    db: AsyncSession = Depends(get_db),
    token: Dict[str, Any] = Depends(require_company_access)
):
    requester_id = int(token.get("sub"))
    
    order = PickingOrder(
        company_id=company_id,
        requester_id=requester_id,
        source_location_id=payload.source_location_id,
        destination_location_id=payload.destination_location_id,
        notes=payload.notes
    )
    db.add(order)
    
    for item_in in payload.items:
        order_item = PickingOrderItem(
            picking_order=order,
            inventory_item_id=item_in.inventory_item_id,
            requested_item_description=item_in.requested_item_description,
            requested_quantity=item_in.requested_quantity
        )
        db.add(order_item)
        
    await db.commit()
    return await get_picking_order_or_404(db, company_id, order.id)

@router.get("", response_model=List[PickingOrderOut])
async def list_picking_orders(
    company_id: int,
    status: Optional[PickingOrderStatus] = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access)
):
    # Pro konzistenci upravíme i tento dotaz
    stmt = (
        select(PickingOrder)
        .where(PickingOrder.company_id == company_id)
        .options(
            selectinload(PickingOrder.requester),
            selectinload(PickingOrder.source_location).selectinload(Location.authorized_users),
            selectinload(PickingOrder.destination_location).selectinload(Location.authorized_users),
            selectinload(PickingOrder.items)
                .selectinload(PickingOrderItem.inventory_item)
                .selectinload(InventoryItem.locations)
                .selectinload(ItemLocationStock.location)
                .selectinload(Location.authorized_users), # TATO ŘÁDKA JE NOVÁ
            selectinload(PickingOrder.items)
                .selectinload(PickingOrderItem.inventory_item)
                .selectinload(InventoryItem.categories)
                .selectinload(InventoryCategory.children)
                .selectinload(InventoryCategory.children)
                .selectinload(InventoryCategory.children)
        )
        .order_by(PickingOrder.created_at.desc())
    )
    if status:
        stmt = stmt.where(PickingOrder.status == status)
        
    result = await db.execute(stmt)
    return result.scalars().all()

@router.get("/{order_id}", response_model=PickingOrderOut, summary="Získání detailu požadavku na materiál")
async def get_picking_order(
    company_id: int,
    order_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access)
):
    """Vrátí kompletní detail jednoho požadavku na materiál včetně všech jeho položek."""
    return await get_picking_order_or_404(db, company_id, order_id)

@router.patch("/{order_id}/status", response_model=PickingOrderOut, summary="Změna stavu požadavku")
async def update_picking_order_status(
    company_id: int,
    order_id: int,
    payload: PickingOrderStatusUpdateIn,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access)
):
    """
    Umožňuje změnit stav požadavku, např. z 'new' na 'in_progress' nebo 'cancelled'.
    Stav 'completed' se nastavuje výhradně přes endpoint '/fulfill'.
    """
    order = await db.get(PickingOrder, order_id)
    if not order or order.company_id != company_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Picking order not found")

    if order.status in [PickingOrderStatus.COMPLETED, PickingOrderStatus.CANCELLED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot change status of an order that is already {order.status.value}."
        )

    if payload.status == PickingOrderStatus.COMPLETED:
         raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="To complete an order, please use the 'fulfill' endpoint."
        )
    
    order.status = payload.status
    await db.commit()
    return await get_picking_order_or_404(db, company_id, order_id)

# DELETE ORDER
@router.delete("/{order_id}", response_model=PickingOrderOut)
async def delete_picking_order(
    company_id: int,
    order_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access)
):
    """
    Smaže požadavek na materiál, pokud ještě nebyl splněn nebo zrušen.
    """
    order = await db.get(PickingOrder, order_id)
    if not order or order.company_id != company_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Picking order not found")

    if order.status in [PickingOrderStatus.COMPLETED, PickingOrderStatus.CANCELLED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete an order that is already {order.status.value}."
        )

    await db.delete(order)
    await db.commit()
    return order




@router.post("/{order_id}/fulfill", response_model=PickingOrderOut)
async def fulfill_picking_order(
    company_id: int,
    order_id: int,
    payload: PickingOrderFulfillIn,
    db: AsyncSession = Depends(get_db),
    token: Dict[str, Any] = Depends(require_company_access)
):
    """
    Splní požadavek na materiál. Tento proces je VŽDY chápán jako PŘESUN
    materiálu z explicitně zadané zdrojové lokace do cílové lokace požadavku.

    Skladník musí pro každou položku uvést, odkud ji bere, a systém ověří
    dostupnost na daném skladě.
    """
    order = await get_picking_order_or_404(db, company_id, order_id)
    if order.status not in [PickingOrderStatus.NEW, PickingOrderStatus.IN_PROGRESS]:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Order is already completed or cancelled.")

    user_id = int(token.get("sub"))

    for item_in in payload.items:
        db_item = next((i for i in order.items if i.id == item_in.picking_order_item_id), None)
        if not db_item:
            raise HTTPException(404, f"Item with id {item_in.picking_order_item_id} not found in this order.")

        if db_item.requested_item_description and not item_in.inventory_item_id:
            raise HTTPException(400, f"Item '{db_item.requested_item_description}' was requested by description, you must provide a real inventory_item_id upon fulfillment.")
        
        final_item_id = item_in.inventory_item_id or db_item.inventory_item_id
        if not final_item_id: continue

        db_item.inventory_item_id = final_item_id
        db_item.picked_quantity = item_in.picked_quantity

        if item_in.picked_quantity == 0:
            continue

        # --- NOVÁ SJEDNOCENÁ LOGIKA ---

        # 1. Ověření a výdej ze ZADANÉ zdrojové lokace
        source_location_id = item_in.source_location_id
        source_stock = await db.get(ItemLocationStock, (final_item_id, source_location_id))
        if not source_stock or source_stock.quantity < item_in.picked_quantity:
            item_info = await db.get(InventoryItem, final_item_id)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Not enough stock for item '{item_info.name if item_info else 'N/A'}' (ID: {final_item_id}) at the specified source location (ID: {source_location_id})."
            )
        source_stock.quantity -= item_in.picked_quantity

        # 2. Příjem na cílovou lokaci (z původního požadavku)
        dest_stock = await db.get(ItemLocationStock, (final_item_id, order.destination_location_id))
        if dest_stock:
            dest_stock.quantity += item_in.picked_quantity
        else:
            dest_stock = ItemLocationStock(inventory_item_id=final_item_id, location_id=order.destination_location_id, quantity=item_in.picked_quantity)
            db.add(dest_stock)

        # 3. Auditní záznam
        source_location = await db.get(Location, source_location_id)
        log = InventoryAuditLog(
            item_id=final_item_id, user_id=user_id, company_id=company_id,
            action=AuditLogAction.picking_fulfilled,
            details=f"Splněn požadavek #{order.id}: {item_in.picked_quantity} ks přesunuto z '{source_location.name if source_location else 'N/A'}' do '{order.destination_location.name}'."
        )
        db.add(log)

    order.status = PickingOrderStatus.COMPLETED
    order.completed_at = datetime.now(timezone.utc)
    
    await db.commit()
    return await get_picking_order_or_404(db, company_id, order.id)