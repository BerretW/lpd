from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.db.database import get_db
from app.core.dependencies import require_company_access, require_admin_access
from .models import ObjTechType, ObjTechField, ObjAccessoryType, ObjSite, ObjTechInstance, ObjTechElement
from .schemas import (
    ObjTechTypeIn, ObjTechTypeUpdate, ObjTechTypeOut,
    ObjTechFieldIn, ObjTechFieldUpdate, ObjTechFieldOut,
    ObjAccessoryTypeIn, ObjAccessoryTypeUpdate, ObjAccessoryTypeOut,
    ObjSiteIn, ObjSiteUpdate, ObjSiteOut,
    ObjTechInstanceIn, ObjTechInstanceOut,
    ObjTechElementIn, ObjTechElementOut,
)

router = APIRouter(prefix="/plugins/objects", tags=["plugin-objects"])


# ─── Helpers ──────────────────────────────────────────────────────────────────

async def _get_customer_name(customer_id: int | None, db: AsyncSession) -> str | None:
    if not customer_id:
        return None
    from app.db.models import Client
    stmt = select(Client.name).where(Client.id == customer_id)
    return (await db.execute(stmt)).scalar_one_or_none()


async def _build_site_out(site: ObjSite, db: AsyncSession) -> ObjSiteOut:
    out = ObjSiteOut.model_validate(site)
    out.customer_name = await _get_customer_name(site.customer_id, db)
    return out


async def _get_site(site_id: int, company_id: int, db: AsyncSession) -> ObjSite:
    stmt = select(ObjSite).where(ObjSite.id == site_id, ObjSite.company_id == company_id)
    site = (await db.execute(stmt)).scalar_one_or_none()
    if not site:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Objekt nenalezen.")
    return site


async def _get_tech_type(type_id: int, company_id: int, db: AsyncSession) -> ObjTechType:
    stmt = select(ObjTechType).where(ObjTechType.id == type_id, ObjTechType.company_id == company_id)
    tt = (await db.execute(stmt)).scalar_one_or_none()
    if not tt:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Typ technologie nenalezen.")
    return tt


# ─── Tech Types (admin) ───────────────────────────────────────────────────────

@router.get("/{company_id}/tech-types", response_model=list[ObjTechTypeOut])
async def list_tech_types(
    company_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access),
):
    stmt = select(ObjTechType).where(ObjTechType.company_id == company_id)
    tech_types = (await db.execute(stmt)).scalars().all()

    # Count elements per tech type
    count_stmt = (
        select(ObjTechInstance.tech_type_id, func.count(ObjTechElement.id).label("cnt"))
        .join(ObjTechElement, ObjTechElement.instance_id == ObjTechInstance.id)
        .where(ObjTechInstance.tech_type_id.in_([tt.id for tt in tech_types]))
        .group_by(ObjTechInstance.tech_type_id)
    )
    counts = {row.tech_type_id: row.cnt for row in (await db.execute(count_stmt)).all()}

    result = []
    for tt in tech_types:
        out = ObjTechTypeOut.model_validate(tt)
        out.element_count = counts.get(tt.id, 0)
        result.append(out)
    return result


@router.post("/{company_id}/tech-types", response_model=ObjTechTypeOut, status_code=201)
async def create_tech_type(
    company_id: int,
    payload: ObjTechTypeIn,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin_access),
):
    tt = ObjTechType(**payload.model_dump(), company_id=company_id)
    db.add(tt)
    await db.commit()
    await db.refresh(tt)
    return tt


@router.patch("/{company_id}/tech-types/{type_id}", response_model=ObjTechTypeOut)
async def update_tech_type(
    company_id: int,
    type_id: int,
    payload: ObjTechTypeUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin_access),
):
    tt = await _get_tech_type(type_id, company_id, db)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(tt, k, v)
    await db.commit()
    await db.refresh(tt)
    return tt


@router.delete("/{company_id}/tech-types/{type_id}", status_code=204)
async def delete_tech_type(
    company_id: int,
    type_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin_access),
):
    tt = await _get_tech_type(type_id, company_id, db)
    await db.delete(tt)
    await db.commit()


# ─── Tech Fields (admin) ──────────────────────────────────────────────────────

@router.post("/{company_id}/tech-types/{type_id}/fields", response_model=ObjTechFieldOut, status_code=201)
async def create_tech_field(
    company_id: int,
    type_id: int,
    payload: ObjTechFieldIn,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin_access),
):
    await _get_tech_type(type_id, company_id, db)
    field = ObjTechField(**payload.model_dump(), tech_type_id=type_id)
    db.add(field)
    await db.commit()
    await db.refresh(field)
    return field


@router.patch("/{company_id}/tech-types/{type_id}/fields/{field_id}", response_model=ObjTechFieldOut)
async def update_tech_field(
    company_id: int,
    type_id: int,
    field_id: int,
    payload: ObjTechFieldUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin_access),
):
    await _get_tech_type(type_id, company_id, db)
    stmt = select(ObjTechField).where(ObjTechField.id == field_id, ObjTechField.tech_type_id == type_id)
    field = (await db.execute(stmt)).scalar_one_or_none()
    if not field:
        raise HTTPException(404, "Pole nenalezeno.")
    updates = payload.model_dump(exclude_unset=True)
    if updates.get("is_main"):
        # Unset is_main on all other fields of this tech type
        other_stmt = select(ObjTechField).where(
            ObjTechField.tech_type_id == type_id,
            ObjTechField.id != field_id,
            ObjTechField.is_main == True,
        )
        for other in (await db.execute(other_stmt)).scalars().all():
            other.is_main = False
    for k, v in updates.items():
        setattr(field, k, v)
    await db.commit()
    await db.refresh(field)
    return field


@router.delete("/{company_id}/tech-types/{type_id}/fields/{field_id}", status_code=204)
async def delete_tech_field(
    company_id: int,
    type_id: int,
    field_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin_access),
):
    await _get_tech_type(type_id, company_id, db)
    stmt = select(ObjTechField).where(ObjTechField.id == field_id, ObjTechField.tech_type_id == type_id)
    field = (await db.execute(stmt)).scalar_one_or_none()
    if not field:
        raise HTTPException(404, "Pole nenalezeno.")
    await db.delete(field)
    await db.commit()


# ─── Accessory Types (admin) ──────────────────────────────────────────────────

@router.post("/{company_id}/tech-types/{type_id}/accessory-types", response_model=ObjAccessoryTypeOut, status_code=201)
async def create_accessory_type(
    company_id: int,
    type_id: int,
    payload: ObjAccessoryTypeIn,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin_access),
):
    await _get_tech_type(type_id, company_id, db)
    acc = ObjAccessoryType(**payload.model_dump(), tech_type_id=type_id)
    db.add(acc)
    await db.commit()
    await db.refresh(acc)
    return acc


@router.patch("/{company_id}/tech-types/{type_id}/accessory-types/{acc_id}", response_model=ObjAccessoryTypeOut)
async def update_accessory_type(
    company_id: int,
    type_id: int,
    acc_id: int,
    payload: ObjAccessoryTypeUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin_access),
):
    await _get_tech_type(type_id, company_id, db)
    stmt = select(ObjAccessoryType).where(ObjAccessoryType.id == acc_id, ObjAccessoryType.tech_type_id == type_id)
    acc = (await db.execute(stmt)).scalar_one_or_none()
    if not acc:
        raise HTTPException(404, "Typ příslušenství nenalezen.")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(acc, k, v)
    await db.commit()
    await db.refresh(acc)
    return acc


@router.delete("/{company_id}/tech-types/{type_id}/accessory-types/{acc_id}", status_code=204)
async def delete_accessory_type(
    company_id: int,
    type_id: int,
    acc_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin_access),
):
    await _get_tech_type(type_id, company_id, db)
    stmt = select(ObjAccessoryType).where(ObjAccessoryType.id == acc_id, ObjAccessoryType.tech_type_id == type_id)
    acc = (await db.execute(stmt)).scalar_one_or_none()
    if not acc:
        raise HTTPException(404, "Typ příslušenství nenalezen.")
    await db.delete(acc)
    await db.commit()


# ─── Sites ────────────────────────────────────────────────────────────────────

@router.get("/{company_id}/sites", response_model=list[ObjSiteOut])
async def list_sites(
    company_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access),
):
    stmt = select(ObjSite).where(ObjSite.company_id == company_id)
    sites = (await db.execute(stmt)).scalars().all()
    return [await _build_site_out(s, db) for s in sites]


@router.get("/{company_id}/sites/{site_id}", response_model=ObjSiteOut)
async def get_site(
    company_id: int,
    site_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access),
):
    site = await _get_site(site_id, company_id, db)
    return await _build_site_out(site, db)


@router.post("/{company_id}/sites", response_model=ObjSiteOut, status_code=201)
async def create_site(
    company_id: int,
    payload: ObjSiteIn,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access),
):
    site = ObjSite(**payload.model_dump(), company_id=company_id)
    db.add(site)
    await db.commit()
    await db.refresh(site)
    return await _build_site_out(site, db)


@router.patch("/{company_id}/sites/{site_id}", response_model=ObjSiteOut)
async def update_site(
    company_id: int,
    site_id: int,
    payload: ObjSiteUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access),
):
    site = await _get_site(site_id, company_id, db)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(site, k, v)
    await db.commit()
    await db.refresh(site)
    return await _build_site_out(site, db)


@router.delete("/{company_id}/sites/{site_id}", status_code=204)
async def delete_site(
    company_id: int,
    site_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access),
):
    site = await _get_site(site_id, company_id, db)
    await db.delete(site)
    await db.commit()


# ─── Technologies on site ─────────────────────────────────────────────────────

@router.post("/{company_id}/sites/{site_id}/technologies", response_model=ObjTechInstanceOut, status_code=201)
async def add_technology(
    company_id: int,
    site_id: int,
    payload: ObjTechInstanceIn,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access),
):
    await _get_site(site_id, company_id, db)
    await _get_tech_type(payload.tech_type_id, company_id, db)

    # Prevent duplicate technology instances on same site
    stmt = select(ObjTechInstance).where(
        ObjTechInstance.site_id == site_id,
        ObjTechInstance.tech_type_id == payload.tech_type_id,
    )
    if (await db.execute(stmt)).scalar_one_or_none():
        raise HTTPException(409, "Tato technologie je na objektu již přidána.")

    instance = ObjTechInstance(site_id=site_id, tech_type_id=payload.tech_type_id)
    db.add(instance)
    await db.commit()
    await db.refresh(instance)
    return instance


@router.delete("/{company_id}/sites/{site_id}/technologies/{instance_id}", status_code=204)
async def remove_technology(
    company_id: int,
    site_id: int,
    instance_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access),
):
    await _get_site(site_id, company_id, db)
    stmt = select(ObjTechInstance).where(ObjTechInstance.id == instance_id, ObjTechInstance.site_id == site_id)
    instance = (await db.execute(stmt)).scalar_one_or_none()
    if not instance:
        raise HTTPException(404, "Instance technologie nenalezena.")
    await db.delete(instance)
    await db.commit()


# ─── Elements ─────────────────────────────────────────────────────────────────

async def _get_instance(instance_id: int, site_id: int, company_id: int, db: AsyncSession) -> ObjTechInstance:
    await _get_site(site_id, company_id, db)
    stmt = select(ObjTechInstance).where(ObjTechInstance.id == instance_id, ObjTechInstance.site_id == site_id)
    instance = (await db.execute(stmt)).scalar_one_or_none()
    if not instance:
        raise HTTPException(404, "Instance technologie nenalezena.")
    return instance


@router.post("/{company_id}/sites/{site_id}/technologies/{instance_id}/elements", response_model=ObjTechElementOut, status_code=201)
async def create_element(
    company_id: int,
    site_id: int,
    instance_id: int,
    payload: ObjTechElementIn,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access),
):
    await _get_instance(instance_id, site_id, company_id, db)
    if payload.is_main:
        others = (await db.execute(select(ObjTechElement).where(ObjTechElement.instance_id == instance_id, ObjTechElement.is_main == True))).scalars().all()
        for o in others:
            o.is_main = False
    element = ObjTechElement(**payload.model_dump(), instance_id=instance_id)
    db.add(element)
    await db.commit()
    await db.refresh(element)
    return element


@router.patch("/{company_id}/sites/{site_id}/technologies/{instance_id}/elements/{element_id}", response_model=ObjTechElementOut)
async def update_element(
    company_id: int,
    site_id: int,
    instance_id: int,
    element_id: int,
    payload: ObjTechElementIn,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access),
):
    await _get_instance(instance_id, site_id, company_id, db)
    stmt = select(ObjTechElement).where(ObjTechElement.id == element_id, ObjTechElement.instance_id == instance_id)
    element = (await db.execute(stmt)).scalar_one_or_none()
    if not element:
        raise HTTPException(404, "Prvek nenalezen.")
    if payload.is_main:
        others = (await db.execute(select(ObjTechElement).where(ObjTechElement.instance_id == instance_id, ObjTechElement.id != element_id, ObjTechElement.is_main == True))).scalars().all()
        for o in others:
            o.is_main = False
    for k, v in payload.model_dump().items():
        setattr(element, k, v)
    await db.commit()
    await db.refresh(element)
    return element


@router.delete("/{company_id}/sites/{site_id}/technologies/{instance_id}/elements/{element_id}", status_code=204)
async def delete_element(
    company_id: int,
    site_id: int,
    instance_id: int,
    element_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access),
):
    await _get_instance(instance_id, site_id, company_id, db)
    stmt = select(ObjTechElement).where(ObjTechElement.id == element_id, ObjTechElement.instance_id == instance_id)
    element = (await db.execute(stmt)).scalar_one_or_none()
    if not element:
        raise HTTPException(404, "Prvek nenalezen.")
    await db.delete(element)
    await db.commit()
