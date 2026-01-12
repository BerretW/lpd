# backend/app/routers/inventory.py
import shutil
import uuid
from pathlib import Path
from typing import List, Dict, Any, Set
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from sqlalchemy.orm import selectinload
from sqlalchemy import select

from app.db.database import get_db
from app.db.models import (
    InventoryItem, InventoryAuditLog, AuditLogAction, 
    InventoryCategory, ItemLocationStock, Location
)
from app.schemas.inventory import InventoryItemCreateIn, InventoryItemOut, InventoryItemUpdateIn
from app.core.dependencies import require_company_access, require_admin_access

UPLOAD_DIRECTORY = Path("static/images/inventory")
UPLOAD_DIRECTORY.mkdir(parents=True, exist_ok=True)

async def _get_descendant_category_ids(db: AsyncSession, company_id: int, parent_category_id: int) -> Set[int]:
    all_categories_stmt = select(InventoryCategory.id, InventoryCategory.parent_id).where(InventoryCategory.company_id == company_id)
    result = await db.execute(all_categories_stmt)
    parent_map = {}
    for cat_id, p_id in result.all():
        if p_id not in parent_map: parent_map[p_id] = []
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
    stmt = (
        select(InventoryItem)
        .where(InventoryItem.id == item_id)
        .options(
            selectinload(InventoryItem.categories)
                .selectinload(InventoryCategory.children),
            selectinload(InventoryItem.locations)
                .selectinload(ItemLocationStock.location)
                .selectinload(Location.authorized_users), # <--- PŘIDÁNA TATO ŘÁDKA
            selectinload(InventoryItem.manufacturer),
            selectinload(InventoryItem.supplier)
        )
    )
    result = await db.execute(stmt)
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Could not reload inventory item.")
    return item

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
    stmt = (
        select(InventoryItem)
        .where(InventoryItem.company_id == company_id)
        .options(
            selectinload(InventoryItem.categories)
                .selectinload(InventoryCategory.children),
            selectinload(InventoryItem.locations)
                .selectinload(ItemLocationStock.location)
                .selectinload(Location.authorized_users) # <--- PŘIDÁNA TATO ŘÁDKA
            selectinload(InventoryItem.manufacturer),
            selectinload(InventoryItem.supplier)
        )
    )
    # ... zbytek funkce (filtrování podle kategorií, limit, offset) ...
    if category_id is not None:
        all_relevant_category_ids = await _get_descendant_category_ids(db, company_id, category_id)
        if all_relevant_category_ids:
            stmt = stmt.join(InventoryItem.categories).where(InventoryCategory.id.in_(all_relevant_category_ids))
        else:
            return []
    
    stmt = stmt.offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("", response_model=InventoryItemOut, status_code=status.HTTP_201_CREATED)
async def create_inventory_item(
    company_id: int,
    payload: InventoryItemCreateIn,
    db: AsyncSession = Depends(get_db),
    token: Dict[str, Any] = Depends(require_admin_access)
):
    stmt_sku = select(InventoryItem).where(InventoryItem.company_id == company_id, InventoryItem.sku == payload.sku)
    if (await db.execute(stmt_sku)).scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, f"Item with SKU {payload.sku} already exists.")

    # Vyjmeme category_ids, protože v modelu se jmenuje categories a je to kolekce objektů
    item_dict = payload.dict(exclude={"category_ids"})
    item = InventoryItem(**item_dict, company_id=company_id)
    
    # Přiřazení kategorií
    if payload.category_ids:
        cat_stmt = select(InventoryCategory).where(
            and_(InventoryCategory.id.in_(payload.category_ids), InventoryCategory.company_id == company_id)
        )
        categories = (await db.execute(cat_stmt)).scalars().all()
        item.categories = list(categories)

    db.add(item)
    await db.commit() 

    user_id = int(token.get("sub"))
    log = InventoryAuditLog(
        item_id=item.id, user_id=user_id, company_id=company_id,
        action=AuditLogAction.created, details=f"Položka '{item.name}' vytvořena."
    )
    db.add(log)
    await db.commit()

    return await get_full_inventory_item(item.id, db)

@router.patch("/{item_id}", response_model=InventoryItemOut)
async def update_inventory_item(
    company_id: int, item_id: int, payload: InventoryItemUpdateIn,
    db: AsyncSession = Depends(get_db), token: Dict[str, Any] = Depends(require_admin_access)
):
    # Načteme položku včetně kategorií pro porovnání
    stmt = select(InventoryItem).where(
        InventoryItem.id == item_id, InventoryItem.company_id == company_id
    ).options(selectinload(InventoryItem.categories))
    item = (await db.execute(stmt)).scalar_one_or_none()
    
    if not item:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Item not found")

    user_id = int(token.get("sub"))
    update_data = payload.dict(exclude_unset=True)
    
    changes = []

    # Zpracování kategorií odděleně
    if "category_ids" in update_data:
        new_cat_ids = update_data.pop("category_ids")
        cat_stmt = select(InventoryCategory).where(
            and_(InventoryCategory.id.in_(new_cat_ids), InventoryCategory.company_id == company_id)
        )
        new_categories = (await db.execute(cat_stmt)).scalars().all()
        item.categories = list(new_categories)
        changes.append("Změna přiřazených kategorií.")

    # Ostatní pole
    for key, value in update_data.items():
        if getattr(item, key) != value:
            changes.append(f"Pole '{key}' změněno.")
            setattr(item, key, value)
    
    if changes:
        log = InventoryAuditLog(
            item_id=item.id, user_id=user_id, company_id=company_id,
            action=AuditLogAction.updated, details=" | ".join(changes)
        )
        db.add(log)
        await db.commit()
    
    return await get_full_inventory_item(item.id, db)

# ... (ostatní endpointy jako delete, upload-image zůstávají stejné) ...
@router.get("/by-ean/{ean}", response_model=InventoryItemOut)
async def get_inventory_item_by_ean(
    company_id: int, ean: str, db: AsyncSession = Depends(get_db), _=Depends(require_company_access)
):
    stmt = select(InventoryItem).where(and_(InventoryItem.company_id == company_id, InventoryItem.ean == ean))
    item = (await db.execute(stmt)).scalar_one_or_none()
    if not item:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Item with EAN '{ean}' not found.")
    return await get_full_inventory_item(item.id, db)

@router.get("/{item_id}", response_model=InventoryItemOut)
async def get_inventory_item(item_id: int, db: AsyncSession = Depends(get_db)): 
    result = await db.execute(
        select(InventoryItem)
        .where(InventoryItem.id == item_id)
        .options(
            selectinload(InventoryItem.categories).selectinload(InventoryCategory.children)
        )
    )
    return result.scalar_one_or_none()

@router.post("/{item_id}/upload-image", response_model=InventoryItemOut)
async def upload_inventory_item_image(
    company_id: int, item_id: int, file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db), token: Dict[str, Any] = Depends(require_admin_access)
):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid file type.")
    item = await get_item_or_404(item_id, company_id, db)
    file_extension = Path(file.filename).suffix
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = UPLOAD_DIRECTORY / unique_filename
    with file_path.open("wb") as buffer: shutil.copyfileobj(file.file, buffer)
    item.image_url = f"/static/images/inventory/{unique_filename}"
    await db.commit()
    return await get_full_inventory_item(item.id, db)

@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_inventory_item(
    company_id: int, item_id: int, db: AsyncSession = Depends(get_db), token: Dict[str, Any] = Depends(require_admin_access)
):
    item = await get_item_or_404(item_id, company_id, db)
    # Kontrola stavu zásob před smazáním
    stmt = select(func.sum(ItemLocationStock.quantity)).where(ItemLocationStock.inventory_item_id == item_id)
    total_stock = (await db.execute(stmt)).scalar_one_or_none() or 0
    if total_stock > 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Cannot delete item with stock ({total_stock} pcs).")

    await db.delete(item)
    await db.commit()