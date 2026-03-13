from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete, select, text

from app.db.database import get_db
from app.db.models import InventoryItem, InventoryCategory, UsedInventoryItem
from app.core.dependencies import require_admin_access

router = APIRouter(prefix="/plugins/inventory-wipe", tags=["inventory-wipe"])


async def _delete_items(company_id: int, db: AsyncSession) -> None:
    """Smaže záznamy použití položek ve výkazech, pak položky samotné."""
    item_ids = (await db.execute(
        select(InventoryItem.id).where(InventoryItem.company_id == company_id)
    )).scalars().all()
    if item_ids:
        await db.execute(
            delete(UsedInventoryItem).where(UsedInventoryItem.inventory_item_id.in_(item_ids))
        )
    await db.execute(delete(InventoryItem).where(InventoryItem.company_id == company_id))


async def _delete_categories(company_id: int, db: AsyncSession) -> None:
    """Smaže všechny kategorie firmy — FK checks dočasně vypnuty kvůli self-ref. FK."""
    await db.execute(text("SET FOREIGN_KEY_CHECKS=0"))
    await db.execute(delete(InventoryCategory).where(InventoryCategory.company_id == company_id))
    await db.execute(text("SET FOREIGN_KEY_CHECKS=1"))


@router.delete("/{company_id}/items", status_code=status.HTTP_204_NO_CONTENT)
async def wipe_inventory_items(
    company_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin_access),
):
    """Smaže všechny skladové položky firmy. Cascade smaže zásoby a vazby na kategorie."""
    await _delete_items(company_id, db)
    await db.commit()


@router.delete("/{company_id}/categories", status_code=status.HTTP_204_NO_CONTENT)
async def wipe_inventory_categories(
    company_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin_access),
):
    """Smaže všechny kategorie firmy."""
    await _delete_categories(company_id, db)
    await db.commit()


@router.delete("/{company_id}/all", status_code=status.HTTP_204_NO_CONTENT)
async def wipe_inventory_all(
    company_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin_access),
):
    """Smaže všechny položky i kategorie firmy."""
    await _delete_items(company_id, db)
    await _delete_categories(company_id, db)
    await db.commit()
