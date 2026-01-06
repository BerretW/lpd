# app/routers/categories.py
from typing import List, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError

from app.db.database import get_db
from app.db.models import InventoryCategory, InventoryItem
from app.schemas.category import CategoryCreateIn, CategoryOut, CategoryUpdateIn
from app.core.dependencies import require_company_access

router = APIRouter(prefix="/companies/{company_id}/categories", tags=["inventory-categories"])

@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
async def create_category(
    company_id: int,
    payload: CategoryCreateIn,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access)
):
    category = InventoryCategory(**payload.dict(), company_id=company_id)
    db.add(category)
    await db.commit()
    await db.refresh(category, attribute_names=['children'])
    return category

# !!! ZDE JE OPRAVA - ODSTRANĚN DUPLICITNÍ DEKORÁTOR A ZMĚNA V LOGICE !!!
@router.get("", response_model=List[CategoryOut])
async def list_categories(
    company_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access)
):
    """Vrátí stromovou strukturu všech kategorií pro danou firmu."""
    stmt = select(InventoryCategory).where(InventoryCategory.company_id == company_id)
    result = await db.execute(stmt)
    all_categories_db = result.scalars().all()

    if not all_categories_db:
        return []

    # Vytvoříme Pydantic modely, ale explicitně definujeme, které atributy se mají použít,
    # abychom se vyhnuli přístupu k 'children' relationship.
    category_out_map: Dict[int, CategoryOut] = {}
    for category in all_categories_db:
        # Vytvoříme slovník jen s bezpečnými atributy
        safe_data = {
            "id": category.id,
            "name": category.name,
            "parent_id": category.parent_id
            # Atribut 'children' záměrně vynecháváme, Pydantic použije defaultní hodnotu []
        }
        category_out_map[category.id] = CategoryOut.model_validate(safe_data)

    # Zbytek kódu pro sestavení stromu je již v pořádku a zůstává stejný
    root_categories_out: List[CategoryOut] = []
    for category_db in all_categories_db:
        category_out = category_out_map[category_db.id]
        
        if category_db.parent_id is not None:
            parent_out = category_out_map.get(category_db.parent_id)
            if parent_out:
                parent_out.children.append(category_out)
        else:
            root_categories_out.append(category_out)

    return root_categories_out

@router.patch("/{category_id}", response_model=CategoryOut)
async def update_category(
    company_id: int,
    category_id: int,
    payload: CategoryUpdateIn,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access)
):
    stmt = select(InventoryCategory).where(InventoryCategory.id == category_id, InventoryCategory.company_id == company_id)
    category = (await db.execute(stmt)).scalar_one_or_none()
    
    if not category:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")

    update_data = payload.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(category, key, value)
    
    await db.commit()
    await db.refresh(category, attribute_names=['children'])
    return category

@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    company_id: int,
    category_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access)
):
    stmt_children = select(InventoryCategory.id).where(InventoryCategory.parent_id == category_id).limit(1)
    if (await db.execute(stmt_children)).scalar_one_or_none():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot delete category with sub-categories.")

    stmt_items = select(InventoryItem.id).where(InventoryItem.categories_id == category_id).limit(1)
    if (await db.execute(stmt_items)).scalar_one_or_none():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot delete category that contains inventory items.")

    category = (await db.execute(select(InventoryCategory).where(InventoryCategory.id == category_id, InventoryCategory.company_id == company_id))).scalar_one_or_none()
    if category:
        await db.delete(category)
        await db.commit()
    else:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")