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
from app.db.models import ClientCategoryMargin, InventoryCategory, InventoryItem
from app.schemas.client import ClientMarginOut, ClientMarginSetIn

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
    
    Aplikuje logiku marží:
    1. Specifická marže kategorie
    2. Globální marže klienta
    3. 0%
    """
    client = await get_client_or_404(company_id, client_id, db)
    
    # --- Načtení specifických marží klienta do slovníku pro rychlé vyhledání ---
    margin_stmt = select(ClientCategoryMargin).where(ClientCategoryMargin.client_id == client_id)
    margins_results = (await db.execute(margin_stmt)).scalars().all()
    # Mapa: {category_id: margin_percentage}
    category_margins_map = {m.category_id: m.margin_percentage for m in margins_results}

    # --- 1. Sběr dat o odpracovaném čase (beze změny) ---
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

    # --- 2. Sběr dat o použitém materiálu (UPRAVENO EAGER LOADING) ---
    used_items_query = (
        select(UsedInventoryItem)
        .join(UsedInventoryItem.task).join(Task.work_order)
        .where(
            WorkOrder.client_id == client_id,
            WorkOrder.company_id == company_id,
            func.date(UsedInventoryItem.log_date) >= start_date,
            func.date(UsedInventoryItem.log_date) <= end_date,
        )
        .options(
            selectinload(UsedInventoryItem.inventory_item)
            .selectinload(InventoryItem.categories), # DŮLEŽITÉ: Načíst kategorie položky
            selectinload(UsedInventoryItem.task)
        )
    )
    used_items_result = (await db.execute(used_items_query)).scalars().all()
    
    # --- 3. Zpracování a agregace dat ---
    report_time_logs, total_hours, total_price_work = [], 0.0, 0.0
    for log in time_logs_result:
        duration = (log.end_time - log.start_time).total_seconds() / 3600
        rate = log.work_type.rate if log.work_type else 0.0
        price = duration * rate
        report_time_logs.append(BillingReportTimeLogOut(work_date=log.start_time.date(), hours=round(duration, 2), rate=rate, total_price=round(price, 2), work_type_name=log.work_type.name if log.work_type else "N/A", user_email=log.user.email if log.user else "N/A", task_name=log.task.name if log.task else "N/A"))
        total_hours += duration
        total_price_work += price
        
    report_used_items, total_price_inventory = [], 0.0
    
    # Výchozí marže klienta (pokud je None, bereme 0)
    default_client_margin = client.margin_percentage if client.margin_percentage is not None else 0.0

    for item in used_items_result:
        base_price_per_unit = item.inventory_item.price if item.inventory_item and item.inventory_item.price is not None else 0.0
        
        # --- LOGIKA VÝPOČTU MARŽE ---
        applied_margin = default_client_margin
        
        # Zkontrolujeme, zda má položka kategorii se specifickou marží
        if item.inventory_item and item.inventory_item.categories:
            for cat in item.inventory_item.categories:
                if cat.id in category_margins_map:
                    applied_margin = category_margins_map[cat.id]
                    break # Použijeme první nalezenou shodu (případně lze implementovat logiku "nejvyšší marže")
        
        # Výpočet finální ceny: Základní cena * (1 + marže/100)
        final_price_per_unit = base_price_per_unit * (1 + applied_margin / 100.0)
        
        price_total = item.quantity * final_price_per_unit
        
        report_used_items.append(BillingReportUsedItemOut(
            item_name=item.inventory_item.name if item.inventory_item else "N/A",
            sku=item.inventory_item.sku if item.inventory_item else "N/A",
            quantity=item.quantity,
            price=round(final_price_per_unit, 2), # Vracíme cenu po aplikaci marže
            total_price=round(price_total, 2),
            task_name=item.task.name if item.task else "N/A"
        ))
        total_price_inventory += price_total
        
    return ClientBillingReportOut(
        client_name=client.name,
        total_hours=round(total_hours, 2),
        total_price_work=round(total_price_work, 2),
        total_price_inventory=round(total_price_inventory, 2),
        grand_total=round(total_price_work + total_price_inventory, 2),
        time_logs=report_time_logs,
        used_items=report_used_items
    )

@router.get("/{client_id}/margins", response_model=List[ClientMarginOut], summary="Seznam specifických marží klienta")
async def list_client_margins(
    company_id: int,
    client_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access)
):
    await get_client_or_404(company_id, client_id, db)
    
    stmt = (
        select(ClientCategoryMargin)
        .where(ClientCategoryMargin.client_id == client_id)
        .options(selectinload(ClientCategoryMargin.category))
    )
    results = (await db.execute(stmt)).scalars().all()
    
    return [
        ClientMarginOut(
            category_id=m.category_id,
            category_name=m.category.name,
            margin_percentage=m.margin_percentage
        )
        for m in results
    ]

@router.post("/{client_id}/margins", response_model=ClientMarginOut, summary="Nastavení/Aktualizace marže pro kategorii")
async def upsert_client_margin(
    company_id: int,
    client_id: int,
    payload: ClientMarginSetIn,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin_access)
):
    # Ověření, že klient patří firmě
    client = await get_client_or_404(company_id, client_id, db)
    
    # Ověření, že kategorie patří firmě (bezpečnost)
    cat_stmt = select(InventoryCategory).where(
        InventoryCategory.id == payload.category_id,
        InventoryCategory.company_id == company_id
    )
    category = (await db.execute(cat_stmt)).scalar_one_or_none()
    if not category:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found in this company.")

    # Upsert logika
    stmt = select(ClientCategoryMargin).where(
        ClientCategoryMargin.client_id == client_id,
        ClientCategoryMargin.category_id == payload.category_id
    )
    margin_entry = (await db.execute(stmt)).scalar_one_or_none()

    if margin_entry:
        margin_entry.margin_percentage = payload.margin_percentage
    else:
        margin_entry = ClientCategoryMargin(
            client_id=client_id,
            category_id=payload.category_id,
            margin_percentage=payload.margin_percentage
        )
        db.add(margin_entry)
    
    await db.commit()
    # Pro správné vrácení jména kategorie v response
    await db.refresh(margin_entry) 
    # Manuální načtení vztahu pro response, pokud není v session (pro jistotu)
    if not margin_entry.category:
        margin_entry.category = category

    return ClientMarginOut(
        category_id=margin_entry.category_id,
        category_name=margin_entry.category.name,
        margin_percentage=margin_entry.margin_percentage
    )

@router.delete("/{client_id}/margins/{category_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Smazání specifické marže")
async def delete_client_margin(
    company_id: int,
    client_id: int,
    category_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin_access)
):
    await get_client_or_404(company_id, client_id, db)
    
    stmt = select(ClientCategoryMargin).where(
        ClientCategoryMargin.client_id == client_id,
        ClientCategoryMargin.category_id == category_id
    )
    margin_entry = (await db.execute(stmt)).scalar_one_or_none()
    
    if margin_entry:
        await db.delete(margin_entry)
        await db.commit()
    else:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Margin rule not found.")