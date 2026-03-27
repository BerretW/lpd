from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db
from app.core.dependencies import require_company_access
from app.db.models import Client, WorkOrder
from plugins.quotes_management.models import Quote, QuoteInvoice
from .schemas import InvoiceListOut, InvoiceStatusUpdate, WorkOrderInvoiceIn, INVOICE_STATUSES

router = APIRouter(prefix="/plugins/invoices", tags=["plugin-invoices"])


async def _enrich_invoice(inv: QuoteInvoice, db: AsyncSession) -> InvoiceListOut:
    out = InvoiceListOut.model_validate(inv)
    if inv.quote_id:
        q_stmt = select(Quote.name, Quote.customer_id).where(Quote.id == inv.quote_id)
        row = (await db.execute(q_stmt)).one_or_none()
        if row:
            out.quote_name = row[0]
            out.customer_id = row[1]
            if row[1]:
                c_stmt = select(Client.name).where(Client.id == row[1])
                out.customer_name = (await db.execute(c_stmt)).scalar_one_or_none()
    elif inv.work_order_id:
        wo_stmt = select(WorkOrder.name, WorkOrder.client_id).where(WorkOrder.id == inv.work_order_id)
        wo_row = (await db.execute(wo_stmt)).one_or_none()
        if wo_row:
            out.work_order_name = wo_row[0]
            if wo_row[1]:
                c_stmt = select(Client.name).where(Client.id == wo_row[1])
                out.customer_name = (await db.execute(c_stmt)).scalar_one_or_none()
    return out


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
    return [await _enrich_invoice(inv, db) for inv in invoices]


@router.post("/{company_id}/work-orders/{work_order_id}", response_model=InvoiceListOut, status_code=201)
async def create_work_order_invoice(
    company_id: int,
    work_order_id: int,
    body: WorkOrderInvoiceIn,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access),
):
    wo = (await db.execute(select(WorkOrder).where(WorkOrder.id == work_order_id, WorkOrder.company_id == company_id))).scalar_one_or_none()
    if not wo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Zakázka nenalezena.")
    inv = QuoteInvoice(company_id=company_id, work_order_id=work_order_id, quote_id=None, **body.model_dump())
    db.add(inv)
    await db.commit()
    await db.refresh(inv)
    return await _enrich_invoice(inv, db)


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
    return await _enrich_invoice(inv, db)
