# app/services/pohoda_service.py
from datetime import date
import xml.etree.ElementTree as ET

def generate_invoice_xml(invoice, client, company_settings):
    # Hlavička datového bloku
    data_pack = ET.Element('dat:dataPack', {
        'id': f'APPARTUS-{invoice.id}',
        'ico': company_settings.ico_of_accounting_entity,
        'application': 'Appartus',
        'version': '2.0',
        'note': 'Export faktury',
        'xmlns:dat': 'http://www.stormware.cz/schema/version_2/data.xsd',
        'xmlns:inv': 'http://www.stormware.cz/schema/version_2/invoice.xsd',
        'xmlns:typ': 'http://www.stormware.cz/schema/version_2/type.xsd',
    })

    # Položka datového bloku (Faktura)
    data_pack_item = ET.SubElement(data_pack, 'dat:dataPackItem', {'id': str(invoice.id), 'version': '2.0'})
    inv_invoice = ET.SubElement(data_pack_item, 'inv:invoice', {'version': '2.0'})
    
    # Hlavička faktury
    inv_header = ET.SubElement(inv_invoice, 'inv:invoiceHeader')
    ET.SubElement(inv_header, 'inv:invoiceType').text = 'issuedInvoice' # Vydaná faktura
    ET.SubElement(inv_header, 'inv:symVar').text = invoice.invoice_number
    ET.SubElement(inv_header, 'inv:date').text = invoice.issue_date.isoformat()
    ET.SubElement(inv_header, 'inv:dateDue').text = invoice.due_date.isoformat()
    
    # Partner (Zákazník)
    partner_ident = ET.SubElement(inv_header, 'inv:partnerIdentity')
    # Pokud máme namapováno, pošleme ID, jinak adresu
    address = ET.SubElement(partner_ident, 'typ:address')
    ET.SubElement(address, 'typ:company').text = client.legal_name or client.name
    if client.ico:
        ET.SubElement(address, 'typ:ico').text = client.ico
    
    # Položky faktury
    inv_detail = ET.SubElement(inv_invoice, 'inv:invoiceDetail')
    for item in invoice.items_json: # Předpokládáme, že jste si uložili snapshot reportu
        inv_item = ET.SubElement(inv_detail, 'inv:invoiceItem')
        ET.SubElement(inv_item, 'inv:text').text = item['item_name']
        ET.SubElement(inv_item, 'inv:quantity').text = str(item['quantity'])
        ET.SubElement(inv_item, 'inv:unitPrice').text = str(item['unit_price_sold'])

    return ET.tostring(data_pack, encoding='utf-8', xml_declaration=True).decode('utf-8')