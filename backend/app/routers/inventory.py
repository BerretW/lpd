# backend/app/routers/inventory.py
import shutil
import uuid
from pathlib import Path
from typing import List, Dict, Any, Set
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from app.db.database import get_db
from app.db.models import InventoryItem, InventoryAuditLog, AuditLogAction, InventoryCategory
from app.schemas.inventory import InventoryItemCreateIn, InventoryItemOut, InventoryItemUpdateIn
from app.core.dependencies import require_company_access, require_admin_access

UPLOAD_DIRECTORY = Path("static/images/inventory")
UPLOAD_DIRECTORY.mkdir(parents=True, exist_ok=True)

# --- NOVÁ POMOCNÁ FUNKCE PRO ZÍSKÁNÍ STROMU ID KATEGORIÍ ---
async def _get_descendant_category_ids(db: AsyncSession, company_id: int, parent_category_id: int) -> Set[int]:
    """
    Najde ID dané kategorie a všech jejích podkategorií (potomků).
    """
    all_categories_stmt = select(InventoryCategory.id, InventoryCategory.parent_id).where(InventoryCategory.company_id == company_id)
    result = await db.execute(all_categories_stmt)
    
    parent_map = {}
    for cat_id, p_id in result.all():
        if p_id not in parent_map:
            parent_map[p_id] = []
        parent_map[p_id].append(cat_id)

    all_ids_in_subtree = {parent_category_id}
    queue = [parent_category_id]
    
    while queue:
        current_id = queue.pop(0)
        children = parent_map.get(current_id, [])
        for child_id in children:
            if child_id not in all_ids_in_subtree:
                all_ids_in_subtree.add(child_id)
                queue.append(child_id)
    
    return all_ids_in_subtree


# --- Pomocné funkce ---

async def get_item_or_404(item_id: int, company_id: int, db: AsyncSession) -> InventoryItem:
    stmt = (
        select(InventoryItem)
        .where(and_(InventoryItem.id == item_id, InventoryItem.company_id == company_id))
    )
    result = await db.execute(stmt)
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inventory item not found")
    return item

async def get_full_inventory_item(item_id: int, db: AsyncSession) -> InventoryItem:
    """Načte položku se VŠEMI potřebnými vnořenými vztahy."""
    stmt = (
        select(InventoryItem)
        .where(InventoryItem.id == item_id)
        .options(
            selectinload(InventoryItem.category)
            .selectinload(InventoryCategory.children)
            .selectinload(InventoryCategory.children)
            .selectinload(InventoryCategory.children)
        )
    )
    result = await db.execute(stmt)
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Could not reload inventory item.")
    return item

# --- API Router ---
router = APIRouter(prefix="/companies/{company_id}/inventory", tags=["inventory"])

@router.get("", response_model=List[InventoryItemOut])
async def list_inventory_items(
    company_id: int,
    category_id: int | None = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access)
):
    """
    Vrátí seznam skladových položek. Pokud je specifikováno `category_id`,
    vrátí položky z této kategorie A VŠECH JEJÍCH PODKATEGORIÍ.
    """
    stmt = (
        select(InventoryItem)
        .where(InventoryItem.company_id == company_id)
        .options(
            selectinload(InventoryItem.category)
            .selectinload(InventoryCategory.children)
            .selectinload(InventoryCategory.children)
            .selectinload(InventoryCategory.children)
        )
    )

    # --- UPRAVENÁ LOGIKA FILTROVÁNÍ ---
    if category_id is not None:
        # Získáme ID dané kategorie a všech jejích potomků.
        all_relevant_category_ids = await _get_descendant_category_ids(db, company_id, category_id)
        
        # Aplikujeme filtr pomocí operátoru 'IN'.
        if all_relevant_category_ids:
            stmt = stmt.where(InventoryItem.category_id.in_(all_relevant_category_ids))
        else:
            # Pokud kategorie neexistuje nebo nemá potomky a je prázdná, vrátíme prázdný seznam
            return []
    
    # Aplikujeme stránkování až po všech filtrech
    stmt = stmt.offset(skip).limit(limit)
    
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post(
    "",
    response_model=InventoryItemOut,
    status_code=status.HTTP_201_CREATED,
    summary="Vytvoření nové položky ve skladu (pouze pro adminy)"
)
async def create_inventory_item(
    company_id: int,
    payload: InventoryItemCreateIn,
    db: AsyncSession = Depends(get_db),
    token: Dict[str, Any] = Depends(require_admin_access)
):
    stmt = select(InventoryItem).where(
        and_(InventoryItem.company_id == company_id, InventoryItem.sku == payload.sku)
    )
    if (await db.execute(stmt)).scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Item with SKU '{payload.sku}' already exists.")

    item = InventoryItem(**payload.dict(), company_id=company_id)
    db.add(item)
    await db.commit()

    user_id = int(token.get("sub"))
    log = InventoryAuditLog(
        item_id=item.id, user_id=user_id, company_id=company_id,
        action=AuditLogAction.created, details=f"Položka '{item.name}' byla vytvořena."
    )
    db.add(log)
    await db.commit()

    return await get_full_inventory_item(item.id, db)


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
    stmt = (
        select(InventoryItem)
        .where(and_(InventoryItem.company_id == company_id, InventoryItem.ean == ean))
    )
    item = (await db.execute(stmt)).scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Item with EAN '{ean}' not found.")
    
    return await get_full_inventory_item(item.id, db)

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
    await get_item_or_404(item_id, company_id, db)
    return await get_full_inventory_item(item_id, db)

@router.post(
    "/{item_id}/upload-image",
    response_model=InventoryItemOut,
    summary="Nahrání obrázku k položce (pouze pro adminy)"
)
async def upload_inventory_item_image(
    company_id: int,
    item_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    token: Dict[str, Any] = Depends(require_admin_access)
):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid file type.")

    item = await get_item_or_404(item_id, company_id, db)
    
    file_extension = Path(file.filename).suffix
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = UPLOAD_DIRECTORY / unique_filename
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

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
    
    return await get_full_inventory_item(item.id, db)

@router.patch(
    "/{item_id}",
    response_model=InventoryItemOut,
    summary="Aktualizace skladové položky (pouze pro adminy)"
)
async def update_inventory_item(
    company_id: int,
    item_id: int,
    payload: InventoryItemUpdateIn,
    db: AsyncSession = Depends(get_db),
    token: Dict[str, Any] = Depends(require_admin_access)
):
    item = await get_item_or_404(item_id, company_id, db)
    user_id = int(token.get("sub"))
    
    update_data = payload.dict(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No data for update.")

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
    
    return await get_full_inventory_item(item.id, db)

@router.delete(
    "/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Smazání skladové položky (pouze pro adminy)"
)
async def delete_inventory_item(
    company_id: int,
    item_id: int,
    db: AsyncSession = Depends(get_db),
    token: Dict[str, Any] = Depends(require_admin_access)
):
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