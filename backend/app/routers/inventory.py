import shutil
import uuid
from pathlib import Path
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from app.db.database import get_db
from app.db.models import InventoryItem, InventoryAuditLog, AuditLogAction
from app.schemas.inventory import InventoryItemCreateIn, InventoryItemOut, InventoryItemUpdateIn
from app.routers.companies import require_company_access

# --- Konfigurace pro nahrávání souborů ---
UPLOAD_DIRECTORY = Path("static/images/inventory")
UPLOAD_DIRECTORY.mkdir(parents=True, exist_ok=True)  # Jistota, že složka existuje

# --- Pomocné funkce a závislosti ---

def require_inventory_editor_access(payload: Dict[str, Any] = Depends(require_company_access)):
    """Závislost pro ověření oprávnění pro úpravy skladu."""
    # Zde by byla logika pro ověření, že uživatel má roli admin/owner
    return payload

async def get_item_or_404(item_id: int, company_id: int, db: AsyncSession) -> InventoryItem:
    """Načte položku skladu nebo vyvolá chybu 404, pokud neexistuje nebo nepatří dané firmě."""
    stmt = (
        select(InventoryItem)
        .where(and_(InventoryItem.id == item_id, InventoryItem.company_id == company_id))
        .options(selectinload(InventoryItem.category))
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
    Vytvoří novou položku ve skladu včetně EAN, ceny a DPH.
    - SKU musí být unikátní v rámci firmy.
    - Automaticky vytvoří auditní záznam.
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
        item_id=item.id, user_id=user_id, company_id=company_id,
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
    Vrátí seznam skladových položek s možností stránkování a filtrování podle kategorie.
    """
    stmt = (
        select(InventoryItem)
        .where(InventoryItem.company_id == company_id)
        .options(selectinload(InventoryItem.category))
        .offset(skip).limit(limit)
    )
    if category_id is not None:
        stmt = stmt.where(InventoryItem.category_id == category_id)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.get(
    "/by-ean/{ean}",
    response_model=InventoryItemOut,
    summary="Získání položky podle EAN kódu"
)
async def get_inventory_item_by_ean(
    company_id: int,
    ean: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access)
):
    """Najde a vrátí jednu skladovou položku na základě jejího EAN kódu v rámci dané firmy."""
    stmt = (
        select(InventoryItem)
        .where(and_(InventoryItem.company_id == company_id, InventoryItem.ean == ean))
        .options(selectinload(InventoryItem.category))
    )
    result = await db.execute(stmt)
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Inventory item with EAN '{ean}' not found in this company."
        )
    return item

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
    """Vrátí detail jedné skladové položky podle jejího ID."""
    return await get_item_or_404(item_id, company_id, db)

@router.post(
    "/{item_id}/upload-image",
    response_model=InventoryItemOut,
    summary="Nahrání obrázku k položce ve skladu"
)
async def upload_inventory_item_image(
    company_id: int,
    item_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    token: Dict[str, Any] = Depends(require_inventory_editor_access)
):
    """
    Nahraje a přiřadí obrázek k existující skladové položce.
    - Vytvoří auditní záznam o změně obrázku.
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid file type, only images are allowed.")

    item = await get_item_or_404(item_id, company_id, db)
    
    file_extension = Path(file.filename).suffix
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = UPLOAD_DIRECTORY / unique_filename
    
    try:
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    finally:
        file.file.close()

    original_image_url = item.image_url
    item.image_url = f"/static/images/inventory/{unique_filename}"
    
    user_id = int(token.get("sub"))
    log = InventoryAuditLog(
        item_id=item.id, user_id=user_id, company_id=company_id,
        action=AuditLogAction.updated,
        details=f"Obrázek změněn z '{original_image_url}' na '{item.image_url}'."
    )
    db.add(log)
    
    await db.commit()
    await db.refresh(item)
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
    Aktualizuje vlastnosti položky (název, EAN, cena, DPH, kategorie atd.).
    - Vytváří auditní záznam o změnách.
    """
    item = await get_item_or_404(item_id, company_id, db)
    user_id = int(token.get("sub"))
    
    update_data = payload.dict(exclude_unset=True)
    if not update_data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No data provided for update")

    changes = []
    for key, value in update_data.items():
        if getattr(item, key) != value:
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
    """Trvale odstraní položku ze skladu a vytvoří o tom auditní záznam."""
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