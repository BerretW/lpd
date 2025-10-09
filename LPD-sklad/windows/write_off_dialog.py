# windows/write_off_dialog.py
from PyQt6.QtWidgets import (QDialog, QVBoxLayout, QFormLayout, QLineEdit, QSpinBox, 
                             QPushButton, QMessageBox, QComboBox)

class WriteOffDialog(QDialog):
    def __init__(self, api_client, inventory_data, parent=None, selected_item_id=None):
        super().__init__(parent)
        self.api_client = api_client
        self.inventory_data = inventory_data
        
        self.setWindowTitle("Odepsat položku ze skladu")
        self.setMinimumWidth(450)
        
        # --- Widgets ---
        self.item_combo = QComboBox()
        self.location_combo = QComboBox()
        self.quantity_spin = QSpinBox()
        self.quantity_spin.setRange(1, 99999)
        self.details_input = QLineEdit()
        self.details_input.setPlaceholderText("Např. poškození, ztráta...")
        self.confirm_button = QPushButton("Potvrdit odpis")

        # --- Layout ---
        layout = QVBoxLayout(self)
        form = QFormLayout()
        form.addRow("Položka k odpisu:", self.item_combo)
        form.addRow("Odepsat z lokace:", self.location_combo)
        form.addRow("Počet kusů:", self.quantity_spin)
        form.addRow("Důvod odpisu*:", self.details_input)
        layout.addLayout(form)
        layout.addWidget(self.confirm_button)

        # --- Propojení signálů ---
        self.item_combo.currentIndexChanged.connect(self.update_locations)
        self.location_combo.currentIndexChanged.connect(self.update_quantity_limit)
        self.confirm_button.clicked.connect(self.handle_write_off)

        # --- Počáteční naplnění ---
        self.populate_items()
        if selected_item_id:
            index = self.item_combo.findData(selected_item_id)
            if index != -1:
                self.item_combo.setCurrentIndex(index)
        
        self.update_locations()

    def populate_items(self):
        self.item_combo.addItem("--- Vyberte položku ---", -1)
        for item in self.inventory_data:
            self.item_combo.addItem(f"{item['name']} (SKU: {item['sku']})", item['id'])

    def update_locations(self):
        self.location_combo.clear()
        self.location_combo.setEnabled(False)
        
        item_id = self.item_combo.currentData()
        if item_id == -1:
            self.update_quantity_limit()
            return
            
        item = next((i for i in self.inventory_data if i['id'] == item_id), None)
        if not item or 'locations' not in item:
            return

        locations_with_stock = [loc_stock for loc_stock in item['locations'] if loc_stock['quantity'] > 0]

        if locations_with_stock:
            for loc_stock in locations_with_stock:
                location_info = loc_stock['location']
                available_qty = loc_stock['quantity']
                self.location_combo.addItem(
                    f"{location_info['name']} (dostupné: {available_qty})", 
                    (location_info['id'], available_qty) # Uložíme si ID i dostupné množství
                )
            self.location_combo.setEnabled(True)
        
        self.update_quantity_limit()

    def update_quantity_limit(self):
        data = self.location_combo.currentData()
        if data:
            _, available_qty = data
            self.quantity_spin.setMaximum(available_qty)
            self.quantity_spin.setEnabled(True)
            self.confirm_button.setEnabled(True)
        else:
            self.quantity_spin.setMaximum(0)
            self.quantity_spin.setEnabled(False)
            self.confirm_button.setEnabled(False)

    def handle_write_off(self):
        details = self.details_input.text().strip()
        if not details:
            QMessageBox.warning(self, "Chyba", "Musíte vyplnit důvod odpisu.")
            return

        item_id = self.item_combo.currentData()
        location_data = self.location_combo.currentData()
        if not location_data:
            return
            
        location_id, available_qty = location_data
        quantity_to_write_off = self.quantity_spin.value()

        # Finální potvrzení od uživatele
        reply = QMessageBox.question(self, "Potvrzení odpisu",
            f"Opravdu chcete nevratně odepsat <b>{quantity_to_write_off} ks</b> položky "
            f"<b>{self.item_combo.currentText()}</b> z lokace <b>{self.location_combo.currentText().split(' (')[0]}</b>?\n\n"
            "Tato akce sníží stav skladu a bude zalogována.",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.Cancel,
            QMessageBox.StandardButton.Cancel)

        if reply == QMessageBox.StandardButton.Cancel:
            return

        payload = {
            "inventory_item_id": item_id,
            "location_id": location_id,
            "quantity": quantity_to_write_off,
            "details": details
        }
        
        self.confirm_button.setEnabled(False)
        self.confirm_button.setText("Odepisuji...")

        result = self.api_client.write_off_stock(payload)

        self.confirm_button.setEnabled(True)
        self.confirm_button.setText("Potvrdit odpis")

        if result:
            QMessageBox.information(self, "Úspěch", "Položky byly úspěšně odepsány.")
            self.accept()
        else:
            QMessageBox.critical(self, "Chyba", "Odpis se nezdařil. Zkontrolujte připojení a zkuste to znovu.")