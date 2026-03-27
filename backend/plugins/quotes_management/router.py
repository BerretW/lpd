from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import io

from app.db.database import get_db
from app.core.dependencies import require_company_access
from app.db.models import Client, Company
from .models import Quote, QuoteSection, QuoteItem, QuoteCategoryAssembly
from .schemas import (
    QuoteIn, QuoteUpdate, QuoteOut, QuoteListOut,
    QuoteSectionIn, QuoteSectionUpdate, QuoteSectionOut,
    QuoteItemIn, QuoteItemUpdate, QuoteItemOut,
    QuoteCategoryAssemblyIn, QuoteCategoryAssemblyOut,
)

router = APIRouter(prefix="/plugins/quotes", tags=["plugin-quotes"])


# ─── Helpers ──────────────────────────────────────────────────────────────────

async def _get_customer_name(customer_id: int | None, db: AsyncSession) -> str | None:
    if not customer_id:
        return None
    stmt = select(Client.name).where(Client.id == customer_id)
    return (await db.execute(stmt)).scalar_one_or_none()


async def _build_quote_out(quote: Quote, db: AsyncSession) -> QuoteOut:
    out = QuoteOut.model_validate(quote)
    out.customer_name = await _get_customer_name(quote.customer_id, db)
    # Load sub-quotes manually (avoid self-referential selectin issues)
    sub_stmt = select(Quote).where(Quote.parent_quote_id == quote.id)
    sub_quotes = (await db.execute(sub_stmt)).scalars().all()
    out.sub_quotes = [QuoteListOut.model_validate(sq) for sq in sub_quotes]  # type: ignore[assignment]
    return out


async def _get_quote(quote_id: int, company_id: int, db: AsyncSession) -> Quote:
    stmt = select(Quote).where(Quote.id == quote_id, Quote.company_id == company_id)
    q = (await db.execute(stmt)).scalar_one_or_none()
    if not q:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Nabídka nenalezena.")
    return q


async def _get_section(section_id: int, quote_id: int, db: AsyncSession) -> QuoteSection:
    stmt = select(QuoteSection).where(QuoteSection.id == section_id, QuoteSection.quote_id == quote_id)
    s = (await db.execute(stmt)).scalar_one_or_none()
    if not s:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sekce nenalezena.")
    return s


# ─── Quotes ───────────────────────────────────────────────────────────────────

@router.get("/{company_id}/quotes", response_model=list[QuoteListOut])
async def list_quotes(
    company_id: int,
    site_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access),
):
    stmt = select(Quote).where(Quote.company_id == company_id, Quote.parent_quote_id == None)
    if site_id is not None:
        stmt = stmt.where(Quote.site_id == site_id)
    quotes = (await db.execute(stmt)).scalars().all()

    result = []
    for q in quotes:
        out = QuoteListOut.model_validate(q)
        out.customer_name = await _get_customer_name(q.customer_id, db)
        result.append(out)
    return result


@router.post("/{company_id}/quotes", response_model=QuoteOut, status_code=201)
async def create_quote(
    company_id: int,
    body: QuoteIn,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access),
):
    # Auto-verze: počet hlavních nabídek pro tento site/customer + 1
    if not body.parent_quote_id:
        version_stmt = select(func.count(Quote.id)).where(
            Quote.company_id == company_id,
            Quote.site_id == body.site_id,
            Quote.customer_id == body.customer_id,
            Quote.parent_quote_id.is_(None),
        )
        existing_count = (await db.execute(version_stmt)).scalar() or 0
        version = existing_count + 1
    else:
        version = 1
    q = Quote(company_id=company_id, version=version, **body.model_dump())
    db.add(q)
    await db.commit()
    await db.refresh(q)
    return await _build_quote_out(q, db)


@router.get("/{company_id}/quotes/{quote_id}", response_model=QuoteOut)
async def get_quote(
    company_id: int,
    quote_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access),
):
    q = await _get_quote(quote_id, company_id, db)
    return await _build_quote_out(q, db)


@router.patch("/{company_id}/quotes/{quote_id}", response_model=QuoteOut)
async def update_quote(
    company_id: int,
    quote_id: int,
    body: QuoteUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access),
):
    q = await _get_quote(quote_id, company_id, db)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(q, k, v)
    await db.commit()
    await db.refresh(q)
    return await _build_quote_out(q, db)


@router.delete("/{company_id}/quotes/{quote_id}", status_code=204)
async def delete_quote(
    company_id: int,
    quote_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access),
):
    q = await _get_quote(quote_id, company_id, db)
    await db.delete(q)
    await db.commit()


# ─── Sections ─────────────────────────────────────────────────────────────────

@router.post("/{company_id}/quotes/{quote_id}/sections", response_model=QuoteSectionOut, status_code=201)
async def create_section(
    company_id: int,
    quote_id: int,
    body: QuoteSectionIn,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access),
):
    await _get_quote(quote_id, company_id, db)
    sec = QuoteSection(quote_id=quote_id, **body.model_dump())
    db.add(sec)
    await db.commit()
    await db.refresh(sec)
    return QuoteSectionOut.model_validate(sec)


@router.patch("/{company_id}/quotes/{quote_id}/sections/{section_id}", response_model=QuoteSectionOut)
async def update_section(
    company_id: int,
    quote_id: int,
    section_id: int,
    body: QuoteSectionUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access),
):
    await _get_quote(quote_id, company_id, db)
    sec = await _get_section(section_id, quote_id, db)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(sec, k, v)
    await db.commit()
    await db.refresh(sec)
    return QuoteSectionOut.model_validate(sec)


@router.delete("/{company_id}/quotes/{quote_id}/sections/{section_id}", status_code=204)
async def delete_section(
    company_id: int,
    quote_id: int,
    section_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access),
):
    await _get_quote(quote_id, company_id, db)
    sec = await _get_section(section_id, quote_id, db)
    await db.delete(sec)
    await db.commit()


# ─── Items ────────────────────────────────────────────────────────────────────

@router.post("/{company_id}/quotes/{quote_id}/sections/{section_id}/items", response_model=QuoteItemOut, status_code=201)
async def create_item(
    company_id: int,
    quote_id: int,
    section_id: int,
    body: QuoteItemIn,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access),
):
    await _get_quote(quote_id, company_id, db)
    await _get_section(section_id, quote_id, db)
    item = QuoteItem(section_id=section_id, **body.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return QuoteItemOut.model_validate(item)


@router.patch("/{company_id}/quotes/{quote_id}/sections/{section_id}/items/{item_id}", response_model=QuoteItemOut)
async def update_item(
    company_id: int,
    quote_id: int,
    section_id: int,
    item_id: int,
    body: QuoteItemUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access),
):
    await _get_quote(quote_id, company_id, db)
    stmt = select(QuoteItem).where(QuoteItem.id == item_id, QuoteItem.section_id == section_id)
    item = (await db.execute(stmt)).scalar_one_or_none()
    if not item:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Položka nenalezena.")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(item, k, v)
    await db.commit()
    await db.refresh(item)
    return QuoteItemOut.model_validate(item)


@router.delete("/{company_id}/quotes/{quote_id}/sections/{section_id}/items/{item_id}", status_code=204)
async def delete_item(
    company_id: int,
    quote_id: int,
    section_id: int,
    item_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access),
):
    await _get_quote(quote_id, company_id, db)
    stmt = select(QuoteItem).where(QuoteItem.id == item_id, QuoteItem.section_id == section_id)
    item = (await db.execute(stmt)).scalar_one_or_none()
    if not item:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Položka nenalezena.")
    await db.delete(item)
    await db.commit()


# ─── Category Assemblies ──────────────────────────────────────────────────────

@router.put("/{company_id}/quotes/{quote_id}/category-assemblies", response_model=list[QuoteCategoryAssemblyOut])
async def upsert_category_assemblies(
    company_id: int,
    quote_id: int,
    body: list[QuoteCategoryAssemblyIn],
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access),
):
    """Replace all category assemblies for a quote."""
    await _get_quote(quote_id, company_id, db)
    stmt = select(QuoteCategoryAssembly).where(QuoteCategoryAssembly.quote_id == quote_id)
    existing = (await db.execute(stmt)).scalars().all()
    for e in existing:
        await db.delete(e)

    result = []
    for item in body:
        ca = QuoteCategoryAssembly(quote_id=quote_id, **item.model_dump())
        db.add(ca)
        result.append(ca)

    await db.commit()
    for ca in result:
        await db.refresh(ca)
    return [QuoteCategoryAssemblyOut.model_validate(ca) for ca in result]


# ─── PDF Export ───────────────────────────────────────────────────────────────

@router.get("/{company_id}/quotes/{quote_id}/pdf")
async def export_quote_pdf(
    company_id: int,
    quote_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access),
):
    from .pdf_generator import generate_quote_pdf

    q = await _get_quote(quote_id, company_id, db)
    quote_out = await _build_quote_out(q, db)
    quote_data = quote_out.model_dump()

    # Get company info
    stmt = select(Company).where(Company.id == company_id)
    company = (await db.execute(stmt)).scalar_one_or_none()
    company_data = {}
    if company:
        company_data = {
            "name": company.name,
            "address": getattr(company, "address", "") or "",
            "ico": getattr(company, "ico", "") or "",
            "dic": getattr(company, "dic", "") or "",
        }

    pdf_bytes = generate_quote_pdf(quote_data, company_data)
    safe_name = "".join(c if c.isalnum() or c in " _-" else "_" for c in q.name)[:60]

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.pdf"'},
    )
