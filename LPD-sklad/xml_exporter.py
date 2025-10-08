# xml_exporter.py
import xml.etree.ElementTree as ET
from datetime import datetime

def _add_sub_element(parent, tag, text):
    """Pomocná funkce pro vytvoření elementu, pouze pokud má hodnotu."""
    if text is not None:
        element = ET.SubElement(parent, tag)
        element.text = str(text)

def export_inventory_to_xml(inventory_data: list, company_id: int, file_path: str):
    """
    Vygeneruje XML soubor s aktuálním stavem skladu (inventurou).
    """
    root = ET.Element("Inventura")
    root.set("verze", "1.0")

    # Metadata
    meta = ET.SubElement(root, "Metadata")
    _add_sub_element(meta, "DatumExportu", datetime.now().isoformat())
    _add_sub_element(meta, "IDSpolecnosti", str(company_id))
    _add_sub_element(meta, "PocetPolozek", str(len(inventory_data)))

    # Seznam položek
    items_element = ET.SubElement(root, "SeznamPolozek")
    for item in inventory_data:
        item_element = ET.SubElement(items_element, "Polozka")
        item_element.set("id", str(item.get('id')))

        _add_sub_element(item_element, "Nazev", item.get('name'))
        _add_sub_element(item_element, "SKU", item.get('sku'))
        _add_sub_element(item_element, "EAN", item.get('ean'))
        _add_sub_element(item_element, "Popis", item.get('description'))
        # --- ZMĚNA: Používáme 'total_quantity' místo 'quantity' ---
        _add_sub_element(item_element, "CelkoveMnozstviNaSklade", item.get('total_quantity'))
        _add_sub_element(item_element, "Cena", item.get('price'))
        
        category = item.get('category')
        if category:
            cat_element = ET.SubElement(item_element, "Kategorie")
            _add_sub_element(cat_element, "ID", category.get('id'))
            _add_sub_element(cat_element, "Nazev", category.get('name'))

        # --- NOVÉ: Přidání detailního rozpisu po lokacích ---
        locations = item.get('locations')
        if locations:
            locs_element = ET.SubElement(item_element, "Umisteni")
            for loc_stock in locations:
                loc_element = ET.SubElement(locs_element, "Lokace")
                location_info = loc_stock.get('location', {})
                _add_sub_element(loc_element, "ID", location_info.get('id'))
                _add_sub_element(loc_element, "Nazev", location_info.get('name'))
                _add_sub_element(loc_element, "Mnozstvi", loc_stock.get('quantity'))

    # Zápis do souboru s odsazením pro lepší čitelnost
    tree = ET.ElementTree(root)
    ET.indent(tree, space="\t", level=0)
    tree.write(file_path, encoding='utf-8', xml_declaration=True)


def export_audit_logs_to_xml(audit_logs: list, company_id: int, file_path: str):
    # ... (tento soubor zůstává beze změny)
    root = ET.Element("PohybySkladu")
    root.set("verze", "1.0")
    meta = ET.SubElement(root, "Metadata")
    _add_sub_element(meta, "DatumExportu", datetime.now().isoformat())
    _add_sub_element(meta, "IDSpolecnosti", str(company_id))
    _add_sub_element(meta, "PocetZaznamu", str(len(audit_logs)))
    logs_element = ET.SubElement(root, "SeznamPohybu")
    for log in audit_logs:
        log_element = ET.SubElement(logs_element, "Pohyb")
        log_element.set("id", str(log.get('id')))
        _add_sub_element(log_element, "CasovaZnacka", log.get('timestamp'))
        _add_sub_element(log_element, "Akce", log.get('action'))
        _add_sub_element(log_element, "Detail", log.get('details'))
        user = log.get('user')
        if user:
            user_element = ET.SubElement(log_element, "Uzivatel")
            _add_sub_element(user_element, "ID", user.get('id'))
            _add_sub_element(user_element, "Email", user.get('email'))
        item = log.get('inventory_item')
        if item:
            item_element = ET.SubElement(log_element, "Polozka")
            _add_sub_element(item_element, "ID", item.get('id'))
            _add_sub_element(item_element, "Nazev", item.get('name'))
            _add_sub_element(item_element, "SKU", item.get('sku'))
    tree = ET.ElementTree(root)
    ET.indent(tree, space="\t", level=0)
    tree.write(file_path, encoding='utf-8', xml_declaration=True)