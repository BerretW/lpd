# backend/app/services/trigger_service.py
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from app.db.models import (
    NotificationTrigger, TriggerType, WorkOrder, TimeLog,
    InventoryItem, ItemLocationStock, TimeLogEntryType
)
from app.services.email_service import send_transactional_email

logger = logging.getLogger(__name__)

async def check_work_order_budget_triggers(db: AsyncSession):
    """Najde všechny zakázky, které překročily rozpočtový práh a ještě nemají odeslaný alert."""
    stmt = select(NotificationTrigger).where(
        NotificationTrigger.is_active == True,
        NotificationTrigger.trigger_type == TriggerType.WORK_ORDER_BUDGET
    )
    triggers = (await db.execute(stmt)).scalars().all()

    for trigger in triggers:
        # Tento subquery sečte hodiny pro každou zakázku
        subquery = (
            select(
                TimeLog.task_id,
                func.sum((func.timestampdiff(text('SECOND'), TimeLog.start_time, TimeLog.end_time)) / 3600.0).label('total_hours')
            )
            .where(TimeLog.entry_type == TimeLogEntryType.WORK)
            .group_by(TimeLog.task_id)
            .subquery()
        )

        # Najdeme zakázky, které splňují podmínku
        work_orders_stmt = (
            select(WorkOrder, func.sum(subquery.c.total_hours).label('logged_hours'))
            .join(WorkOrder.tasks)
            .join(subquery, subquery.c.task_id == text('tasks.id')) # Explicitní join
            .where(
                WorkOrder.company_id == trigger.company_id,
                WorkOrder.budget_hours > 0,
                WorkOrder.budget_alert_sent == False,
                WorkOrder.status.not_in(['completed', 'cancelled'])
            )
            .group_by(WorkOrder.id)
            .having(func.sum(subquery.c.total_hours) >= (WorkOrder.budget_hours * trigger.threshold_value / 100.0))
        )
        
        work_orders_to_alert = (await db.execute(work_orders_stmt)).all()

        for wo, logged_hours in work_orders_to_alert:
            subject = f"Upozornění: Rozpočet zakázky '{wo.name}' je téměř vyčerpán"
            body = (
                f"Dobrý den,\n\n"
                f"fond hodin pro zakázku '{wo.name}' (ID: {wo.id}) dosáhl {trigger.threshold_value}% svého rozpočtu.\n\n"
                f"Rozpočet: {wo.budget_hours:.2f} hodin\n"
                f"Aktuálně evidováno: {logged_hours:.2f} hodin\n\n"
                "S pozdravem,\nVáš Appartus systém"
            )
            for recipient in trigger.recipient_emails:
                await send_transactional_email(db, trigger.company_id, "on_budget_alert", recipient, subject, body)
            
            wo.budget_alert_sent = True
            await db.commit()

async def check_low_stock_triggers(db: AsyncSession):
    """Najde všechny monitorované položky pod prahem, které nemají odeslaný alert."""
    stmt = select(InventoryItem).where(
        InventoryItem.is_monitored_for_stock == True,
        InventoryItem.low_stock_alert_sent == False,
        InventoryItem.low_stock_threshold != None
    )
    items_to_check = (await db.execute(stmt)).scalars().all()

    for item in items_to_check:
        # Získáme trigger pro danou firmu
        trigger_stmt = select(NotificationTrigger).where(
            NotificationTrigger.company_id == item.company_id,
            NotificationTrigger.trigger_type == TriggerType.INVENTORY_LOW_STOCK,
            NotificationTrigger.is_active == True
        )
        trigger = (await db.execute(trigger_stmt)).scalar_one_or_none()
        if not trigger:
            continue

        # Sečteme celkové množství
        total_quantity_stmt = select(func.sum(ItemLocationStock.quantity)).where(ItemLocationStock.inventory_item_id == item.id)
        total_quantity = (await db.execute(total_quantity_stmt)).scalar_one() or 0

        if total_quantity <= item.low_stock_threshold:
            subject = f"Upozornění: Nízký stav zásob pro položku '{item.name}'"
            body = (
                f"Dobrý den,\n\n"
                f"stav zásob pro položku '{item.name}' (SKU: {item.sku}) klesl pod nastavený práh.\n\n"
                f"Nastavený práh: {item.low_stock_threshold} ks\n"
                f"Aktuální stav: {total_quantity} ks\n\n"
                "S pozdravem,\nVáš Appartus systém"
            )
            for recipient in trigger.recipient_emails:
                await send_transactional_email(db, item.company_id, "on_low_stock_alert", recipient, subject, body)
            
            item.low_stock_alert_sent = True
            await db.commit()


async def check_all_triggers(db: AsyncSession):
    """Hlavní funkce, která spouští všechny typy kontrol."""
    logger.info("Running scheduled trigger checks...")
    try:
        await check_work_order_budget_triggers(db)
        await check_low_stock_triggers(db)
    except Exception as e:
        logger.error(f"Error during trigger check: {e}", exc_info=True)