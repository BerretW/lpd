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
                .selectinload(InventoryItem.locations)
                .selectinload(ItemLocationStock.location),
            selectinload(PickingOrder.items)
                .selectinload(PickingOrderItem.inventory_item)
                .selectinload(InventoryItem.category)
                .selectinload(InventoryCategory.children)
                .selectinload(InventoryCategory.children)
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
    # ... (beze změny)
    requester_id = int(token.get("sub"))
    order = PickingOrder(
        company_id=company_id, requester_id=requester_id,
        source_location_id=payload.source_location_id,
        destination_location_id=payload.destination_location_id,
        notes=payload.notes
    )
    db.add(order)
    for item_in in payload.items:
        order_item = PickingOrderItem(
            picking_order=order, inventory_item_id=item_in.inventory_item_id,
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
    # ... (beze změny)
    stmt = (
        select(PickingOrder).where(PickingOrder.company_id == company_id)
        .options(
            selectinload(PickingOrder.requester),
            selectinload(PickingOrder.source_location).selectinload(Location.authorized_users),
            selectinload(PickingOrder.destination_location).selectinload(Location.authorized_users),
            selectinload(PickingOrder.items).selectinload(PickingOrderItem.inventory_item)
            .selectinload(InventoryItem.locations).selectinload(ItemLocationStock.location),
            selectinload(PickingOrder.items).selectinload(PickingOrderItem.inventory_item)
            .selectinload(InventoryItem.category).selectinload(InventoryCategory.children)
            .selectinload(InventoryCategory.children).selectinload(InventoryCategory.children)
        ).order_by(PickingOrder.created_at.desc())
    )
    if status:
        stmt = stmt.where(PickingOrder.status == status)
    result = await db.execute(stmt)
    return result.scalars().all()

# --- NOVÝ ENDPOINT PRO DETAIL ---
@router.get("/{order_id}", response_model=PickingOrderOut, summary="Získání detailu požadavku na materiál")
async def get_picking_order(
    company_id: int,
    order_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access)
):
    """Vrátí kompletní detail jednoho požadavku na materiál včetně všech jeho položek."""
    return await get_picking_order_or_404(db, company_id, order_id)

# --- NOVÝ ENDPOINT PRO ZMĚNU STAVU ---
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
    # Zde stačí jednodušší dotaz, protože nepotřebujeme všechny vnořené objekty pro logiku
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

    # Vrátíme kompletní objekt s plně načtenými daty
    return await get_picking_order_or_404(db, company_id, order_id)


@router.post("/{order_id}/fulfill", response_model=PickingOrderOut)
async def fulfill_picking_order(
    company_id: int,
    order_id: int,
    payload: PickingOrderFulfillIn,
    db: AsyncSession = Depends(get_db),
    token: Dict[str, Any] = Depends(require_company_access)
):
    """
    Splní požadavek na materiál. Rozlišuje mezi přesunem a pořízením.
    - Pokud má požadavek zdrojovou lokaci, provede přesun (výdej -> příjem).
    - Pokud nemá zdrojovou lokaci, provede pouze naskladnění na cílovou lokaci.
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
        if not final_item_id: continue # Should not happen due to validation above

        db_item.inventory_item_id = final_item_id
        db_item.picked_quantity = item_in.picked_quantity

        if item_in.picked_quantity == 0:
            continue

        log_details = ""
        log_action: AuditLogAction

        # --- PŘEPRACOVANÁ LOGIKA ZDE ---

        # Případ 1: Přesun mezi sklady (standardní chování)
        if order.source_location_id:
            source_stock = await db.get(ItemLocationStock, (final_item_id, order.source_location_id))
            if not source_stock or source_stock.quantity < item_in.picked_quantity:
                raise HTTPException(400, f"Not enough stock for item ID {final_item_id} at source location.")
            source_stock.quantity -= item_in.picked_quantity
            
            log_details = f"Splněn požadavek #{order.id}: {item_in.picked_quantity} ks přesunuto z '{order.source_location.name}' do '{order.destination_location.name}'."
            log_action = AuditLogAction.picking_fulfilled
        
        # Případ 2: Pořízení nového materiálu (bez zdrojového skladu)
        else:
            log_details = f"Splněn požadavek na pořízení #{order.id}: {item_in.picked_quantity} ks naskladněno do '{order.destination_location.name}'."
            log_action = AuditLogAction.location_placed

        # Společná logika pro příjem na cílovou lokaci
        dest_stock = await db.get(ItemLocationStock, (final_item_id, order.destination_location_id))
        if dest_stock:
            dest_stock.quantity += item_in.picked_quantity
        else:
            dest_stock = ItemLocationStock(inventory_item_id=final_item_id, location_id=order.destination_location_id, quantity=item_in.picked_quantity)
            db.add(dest_stock)

        # Společná logika pro auditní záznam
        log = InventoryAuditLog(
            item_id=final_item_id, user_id=user_id, company_id=company_id,
            action=log_action,
            details=log_details
        )
        db.add(log)

    order.status = PickingOrderStatus.COMPLETED
    order.completed_at = datetime.now(timezone.utc)
    
    await db.commit()
    return await get_picking_order_or_404(db, company_id, order.id)