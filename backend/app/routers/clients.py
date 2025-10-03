#routers/clients.py
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import get_db
from app.db.models import Client, WorkOrder
from app.schemas.client import ClientCreateIn, ClientOut, ClientUpdateIn
from app.routers.companies import require_company_access

from datetime import date
from sqlalchemy import func
from sqlalchemy.orm import selectinload
from app.db.models import WorkOrder, Task, TimeLog, UsedInventoryItem, TimeLogEntryType
from app.core.dependencies import require_admin_access # Předpokládáme, že reporty generuje admin
from app.schemas.client import ClientBillingReportOut
from app.schemas.work_order import BillingReportTimeLogOut, BillingReportUsedItemOut


router = APIRouter(prefix="/companies/{company_id}/clients", tags=["clients"])

# V reálné aplikaci by zde byla implementace ověření role admina/ownera
def require_admin_access(payload: dict = Depends(require_company_access)):
    return payload

async def get_client_or_404(company_id: int, client_id: int, db: AsyncSession) -> Client:
    """Pomocná funkce pro načtení klienta nebo vrácení 404."""
    stmt = select(Client).where(Client.id == client_id, Client.company_id == company_id)
    client = (await db.execute(stmt)).scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    return client

@router.post("", response_model=ClientOut, status_code=status.HTTP_201_CREATED)
async def create_client(company_id: int, payload: ClientCreateIn, db: AsyncSession = Depends(get_db), _=Depends(require_admin_access)):
    client = Client(**payload.dict(), company_id=company_id)
    db.add(client)
    await db.commit()
    await db.refresh(client)
    return client

@router.get("", response_model=List[ClientOut])
async def list_clients(company_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_company_access)):
    stmt = select(Client).where(Client.company_id == company_id)
    return (await db.execute(stmt)).scalars().all()

@router.get("/{client_id}", response_model=ClientOut)
async def get_client(company_id: int, client_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_company_access)):
    return await get_client_or_404(company_id, client_id, db)

@router.patch("/{client_id}", response_model=ClientOut)
async def update_client(company_id: int, client_id: int, payload: ClientUpdateIn, db: AsyncSession = Depends(get_db), _=Depends(require_admin_access)):
    client = await get_client_or_404(company_id, client_id, db)
    update_data = payload.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(client, key, value)
    await db.commit()
    await db.refresh(client)
    return client

@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Smazání klienta")
async def delete_client(company_id: int, client_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_admin_access)):
    """
    Smaže klienta. Všechny zakázky, které byly na tohoto klienta navázány,
    zůstanou v systému, ale budou od něj odpojeny (budou mít client_id = NULL).
    """
    client = await get_client_or_404(company_id, client_id, db)
    await db.delete(client)
    await db.commit()
    # Není třeba nic vracet, FastAPI se postará o status 204

@router.get(
    "/{client_id}/billing-report", 
    response_model=ClientBillingReportOut, 
    summary="Získání podkladů pro fakturaci pro klienta za období"
)
async def get_client_billing_report(
    company_id: int,
    client_id: int,
    start_date: date,
    end_date: date,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin_access)
):
    """
    Agreguje veškerou odvedenou práci a spotřebovaný materiál pro jednoho klienta
    napříč VŠEMI jeho zakázkami v daném časovém období.
    """
    client = await get_client_or_404(company_id, client_id, db)
    
    # --- 1. Sběr dat o odpracovaném čase ---
    time_log_query = (
        select(TimeLog)
        .join(TimeLog.task).join(Task.work_order)
        .where(
            WorkOrder.client_id == client_id,
            WorkOrder.company_id == company_id,
            TimeLog.entry_type == TimeLogEntryType.WORK,
            func.date(TimeLog.start_time) >= start_date,
            func.date(TimeLog.start_time) <= end_date
        )
        .options(selectinload(TimeLog.user), selectinload(TimeLog.work_type), selectinload(TimeLog.task))
    )
    time_logs_result = (await db.execute(time_log_query)).scalars().all()

    # --- 2. Sběr dat o použitém materiálu ---
    used_items_query = (
        select(UsedInventoryItem)
        .join(UsedInventoryItem.task).join(Task.work_order)
        .where(
            WorkOrder.client_id == client_id,
            WorkOrder.company_id == company_id,
            # Filtrujeme materiál podle data PŘIDÁNÍ ZÁZNAMU o spotřebě
            func.date(UsedInventoryItem.log_date) >= start_date,
            func.date(UsedInventoryItem.log_date) <= end_date,
        )
        .options(selectinload(UsedInventoryItem.inventory_item), selectinload(UsedInventoryItem.task))
    )
    used_items_result = (await db.execute(used_items_query)).scalars().all()
    
    # --- 3. Zpracování a agregace dat (stejné jako v reportu pro zakázku) ---
    report_time_logs, total_hours, total_price_work = [], 0.0, 0.0
    for log in time_logs_result:
        duration = (log.end_time - log.start_time).total_seconds() / 3600
        rate = log.work_type.rate if log.work_type else 0.0
        price = duration * rate
        report_time_logs.append(BillingReportTimeLogOut(work_date=log.start_time.date(), hours=round(duration, 2), rate=rate, total_price=round(price, 2), work_type_name=log.work_type.name if log.work_type else "N/A", user_email=log.user.email if log.user else "N/A", task_name=log.task.name if log.task else "N/A"))
        total_hours += duration
        total_price_work += price
        
    report_used_items, total_price_inventory = [], 0.0
    for item in used_items_result:
        price_per_unit = item.inventory_item.price if item.inventory_item and item.inventory_item.price is not None else 0.0
        price = item.quantity * price_per_unit
        report_used_items.append(BillingReportUsedItemOut(item_name=item.inventory_item.name if item.inventory_item else "N/A", sku=item.inventory_item.sku if item.inventory_item else "N/A", quantity=item.quantity, price=price_per_unit, total_price=round(price, 2), task_name=item.task.name if item.task else "N/A"))
        total_price_inventory += price
        
    return ClientBillingReportOut(
        client_name=client.name,
        total_hours=round(total_hours, 2),
        total_price_work=round(total_price_work, 2),
        total_price_inventory=round(total_price_inventory, 2),
        grand_total=round(total_price_work + total_price_inventory, 2),
        time_logs=report_time_logs,
        used_items=report_used_items
    )