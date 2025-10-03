from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError

from app.db.database import get_db
from app.db.models import InventoryCategory, InventoryItem
from app.schemas.category import CategoryCreateIn, CategoryOut, CategoryUpdateIn
from app.routers.companies import require_company_access

router = APIRouter(prefix="/companies/{company_id}/categories", tags=["inventory-categories"])

@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
async def create_category(
    company_id: int,
    payload: CategoryCreateIn,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access)
):
    """Vytvoří novou kategorii nebo podkategorii."""
    try:
        category = InventoryCategory(**payload.dict(), company_id=company_id)
        db.add(category)
        await db.commit()
        await db.refresh(category)
        return category
    except IntegrityError as e:
        await db.rollback()
        # Zkontrolujeme, zda se jedná o porušení unique constraint pro název kategorie
        if "uq_category_company_name_parent" in str(e.orig):
            parent_text = "hlavní kategorii" if payload.parent_id is None else "podkategorii"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Kategorie s názvem '{payload.name}' již jako {parent_text} existuje."
            )
        # Jiná chyba integrity - necháme ji projít jako obecnou chybu
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Chyba při vytváření kategorie."
        )



@router.get("", response_model=List[CategoryOut])
async def list_categories(
    company_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access)
):
    """Vrátí stromovou strukturu všech kategorií pro danou firmu."""
    stmt = (
        select(InventoryCategory)
        .where(InventoryCategory.company_id == company_id, InventoryCategory.parent_id == None)
        .options(selectinload(InventoryCategory.children)) # Eager load pro podkategorie
    )
    result = await db.execute(stmt)
    return result.scalars().all()

@router.patch("/{category_id}", response_model=CategoryOut)
async def update_category(
    company_id: int,
    category_id: int,
    payload: CategoryUpdateIn,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access)
):
    """Aktualizuje název nebo rodiče kategorie."""
    stmt = select(InventoryCategory).where(InventoryCategory.id == category_id, InventoryCategory.company_id == company_id)
    result = await db.execute(stmt)
    category = result.scalar_one_or_none()
    
    if not category:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")

    update_data = payload.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(category, key, value)
    
    await db.commit()
    await db.refresh(category)
    return category

@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    company_id: int,
    category_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access)
):
    """Smaže kategorii. Lze smazat pouze kategorii, která nemá žádné podkategorie ani položky."""
    # Zkontrolujeme, zda kategorie nema podkategorie
    stmt_children = select(InventoryCategory.id).where(InventoryCategory.parent_id == category_id).limit(1)
    has_children = (await db.execute(stmt_children)).scalar_one_or_none()
    if has_children:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot delete category with sub-categories.")

    # Zkontrolujeme, zda v kategorii nejsou nejake polozky
    stmt_items = select(InventoryItem.id).where(InventoryItem.category_id == category_id).limit(1)
    has_items = (await db.execute(stmt_items)).scalar_one_or_none()
    if has_items:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot delete category that contains inventory items.")

    stmt = select(InventoryCategory).where(InventoryCategory.id == category_id, InventoryCategory.company_id == company_id)
    result = await db.execute(stmt)
    category = result.scalar_one_or_none()

    if category:
        await db.delete(category)
        await db.commit()