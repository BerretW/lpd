# windows/automaton_dialog.py
from PyQt6.QtWidgets import (QDialog, QVBoxLayout, QHBoxLayout, QLineEdit, 
                             QLabel, QListWidget, QListWidgetItem, QMessageBox, 
                             QComboBox, QGroupBox)
from PyQt6.QtCore import Qt, QDateTime  # <--- PŘIDÁNO QDateTime
from PyQt6.QtGui import QColor         # <--- PŘIDÁNO QColor
from .item_dialog import ItemDialog
class AutomatonDialog(QDialog):
    def __init__(self, api_client, inventory_data, locations, categories_flat, parent=None):
        super().__init__(parent)
        self.api_client = api_client
        self.inventory_data = inventory_data
        self.locations = locations
        self.categories_flat = categories_flat

        self.setWindowTitle("Naskladňovací automat (EAN čtečka)")
        self.setMinimumSize(600, 500)

        layout = QVBoxLayout(self)

        # 1. Výběr lokace, kde automat běží
        loc_group = QGroupBox("Nastavení terminálu")
        loc_layout = QHBoxLayout(loc_group)
        loc_layout.addWidget(QLabel("Naskladňovat na lokaci:"))
        self.location_combo = QComboBox()
        for loc in self.locations:
            self.location_combo.addItem(loc['name'], loc['id'])
        loc_layout.addWidget(self.location_combo, 1)
        layout.addWidget(loc_group)

        # 2. Vstup pro čtečku
        input_group = QGroupBox("Vstup čtečky")
        input_layout = QVBoxLayout(input_group)
        self.ean_input = QLineEdit()
        self.ean_input.setPlaceholderText("Zde naskenujte EAN kód...")
        self.ean_input.setStyleSheet("font-size: 18pt; padding: 10px;")
        input_layout.addWidget(self.ean_input)
        layout.addWidget(input_group)

        # 3. Log historie
        layout.addWidget(QLabel("Historie naskladnění v této relaci:"))
        self.log_list = QListWidget()
        layout.addWidget(self.log_list)

        self.ean_input.returnPressed.connect(self.process_scan)
        
        # Zajištění, že kurzor bude vždy v inputu
        self.setFocusPolicy(Qt.FocusPolicy.StrongFocus)
        self.ean_input.setFocus()

    def process_scan(self):
        ean = self.ean_input.text().strip()
        self.ean_input.clear()
        
        if not ean:
            return

        location_id = self.location_combo.currentData()
        if not location_id:
            QMessageBox.warning(self, "Chyba", "Není vybrána cílová lokace!")
            return

        # 1. Pokus o vyhledání položky podle EAN
        item = self.api_client.find_item_by_ean(ean)

        if item:
            # Položka nalezena -> Naskladnit +1
            self.perform_restock(item, location_id, 1)
        else:
            # Položka nenalezena -> Otevřít okno pro přidání
            reply = QMessageBox.question(
                self, "Neznámý EAN", 
                f"EAN '{ean}' nebyl nalezen. Chcete vytvořit novou skladovou kartu?",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
            )
            
            if reply == QMessageBox.StandardButton.Yes:
                dialog = ItemDialog(self.api_client, self.categories_flat, prefill_data={'ean': ean})
                if dialog.exec():
                    # Po uložení dialogu získáme nově vytvořenou položku
                    new_item = dialog.created_item
                    if new_item:
                        # Automaticky naskladnit nově vytvořenou položku
                        self.perform_restock(new_item, location_id, 1)
        
        self.ean_input.setFocus()

    def perform_restock(self, item, location_id, quantity):
        """Provede API volání pro naskladnění a zapíše do logu."""
        payload = {
            "inventory_item_id": item['id'],
            "location_id": location_id,
            "quantity": quantity,
            "details": "Automatické naskladnění (terminál EAN)"
        }
        
        result = self.api_client.place_stock(payload)
        
        if result:
            msg = f"Naskladněno: {item['name']} (SKU: {item['sku']}) -> +{quantity} ks"
            self.add_log_entry(msg, success=True)
        else:
            msg = f"CHYBA: Nepodařilo se naskladnit {item['name']}"
            self.add_log_entry(msg, success=False)
    def add_log_entry(self, text, success=True):
        # QDateTime a QColor se teď berou z importů nahoře
        timestamp = QDateTime.currentDateTime().toString("HH:mm:ss")
        item = QListWidgetItem(f"[{timestamp}] {text}")
        
        if not success:
            item.setForeground(QColor("red"))
        else:
            item.setForeground(QColor("#a3be8c")) # Nord zelená
            
        self.log_list.insertItem(0, item)