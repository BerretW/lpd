from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db
from app.core.dependencies import require_company_access
from app.db.models import Client
from plugins.quotes_management.models import Quote, QuoteInvoice
from .schemas import InvoiceListOut, InvoiceStatusUpdate, INVOICE_STATUSES

router = APIRouter(prefix="/plugins/invoices", tags=["plugin-invoices"])


@router.get("/{company_id}", response_model=list[InvoiceListOut])
async def list_invoices(
    company_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access),
):
    stmt = (
        select(QuoteInvoice)
        .where(QuoteInvoice.company_id == company_id)
        .order_by(QuoteInvoice.issue_date.desc(), QuoteInvoice.created_at.desc())
    )
    invoices = (await db.execute(stmt)).scalars().all()

    # Load related quote and customer names
    result = []
    for inv in invoices:
        out = InvoiceListOut.model_validate(inv)
        # Get quote name
        q_stmt = select(Quote.name, Quote.customer_id).where(Quote.id == inv.quote_id)
        row = (await db.execute(q_stmt)).one_or_none()
        if row:
            out.quote_name = row[0]
            out.customer_id = row[1]
            if row[1]:
                c_stmt = select(Client.name).where(Client.id == row[1])
                out.customer_name = (await db.execute(c_stmt)).scalar_one_or_none()
        result.append(out)
    return result


@router.patch("/{company_id}/{invoice_id}/status", response_model=InvoiceListOut)
async def update_invoice_status(
    company_id: int,
    invoice_id: int,
    body: InvoiceStatusUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access),
):
    if body.status not in INVOICE_STATUSES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Neplatný stav. Povolené hodnoty: {INVOICE_STATUSES}")

    stmt = select(QuoteInvoice).where(
        QuoteInvoice.id == invoice_id,
        QuoteInvoice.company_id == company_id,
    )
    inv = (await db.execute(stmt)).scalar_one_or_none()
    if not inv:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Faktura nenalezena.")

    inv.status = body.status
    await db.commit()
    await db.refresh(inv)

    # Enrich with names
    out = InvoiceListOut.model_validate(inv)
    q_stmt = select(Quote.name, Quote.customer_id).where(Quote.id == inv.quote_id)
    row = (await db.execute(q_stmt)).one_or_none()
    if row:
        out.quote_name = row[0]
        out.customer_id = row[1]
        if row[1]:
            c_stmt = select(Client.name).where(Client.id == row[1])
            out.customer_name = (await db.execute(c_stmt)).scalar_one_or_none()
    return out
