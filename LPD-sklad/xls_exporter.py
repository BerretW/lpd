# xls_exporter.py
import pandas as pd
from datetime import datetime

# xls_exporter.py

def export_inventory_to_xls(inventory_data: list, file_path: str):
    if not inventory_data:
        raise ValueError("Seznam položek pro export je prázdný.")

    df = pd.DataFrame(inventory_data)

    # ZMĚNA: Převod seznamu kategorií na jeden řetězec
    def format_categories(cats):
        if isinstance(cats, list):
            return ", ".join([c['name'] for c in cats if isinstance(c, dict)])
        return ""

    df['category_names'] = df['categories'].apply(format_categories)

    df_export = df[[
        'id', 'name', 'sku', 'ean', 'total_quantity', 'price', 'category_names', 'description'
    ]]
    df_export.columns = [
        'ID Položky', 'Název', 'SKU', 'EAN', 'Celkem kusů', 'Cena', 'Kategorie', 'Popis'
    ]

    df_export.to_excel(file_path, index=False, sheet_name='Inventura')


def export_audit_logs_to_xls(audit_logs: list, file_path: str):
    """
    Vygeneruje XLS soubor s historií pohybů ve skladu.
    """
    if not audit_logs:
        raise ValueError("Seznam pohybů pro export je prázdný.")
        
    df = pd.DataFrame(audit_logs)

    # Rozbalíme vnořené slovníky do samostatných sloupců
    df['user_email'] = df['user'].apply(lambda u: u['email'] if isinstance(u, dict) else 'N/A')
    df['item_sku'] = df['inventory_item'].apply(lambda i: i['sku'] if isinstance(i, dict) else 'N/A')
    df['item_name'] = df['inventory_item'].apply(lambda i: i['name'] if isinstance(i, dict) else 'Smazaná položka')

    # Převedeme časové značky na lépe čitelný formát
    def format_timestamp(ts):
        try:
            return pd.to_datetime(ts).strftime('%d.%m.%Y %H:%M:%S')
        except (ValueError, TypeError):
            return ts
    
    df['timestamp'] = df['timestamp'].apply(format_timestamp)


    # Vybereme a přejmenujeme sloupce
    df_export = df[['timestamp', 'action', 'item_sku', 'item_name', 'user_email', 'details']]
    df_export.columns = [
        'Datum a čas', 'Akce', 'SKU Položky', 'Název Položky', 'Uživatel', 'Detail Změny'
    ]

    # Zápis do XLS souboru
    df_export.to_excel(file_path, index=False, sheet_name='Pohyby ve skladu')