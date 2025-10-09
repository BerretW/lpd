# windows/item_dialog.py
from PyQt6.QtWidgets import (QDialog, QVBoxLayout, QFormLayout, QLineEdit, 
                             QPushButton, QMessageBox, QDoubleSpinBox, QComboBox, QTextEdit)

class ItemDialog(QDialog):
    def __init__(self, api_client, categories_flat, item_data=None, prefill_ean=None):
        super().__init__()
        self.api_client = api_client
        self.categories_flat = categories_flat
        self.item_data = item_data

        self.is_edit_mode = self.item_data is not None
        title = "Upravit položku" if self.is_edit_mode else "Vytvořit novou položku"
        self.setWindowTitle(title)
        
        # --- Widgets ---
        self.name_input = QLineEdit()
        self.sku_input = QLineEdit()
        self.ean_input = QLineEdit()
        self.price_input = QDoubleSpinBox()
        self.price_input.setRange(0.0, 999999.0)
        self.price_input.setDecimals(2)
        self.price_input.setSuffix(" Kč")
        
        self.category_combo = QComboBox()
        self.category_combo.addItem("Bez kategorie", None)
        for cat in self.categories_flat:
            self.category_combo.addItem(cat['name'], cat['id'])

        self.description_input = QTextEdit()
        self.description_input.setMaximumHeight(80)

        self.save_button = QPushButton("Uložit")
        
        # --- Layout ---
        layout = QVBoxLayout(self)
        form_layout = QFormLayout()
        form_layout.addRow("Název*:", self.name_input)
        form_layout.addRow("SKU*:", self.sku_input)
        form_layout.addRow("EAN:", self.ean_input)
        form_layout.addRow("Cena (bez DPH):", self.price_input)
        form_layout.addRow("Kategorie:", self.category_combo)
        form_layout.addRow("Popis:", self.description_input)
        
        layout.addLayout(form_layout)
        layout.addWidget(self.save_button)
        
        if self.is_edit_mode:
            self._populate_fields()
        elif prefill_ean:
            self.ean_input.setText(prefill_ean)

        self.save_button.clicked.connect(self.save_item)

    def _populate_fields(self):
        self.name_input.setText(self.item_data.get('name', ''))
        self.sku_input.setText(self.item_data.get('sku', ''))
        self.ean_input.setText(self.item_data.get('ean', ''))
        self.description_input.setText(self.item_data.get('description', ''))
        
        price = self.item_data.get('price')
        self.price_input.setValue(price if price is not None else 0.0)

        # Načtení ID kategorie může být vnořené
        category = self.item_data.get('category')
        category_id = category.get('id') if category else None
        
        if category_id:
            index = self.category_combo.findData(category_id)
            if index >= 0:
                self.category_combo.setCurrentIndex(index)

    def save_item(self):
        data = {
            "name": self.name_input.text().strip(),
            "sku": self.sku_input.text().strip(),
            "ean": self.ean_input.text().strip() or None,
            "description": self.description_input.toPlainText().strip() or None,
            "price": self.price_input.value(),
            "category_id": self.category_combo.currentData()
        }
        
        if not data["name"] or not data["sku"]:
            QMessageBox.warning(self, "Chybějící údaje", "Název a SKU jsou povinné.")
            return

        self.save_button.setEnabled(False)
        self.save_button.setText("Ukládám...")
        
        result = None
        if self.is_edit_mode:
            update_payload = {}
            for key, value in data.items():
                if str(self.item_data.get(key)) != str(value):
                    update_payload[key] = value
            
            # --- OPRAVA ZDE ---
            # Bezpečné zjištění ID aktuální kategorie
            category_info = self.item_data.get('category')
            current_cat_id = category_info.get('id') if category_info else None
            # --- KONEC OPRAVY ---

            if current_cat_id != data['category_id']:
                update_payload['category_id'] = data['category_id']

            if update_payload:
                 result = self.api_client.update_inventory_item(self.item_data['id'], update_payload)
            else:
                 result = True # Nic se neměnilo
        else:
            result = self.api_client.create_inventory_item(data)
            
        self.save_button.setEnabled(True)
        self.save_button.setText("Uložit")

        if result:
            self.accept()
        else:
            QMessageBox.critical(self, "Chyba", "Položku se nepodařilo uložit.")