# backend/app/routers/pohoda.py
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db
from app.db.models import Company, Client, WorkOrder
from app.core.dependencies import require_admin_access
from app.routers.work_orders import get_billing_report, get_full_work_order_or_404
from app.routers.clients import get_client_or_404, get_client_billing_report

router = APIRouter(prefix="/companies/{company_id}/pohoda", tags=["pohoda"])

# --- Nastavení XML jmenných prostorů (Namespaces) pro Pohodu ---
# Zajišťuje, že XML tagy budou mít správné prefixy (např. <dat:dataPack>)
ET.register_namespace('dat', 'http://www.stormware.cz/schema/version_2/data.xsd')
ET.register_namespace('typ', 'http://www.stormware.cz/schema/version_2/type.xsd')
ET.register_namespace('adb', 'http://www.stormware.cz/schema/version_2/addressbook.xsd')
ET.register_namespace('inv', 'http://www.stormware.cz/schema/version_2/invoice.xsd')

def _create_pohoda_datapack(company_ico: str, note: str) -> ET.Element:
    """Vytvoří základní obálku (DataPack) vyžadovanou pro každý XML import do Pohody."""
    if not company_ico:
        raise ValueError("Společnost nemá vyplněné IČO. Pro export do Pohody je IČO účetní jednotky povinné.")
        
    data_pack = ET.Element('{http://www.stormware.cz/schema/version_2/data.xsd}dataPack', {
        'id': f'APPARTUS-{datetime.now().strftime("%Y%m%d%H%M%S")}',
        'ico': company_ico,
        'application': 'Appartus OS',
        'version': '2.0',
        'note': note
    })
    return data_pack


@router.get("/export/clients", summary="Export všech zákazníků do Pohody (Adresář)")
async def export_clients_to_pohoda(
    company_id: int, 
    db: AsyncSession = Depends(get_db), 
    _=Depends(require_admin_access)
):
    """
    Vygeneruje XML soubor se všemi zákazníky firmy, který lze nahrát do modulu Adresář v Pohodě.
    """
    # 1. Načtení firmy a klientů
    company = await db.get(Company, company_id)
    stmt = select(Client).where(Client.company_id == company_id)
    clients = (await db.execute(stmt)).scalars().all()

    if not clients:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Nebyli nalezeni žádní klienti k exportu.")

    try:
        # 2. Vytvoření XML obálky
        data_pack = _create_pohoda_datapack(company.ico, 'Export adresáře z Appartus')

        # 3. Přidání klientů do XML
        for index, client in enumerate(clients, start=1):
            item = ET.SubElement(data_pack, '{http://www.stormware.cz/schema/version_2/data.xsd}dataPackItem', {
                'id': f'CLI-{client.id}',
                'version': '2.0'
            })
            
            adb = ET.SubElement(item, '{http://www.stormware.cz/schema/version_2/addressbook.xsd}addressbook', {'version': '2.0'})
            header = ET.SubElement(adb, '{http://www.stormware.cz/schema/version_2/addressbook.xsd}addressbookHeader')
            
            # Identifikace klienta
            identity = ET.SubElement(header, '{http://www.stormware.cz/schema/version_2/addressbook.xsd}identity')
            address = ET.SubElement(identity, '{http://www.stormware.cz/schema/version_2/type.xsd}address')
            
            ET.SubElement(address, '{http://www.stormware.cz/schema/version_2/type.xsd}company').text = client.legal_name or client.name
            if client.contact_person:
                ET.SubElement(address, '{http://www.stormware.cz/schema/version_2/type.xsd}name').text = client.contact_person
            if client.address:
                # Jednoduché rozdělení adresy na ulici a zbytek pro ukázku - Pohoda si to umí přebrat
                ET.SubElement(address, '{http://www.stormware.cz/schema/version_2/type.xsd}street').text = client.address[:64] if client.address else ""
            if client.ico:
                ET.SubElement(address, '{http://www.stormware.cz/schema/version_2/type.xsd}ico').text = client.ico
            if client.dic:
                ET.SubElement(address, '{http://www.stormware.cz/schema/version_2/type.xsd}dic').text = client.dic

            # Kontakty
            if client.email:
                ET.SubElement(header, '{http://www.stormware.cz/schema/version_2/addressbook.xsd}email').text = client.email
            if client.phone:
                ET.SubElement(header, '{http://www.stormware.cz/schema/version_2/addressbook.xsd}phone').text = client.phone
            
            # Párovací ID (pokud ho máme v DB zavedeno)
            if hasattr(client, 'pohoda_ext_id') and client.pohoda_ext_id:
                extId = ET.SubElement(identity, '{http://www.stormware.cz/schema/version_2/type.xsd}extId')
                ET.SubElement(extId, '{http://www.stormware.cz/schema/version_2/type.xsd}ids').text = client.pohoda_ext_id
                ET.SubElement(extId, '{http://www.stormware.cz/schema/version_2/type.xsd}exSystemName').text = "Appartus"

        # 4. Sestavení výsledného XML a vrácení jako soubor
        xml_string = ET.tostring(data_pack, encoding='utf-8', xml_declaration=True).decode('utf-8')
        
        return Response(
            content=xml_string,
            media_type="application/xml",
            headers={"Content-Disposition": f"attachment; filename=pohoda_adresar_export.xml"}
        )

    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))


@router.get("/export/invoice/{work_order_id}", summary="Export zakázky jako vydané faktury do Pohody")
async def export_invoice_to_pohoda(
    company_id: int, 
    work_order_id: int, 
    db: AsyncSession = Depends(get_db), 
    _=Depends(require_admin_access)
):
    """
    Vygeneruje XML soubor s fakturou na základě odvedené práce a materiálu na zakázce.
    """
    # 1. Načtení dat (využíváme existující funkce!)
    company = await db.get(Company, company_id)
    work_order = await get_full_work_order_or_404(company_id, work_order_id, db)
    
    if not work_order.client:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Zakázka nemá přiřazeného zákazníka, nelze vytvořit fakturu.")

    # Zavoláme naši stávající funkci pro získání zúčtovacích dat
    report = await get_billing_report(company_id=company_id, work_order_id=work_order_id, db=db)

    if report.grand_total == 0:
         raise HTTPException(status.HTTP_400_BAD_REQUEST, "Zakázka má nulovou hodnotu, fakturu nelze vygenerovat.")

    try:
        # 2. Vytvoření XML obálky
        data_pack = _create_pohoda_datapack(company.ico, f'Faktura za zakázku: {work_order.name}')

        # 3. Záznam Faktury
        item = ET.SubElement(data_pack, '{http://www.stormware.cz/schema/version_2/data.xsd}dataPackItem', {
            'id': f'INV-WO-{work_order.id}',
            'version': '2.0'
        })
        
        inv = ET.SubElement(item, '{http://www.stormware.cz/schema/version_2/invoice.xsd}invoice', {'version': '2.0'})
        
        # 3a. Hlavička Faktury
        header = ET.SubElement(inv, '{http://www.stormware.cz/schema/version_2/invoice.xsd}invoiceHeader')
        ET.SubElement(header, '{http://www.stormware.cz/schema/version_2/invoice.xsd}invoiceType').text = 'issuedInvoice'
        
        today = datetime.now()
        ET.SubElement(header, '{http://www.stormware.cz/schema/version_2/invoice.xsd}date').text = today.strftime("%Y-%m-%d")
        ET.SubElement(header, '{http://www.stormware.cz/schema/version_2/invoice.xsd}dateDue').text = (today + timedelta(days=14)).strftime("%Y-%m-%d") # Splatnost 14 dní
        ET.SubElement(header, '{http://www.stormware.cz/schema/version_2/invoice.xsd}text').text = f"Fakturujeme Vám za: {work_order.name}"
        
        # Identifikace zákazníka
        partner = ET.SubElement(header, '{http://www.stormware.cz/schema/version_2/invoice.xsd}partnerIdentity')
        address = ET.SubElement(partner, '{http://www.stormware.cz/schema/version_2/type.xsd}address')
        ET.SubElement(address, '{http://www.stormware.cz/schema/version_2/type.xsd}company').text = work_order.client.legal_name or work_order.client.name
        if work_order.client.ico:
            ET.SubElement(address, '{http://www.stormware.cz/schema/version_2/type.xsd}ico').text = work_order.client.ico
        
        # Párování přes ID, pokud existuje
        if hasattr(work_order.client, 'pohoda_ext_id') and work_order.client.pohoda_ext_id:
            extId = ET.SubElement(partner, '{http://www.stormware.cz/schema/version_2/type.xsd}extId')
            ET.SubElement(extId, '{http://www.stormware.cz/schema/version_2/type.xsd}ids').text = work_order.client.pohoda_ext_id
            ET.SubElement(extId, '{http://www.stormware.cz/schema/version_2/type.xsd}exSystemName').text = "Appartus"

        # 3b. Položky Faktury
        detail = ET.SubElement(inv, '{http://www.stormware.cz/schema/version_2/invoice.xsd}invoiceDetail')
        
        # Práce
        for time_log in report.time_logs:
            if time_log.total_price > 0:
                inv_item = ET.SubElement(detail, '{http://www.stormware.cz/schema/version_2/invoice.xsd}invoiceItem')
                ET.SubElement(inv_item, '{http://www.stormware.cz/schema/version_2/invoice.xsd}text').text = f"{time_log.work_type_name} ({time_log.task_name})"
                ET.SubElement(inv_item, '{http://www.stormware.cz/schema/version_2/invoice.xsd}quantity').text = str(round(time_log.hours, 2))
                ET.SubElement(inv_item, '{http://www.stormware.cz/schema/version_2/invoice.xsd}unit').text = "hod"
                ET.SubElement(inv_item, '{http://www.stormware.cz/schema/version_2/invoice.xsd}payVAT').text = "false"
                ET.SubElement(inv_item, '{http://www.stormware.cz/schema/version_2/invoice.xsd}rateVAT').text = "high"
                
                hc = ET.SubElement(inv_item, '{http://www.stormware.cz/schema/version_2/invoice.xsd}homeCurrency')
                ET.SubElement(hc, '{http://www.stormware.cz/schema/version_2/type.xsd}unitPrice').text = str(round(time_log.rate, 2))

        # Materiál
        for used_item in report.used_items:
            if used_item.total_price > 0:
                inv_item = ET.SubElement(detail, '{http://www.stormware.cz/schema/version_2/invoice.xsd}invoiceItem')
                ET.SubElement(inv_item, '{http://www.stormware.cz/schema/version_2/invoice.xsd}text').text = used_item.item_name
                ET.SubElement(inv_item, '{http://www.stormware.cz/schema/version_2/invoice.xsd}quantity').text = str(used_item.quantity)
                ET.SubElement(inv_item, '{http://www.stormware.cz/schema/version_2/invoice.xsd}unit').text = "ks"
                ET.SubElement(inv_item, '{http://www.stormware.cz/schema/version_2/invoice.xsd}payVAT').text = "false"
                ET.SubElement(inv_item, '{http://www.stormware.cz/schema/version_2/invoice.xsd}rateVAT').text = "high"
                
                hc = ET.SubElement(inv_item, '{http://www.stormware.cz/schema/version_2/invoice.xsd}homeCurrency')
                ET.SubElement(hc, '{http://www.stormware.cz/schema/version_2/type.xsd}unitPrice').text = str(round(used_item.unit_price_sold, 2))

        # 4. Sestavení a vrácení XML
        xml_string = ET.tostring(data_pack, encoding='utf-8', xml_declaration=True).decode('utf-8')
        
        # Nastavíme status zakázky na "fakturováno" a uložíme
        work_order.status = "billed"
        await db.commit()
        
        return Response(
            content=xml_string,
            media_type="application/xml",
            headers={"Content-Disposition": f"attachment; filename=faktura_zakazka_{work_order.id}.xml"}
        )

    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))


@router.get("/export/periodic-invoice/{client_id}", summary="Export periodické faktury klienta do Pohody")
async def export_periodic_invoice_to_pohoda(
    company_id: int, 
    client_id: int, 
    start_date: date,
    end_date: date,
    db: AsyncSession = Depends(get_db), 
    _=Depends(require_admin_access)
):
    """
    Vygeneruje XML soubor s hromadnou fakturou za všechny zakázky klienta v daném období.
    """
    company = await db.get(Company, company_id)
    client = await get_client_or_404(company_id, client_id, db)
    
    # Použijeme stávající agregaci pro klienta
    report = await get_client_billing_report(company_id, client_id, start_date, end_date, db)

    if report.grand_total == 0:
         raise HTTPException(status.HTTP_400_BAD_REQUEST, "Klient v tomto období nemá žádnou zúčtovatelnou částku.")

    try:
        # Vytvoření XML obálky
        data_pack = _create_pohoda_datapack(company.ico, f'Periodická faktura: {client.name}')

        item = ET.SubElement(data_pack, '{http://www.stormware.cz/schema/version_2/data.xsd}dataPackItem', {
            'id': f'INV-PER-{client.id}-{start_date.strftime("%Y%m%d")}',
            'version': '2.0'
        })
        
        inv = ET.SubElement(item, '{http://www.stormware.cz/schema/version_2/invoice.xsd}invoice', {'version': '2.0'})
        
        # Hlavička Faktury
        header = ET.SubElement(inv, '{http://www.stormware.cz/schema/version_2/invoice.xsd}invoiceHeader')
        ET.SubElement(header, '{http://www.stormware.cz/schema/version_2/invoice.xsd}invoiceType').text = 'issuedInvoice'
        
        today = datetime.now()
        ET.SubElement(header, '{http://www.stormware.cz/schema/version_2/invoice.xsd}date').text = today.strftime("%Y-%m-%d")
        ET.SubElement(header, '{http://www.stormware.cz/schema/version_2/invoice.xsd}dateDue').text = (today + timedelta(days=14)).strftime("%Y-%m-%d")
        ET.SubElement(header, '{http://www.stormware.cz/schema/version_2/invoice.xsd}text').text = f"Fakturujeme Vám práci a materiál za období {start_date.strftime('%d.%m.%Y')} - {end_date.strftime('%d.%m.%Y')}."
        
        # Identifikace zákazníka
        partner = ET.SubElement(header, '{http://www.stormware.cz/schema/version_2/invoice.xsd}partnerIdentity')
        address = ET.SubElement(partner, '{http://www.stormware.cz/schema/version_2/type.xsd}address')
        ET.SubElement(address, '{http://www.stormware.cz/schema/version_2/type.xsd}company').text = client.legal_name or client.name
        if client.ico:
            ET.SubElement(address, '{http://www.stormware.cz/schema/version_2/type.xsd}ico').text = client.ico
        
        # Párování přes ID, pokud existuje
        if hasattr(client, 'pohoda_ext_id') and client.pohoda_ext_id:
            extId = ET.SubElement(partner, '{http://www.stormware.cz/schema/version_2/type.xsd}extId')
            ET.SubElement(extId, '{http://www.stormware.cz/schema/version_2/type.xsd}ids').text = client.pohoda_ext_id
            ET.SubElement(extId, '{http://www.stormware.cz/schema/version_2/type.xsd}exSystemName').text = "Appartus"

        # Položky Faktury
        detail = ET.SubElement(inv, '{http://www.stormware.cz/schema/version_2/invoice.xsd}invoiceDetail')
        
        # Práce
        for time_log in report.time_logs:
            if time_log.total_price > 0:
                inv_item = ET.SubElement(detail, '{http://www.stormware.cz/schema/version_2/invoice.xsd}invoiceItem')
                ET.SubElement(inv_item, '{http://www.stormware.cz/schema/version_2/invoice.xsd}text').text = f"{time_log.work_type_name} ({time_log.task_name} - {time_log.work_date})"
                ET.SubElement(inv_item, '{http://www.stormware.cz/schema/version_2/invoice.xsd}quantity').text = str(round(time_log.hours, 2))
                ET.SubElement(inv_item, '{http://www.stormware.cz/schema/version_2/invoice.xsd}unit').text = "hod"
                ET.SubElement(inv_item, '{http://www.stormware.cz/schema/version_2/invoice.xsd}payVAT').text = "false"
                ET.SubElement(inv_item, '{http://www.stormware.cz/schema/version_2/invoice.xsd}rateVAT').text = "high"
                
                hc = ET.SubElement(inv_item, '{http://www.stormware.cz/schema/version_2/invoice.xsd}homeCurrency')
                ET.SubElement(hc, '{http://www.stormware.cz/schema/version_2/type.xsd}unitPrice').text = str(round(time_log.rate, 2))

        # Materiál
        for used_item in report.used_items:
            if used_item.total_price > 0:
                inv_item = ET.SubElement(detail, '{http://www.stormware.cz/schema/version_2/invoice.xsd}invoiceItem')
                ET.SubElement(inv_item, '{http://www.stormware.cz/schema/version_2/invoice.xsd}text').text = f"{used_item.item_name} ({used_item.task_name})"
                ET.SubElement(inv_item, '{http://www.stormware.cz/schema/version_2/invoice.xsd}quantity').text = str(used_item.quantity)
                ET.SubElement(inv_item, '{http://www.stormware.cz/schema/version_2/invoice.xsd}unit').text = "ks"
                ET.SubElement(inv_item, '{http://www.stormware.cz/schema/version_2/invoice.xsd}payVAT').text = "false"
                ET.SubElement(inv_item, '{http://www.stormware.cz/schema/version_2/invoice.xsd}rateVAT').text = "high"
                
                hc = ET.SubElement(inv_item, '{http://www.stormware.cz/schema/version_2/invoice.xsd}homeCurrency')
                ET.SubElement(hc, '{http://www.stormware.cz/schema/version_2/type.xsd}unitPrice').text = str(round(used_item.unit_price_sold, 2))

        # Sestavení a vrácení XML
        xml_string = ET.tostring(data_pack, encoding='utf-8', xml_declaration=True).decode('utf-8')
        
        return Response(
            content=xml_string,
            media_type="application/xml",
            headers={"Content-Disposition": f"attachment; filename=pohoda_faktura_klient_{client.id}_{start_date}.xml"}
        )

    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))
    
from app.services.pohoda_connector import sync_clients_from_pohoda # Import nové služby

@router.post("/import/clients", summary="Synchronizace zákazníků z Pohody (mServer)")
async def import_clients_from_pohoda(
    company_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin_access)
):
    """
    Připojí se k Pohoda mServeru, stáhne aktuální adresář a aktualizuje/vytvoří klienty v aplikaci.
    Vyžaduje nastavený mServer URL v nastavení firmy.
    """
    try:
        count = await sync_clients_from_pohoda(db, company_id)
        return {"status": "success", "message": f"Synchronizace dokončena. Zpracováno {count} klientů."}
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Chyba synchronizace: {str(e)}")