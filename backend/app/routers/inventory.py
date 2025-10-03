from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from app.db.database import get_db
from app.db.models import InventoryItem, InventoryAuditLog, AuditLogAction, RoleEnum
from app.schemas.inventory import InventoryItemCreateIn, InventoryItemOut, InventoryItemUpdateIn
from app.routers.companies import require_company_access

# --- Pomocné funkce a závislosti ---

def require_inventory_editor_access(payload: Dict[str, Any] = Depends(require_company_access)):
    """
    Závislost pro ověření oprávnění pro úpravy skladu.
    V reálné aplikaci by se role uživatele načetla z databáze.
    """
    # Zde by byla logika pro ověření, že uživatel má roli admin/owner
    # např. dotazem do DB: SELECT role FROM memberships WHERE user_id = :user_id AND company_id = :company_id
    # if role not in [RoleEnum.owner, RoleEnum.admin]:
    #     raise HTTPException(status.HTTP_403_FORBIDDEN, "Not enough permissions to edit inventory")
    return payload

async def get_item_or_404(item_id: int, company_id: int, db: AsyncSession) -> InventoryItem:
    """Načte položku skladu nebo vyvolá chybu 404, pokud neexistuje nebo nepatří dané firmě."""
    stmt = (
        select(InventoryItem)
        .where(and_(InventoryItem.id == item_id, InventoryItem.company_id == company_id))
        .options(selectinload(InventoryItem.category)) # Eager load kategorie pro detail
    )
    result = await db.execute(stmt)
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inventory item not found")
    return item

# --- API Router ---

router = APIRouter(prefix="/companies/{company_id}/inventory", tags=["inventory"])

@router.post(
    "",
    response_model=InventoryItemOut,
    status_code=status.HTTP_201_CREATED,
    summary="Vytvoření nové položky ve skladu"
)
async def create_inventory_item(
    company_id: int,
    payload: InventoryItemCreateIn,
    db: AsyncSession = Depends(get_db),
    token: Dict[str, Any] = Depends(require_inventory_editor_access)
):
    """
    Vytvoří novou položku ve skladu a volitelně ji přiřadí ke kategorii.
    - SKU (Stock Keeping Unit) musí být unikátní v rámci firmy.
    - Automaticky vytvoří auditní záznam o vytvoření.
    """
    stmt = select(InventoryItem).where(
        and_(InventoryItem.company_id == company_id, InventoryItem.sku == payload.sku)
    )
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Item with SKU '{payload.sku}' already exists in this company."
        )

    item = InventoryItem(**payload.dict(), company_id=company_id)
    db.add(item)
    await db.flush()

    user_id = int(token.get("sub"))
    log = InventoryAuditLog(
        item_id=item.id,
        user_id=user_id,
        company_id=company_id,
        action=AuditLogAction.created,
        details=f"Položka '{item.name}' (SKU: {item.sku}) byla vytvořena s množstvím {item.quantity} ks."
    )
    db.add(log)

    await db.commit()
    await db.refresh(item)
    return item

@router.get(
    "",
    response_model=List[InventoryItemOut],
    summary="Získání seznamu všech položek ve skladu"
)
async def list_inventory_items(
    company_id: int,
    category_id: int | None = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access)
):
    """
    Vrátí seznam skladových položek pro danou firmu s možností stránkování
    a filtrování podle `category_id`.
    """
    stmt = (
        select(InventoryItem)
        .where(InventoryItem.company_id == company_id)
        .options(selectinload(InventoryItem.category).selectinload(InventoryItem.category.children)) # Eager load pro kategorii a její děti
        .offset(skip)
        .limit(limit)
    )

    if category_id is not None:
        stmt = stmt.where(InventoryItem.category_id == category_id)

    result = await db.execute(stmt)
    items = result.scalars().all()
    return items

@router.get(
    "/{item_id}",
    response_model=InventoryItemOut,
    summary="Získání detailu konkrétní skladové položky"
)
async def get_inventory_item(
    company_id: int,
    item_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access)
):
    """Vrátí detail jedné skladové položky včetně informací o její kategorii."""
    item = await get_item_or_404(item_id, company_id, db)
    return item

@router.patch(
    "/{item_id}",
    response_model=InventoryItemOut,
    summary="Aktualizace skladové položky"
)
async def update_inventory_item(
    company_id: int,
    item_id: int,
    payload: InventoryItemUpdateIn,
    db: AsyncSession = Depends(get_db),
    token: Dict[str, Any] = Depends(require_inventory_editor_access)
):
    """
    Aktualizuje vlastnosti skladové položky, včetně její kategorie.
    - Umožňuje částečné úpravy (stačí poslat jen měněná pole).
    - Automaticky vytváří auditní záznam o změnách.
    """
    item = await get_item_or_404(item_id, company_id, db)
    user_id = int(token.get("sub"))
    
    update_data = payload.dict(exclude_unset=True)
    if not update_data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No data provided for update")

    changes = []
    for key, value in update_data.items():
        if getattr(item, key) != value:
            # Speciální handling pro category_id pro lepší logování
            if key == 'category_id':
                old_category_name = item.category.name if item.category else "Žádná"
                # Nový název kategorie bychom museli načíst z DB, pro zjednodušení logujeme ID
                changes.append(f"Pole '{key}' změněno z '{getattr(item, key)}' (Kategorie: {old_category_name}) na '{value}'.")
            else:
                changes.append(f"Pole '{key}' změněno z '{getattr(item, key)}' na '{value}'.")
            setattr(item, key, value)
    
    if changes:
        action = AuditLogAction.updated
        if 'quantity' in update_data and len(update_data) == 1:
             action = AuditLogAction.quantity_adjusted
        
        log = InventoryAuditLog(
            item_id=item.id, user_id=user_id, company_id=company_id,
            action=action, details=" | ".join(changes)
        )
        db.add(log)
        
        await db.commit()
        await db.refresh(item)

    return item

@router.delete(
    "/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Smazání skladové položky"
)
async def delete_inventory_item(
    company_id: int,
    item_id: int,
    db: AsyncSession = Depends(get_db),
    token: Dict[str, Any] = Depends(require_inventory_editor_access)
):
    """
    Trvale odstraní položku ze skladu a vytvoří o tom auditní záznam.
    """
    item = await get_item_or_404(item_id, company_id, db)
    user_id = int(token.get("sub"))
    
    log = InventoryAuditLog(
        item_id=item.id, user_id=user_id, company_id=company_id,
        action=AuditLogAction.deleted,
        details=f"Položka '{item.name}' (SKU: {item.sku}, ID: {item.id}) byla smazána."
    )
    db.add(log)

    await db.delete(item)
    await db.commit()