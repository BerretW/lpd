# backend/app/routers/locations.py
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.database import get_db
from app.db.models import Location, ItemLocationStock, User, Membership, RoleEnum, InventoryItem
from app.schemas.location import (
    LocationCreateIn, LocationOut, LocationUpdateIn,
    LocationPermissionCreateIn, LocationStockItemOut
)
from app.schemas.user import UserOut
from app.core.dependencies import require_admin_access, require_company_access
from app.services.user_service import get_user_by_email


router = APIRouter(prefix="/companies/{company_id}/locations", tags=["inventory-locations"])

async def get_location_or_404(db: AsyncSession, company_id: int, location_id: int, with_users: bool = False) -> Location:
    stmt = select(Location).where(Location.id == location_id, Location.company_id == company_id)
    if with_users:
        # Eager loading pro načtení oprávněných uživatelů
        stmt = stmt.options(selectinload(Location.authorized_users))
        
    location = (await db.execute(stmt)).scalar_one_or_none()
    if not location:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")
    return location

@router.post("", response_model=LocationOut, status_code=status.HTTP_201_CREATED)
async def create_location(
    company_id: int,
    payload: LocationCreateIn,
    db: AsyncSession = Depends(get_db),
    _ = Depends(require_admin_access)
):
    location = Location(**payload.dict(), company_id=company_id)
    db.add(location)
    await db.commit()
    # Explicitně řekneme, aby se při refresh načetl i vztah 'authorized_users'.
    # U nové lokace bude tento seznam prázdný, ale bude načtený, což zabrání lazy loadu.
    await db.refresh(location, attribute_names=['authorized_users'])
    return location

@router.get("", response_model=List[LocationOut])
async def list_locations(
    company_id: int,
    db: AsyncSession = Depends(get_db),
    _ = Depends(require_admin_access)
):
    # Tento endpoint je v pořádku, protože používá selectinload
    stmt = select(Location).where(Location.company_id == company_id).options(selectinload(Location.authorized_users)).order_by(Location.name)
    return (await db.execute(stmt)).scalars().all()


# --- ENDPOINT PRO ZÍSKÁNÍ MÝCH LOKACÍ ---
@router.get(
    "/my-locations",
    response_model=List[LocationOut],
    summary="Získání lokací, ke kterým má přihlášený uživatel přístup"
)
async def get_my_accessible_locations(
    company_id: int,
    db: AsyncSession = Depends(get_db),
    payload: dict = Depends(require_company_access)
):
    """
    Vrátí seznam skladových lokací na základě oprávnění přihlášeného uživatele.
    - Administrátoři a vlastníci firmy vidí všechny lokace.
    - Běžní členové vidí pouze ty lokace, ke kterým jim bylo explicitně přiděleno oprávnění.
    """
    user_id = int(payload.get("sub"))

    # Zjistíme roli uživatele v dané firmě
    role_stmt = select(Membership.role).where(
        Membership.user_id == user_id,
        Membership.company_id == company_id
    )
    user_role = (await db.execute(role_stmt)).scalar_one_or_none()

    if not user_role:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is not a member of this company.")

    # Administrátoři vidí vše
    if user_role in [RoleEnum.owner, RoleEnum.admin]:
        stmt = (
            select(Location)
            .where(Location.company_id == company_id)
            .options(selectinload(Location.authorized_users))
            .order_by(Location.name)
        )
    # Běžní členové vidí jen své lokace
    else:
        stmt = (
            select(Location)
            .join(Location.authorized_users)
            .where(
                Location.company_id == company_id,
                User.id == user_id
            )
            .options(selectinload(Location.authorized_users))
            .order_by(Location.name)
        )

    result = await db.execute(stmt)
    return result.scalars().all()

# --- NOVÝ ENDPOINT PRO ZÍSKÁNÍ POLOŽEK V LOKACI ---
@router.get(
    "/{location_id}/inventory",
    response_model=List[LocationStockItemOut],
    summary="Získání seznamu všech položek na dané lokaci"
)
async def get_location_inventory(
    company_id: int,
    location_id: int,
    db: AsyncSession = Depends(get_db),
    payload: dict = Depends(require_company_access)
):
    """
    Vrátí seznam všech skladových položek, které se nacházejí na dané lokaci
    (s množstvím větším než 0).
    Přístup je povolen administrátorům a uživatelům, kteří mají k této
    lokaci explicitní oprávnění.
    """
    user_id = int(payload.get("sub"))
    
    # 1. Ověření oprávnění
    location = await get_location_or_404(db, company_id, location_id, with_users=True)
    
    role_stmt = select(Membership.role).where(
        Membership.user_id == user_id,
        Membership.company_id == company_id
    )
    user_role = (await db.execute(role_stmt)).scalar_one_or_none()
    
    is_admin = user_role in [RoleEnum.owner, RoleEnum.admin]
    is_authorized = any(user.id == user_id for user in location.authorized_users)

    if not is_admin and not is_authorized:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this location."
        )

    # 2. Sestavení dotazu na položky
    stmt = (
        select(ItemLocationStock)
        .join(ItemLocationStock.inventory_item)
        .where(
            ItemLocationStock.location_id == location_id,
            ItemLocationStock.quantity > 0
        )
        .options(selectinload(ItemLocationStock.inventory_item))
        .order_by(InventoryItem.name.asc())
    )
    
    result = await db.execute(stmt)
    return result.scalars().all()


@router.patch("/{location_id}", response_model=LocationOut)
async def update_location(
    company_id: int,
    location_id: int,
    payload: LocationUpdateIn,
    db: AsyncSession = Depends(get_db),
    _ = Depends(require_admin_access)
):
    location = await get_location_or_404(db, company_id, location_id)
    update_data = payload.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(location, key, value)
    await db.commit()
    # I při úpravě je potřeba zajistit eager loading před návratem.
    await db.refresh(location, attribute_names=['authorized_users'])
    return location

@router.delete("/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_location(
    company_id: int,
    location_id: int,
    db: AsyncSession = Depends(get_db),
    _ = Depends(require_admin_access)
):
    location = await get_location_or_404(db, company_id, location_id)
    
    stmt = select(ItemLocationStock).where(ItemLocationStock.location_id == location_id, ItemLocationStock.quantity > 0).limit(1)
    if (await db.execute(stmt)).scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete location with stock. Please move items first."
        )
        
    await db.delete(location)
    await db.commit()

# --- ENDPOINTY PRO SPRÁVU OPRÁVNĚNÍ ---

@router.get(
    "/{location_id}/permissions",
    response_model=List[UserOut],
    summary="Získání všech oprávněných uživatelů pro lokaci"
)
async def get_location_permissions(
    company_id: int,
    location_id: int,
    db: AsyncSession = Depends(get_db),
    _ = Depends(require_admin_access)
):
    """Vrátí seznam uživatelů, kteří mají oprávnění k této lokaci."""
    location = await get_location_or_404(db, company_id, location_id, with_users=True)
    return location.authorized_users

@router.post(
    "/{location_id}/permissions",
    response_model=List[UserOut],
    status_code=status.HTTP_201_CREATED,
    summary="Přidání oprávnění uživateli pro lokaci"
)
async def add_location_permission(
    company_id: int,
    location_id: int,
    payload: LocationPermissionCreateIn,
    db: AsyncSession = Depends(get_db),
    _ = Depends(require_admin_access)
):
    """
    Přidá uživateli (podle e-mailu) oprávnění k lokaci.
    Uživatel musí být členem dané firmy.
    """
    location = await get_location_or_404(db, company_id, location_id, with_users=True)
    user = await get_user_by_email(db, payload.user_email)

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User with this email not found.")

    membership_stmt = select(Membership).where(
        Membership.company_id == company_id,
        Membership.user_id == user.id
    )
    if not (await db.execute(membership_stmt)).scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is not a member of this company.")

    if user in location.authorized_users:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already has permission for this location.")

    location.authorized_users.append(user)
    await db.commit()
    await db.refresh(location, attribute_names=['authorized_users'])

    return location.authorized_users

@router.delete(
    "/{location_id}/permissions/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Odebrání oprávnění uživateli pro lokaci"
)
async def remove_location_permission(
    company_id: int,
    location_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _ = Depends(require_admin_access)
):
    """Odebere uživateli oprávnění k dané lokaci."""
    location = await get_location_or_404(db, company_id, location_id, with_users=True)
    user_to_remove = await db.get(User, user_id)

    if not user_to_remove:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User to remove not found.")

    if user_to_remove not in location.authorized_users:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User does not have permission for this location.")

    location.authorized_users.remove(user_to_remove)
    await db.commit()