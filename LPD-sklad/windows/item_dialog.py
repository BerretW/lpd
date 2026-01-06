# windows/item_dialog.py
from PyQt6.QtWidgets import (QDialog, QVBoxLayout, QFormLayout, QLineEdit, 
                             QPushButton, QMessageBox, QDoubleSpinBox, QListWidget, 
                             QListWidgetItem, QTextEdit, QLabel)
from PyQt6.QtCore import Qt

class ItemDialog(QDialog):
    def __init__(self, api_client, categories_flat, item_data=None, prefill_data=None):
        super().__init__()
        self.api_client = api_client
        self.categories_flat = categories_flat
        self.item_data = item_data
        self.created_item = None

        self.is_edit_mode = self.item_data is not None
        self.setWindowTitle("Upravit položku" if self.is_edit_mode else "Vytvořit novou položku")
        self.setMinimumWidth(400)
        
        # --- Widgets ---
        self.name_input = QLineEdit()
        self.sku_input = QLineEdit()
        self.ean_input = QLineEdit()
        self.price_input = QDoubleSpinBox()
        self.price_input.setRange(0.0, 999999.0)
        self.price_input.setDecimals(2)
        self.price_input.setSuffix(" Kč")
        
        # ZMĚNA: Použijeme QListWidget pro vícenásobný výběr kategorií
        self.category_list = QListWidget()
        self.category_list.setMaximumHeight(150)
        for cat in self.categories_flat:
            item = QListWidgetItem(cat['name'])
            item.setData(Qt.ItemDataRole.UserRole, cat['id'])
            item.setFlags(item.flags() | Qt.ItemFlag.ItemIsUserCheckable)
            item.setCheckState(Qt.CheckState.Unchecked)
            self.category_list.addItem(item)

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
        form_layout.addRow(QLabel("Kategorie (vyberte libovolné):"))
        form_layout.addRow(self.category_list)
        form_layout.addRow("Popis:", self.description_input)
        
        layout.addLayout(form_layout)
        layout.addWidget(self.save_button)
        
        if self.is_edit_mode:
            self._populate_fields()
        elif prefill_data:
            self.name_input.setText(prefill_data.get('name', ''))
            self.ean_input.setText(prefill_data.get('ean', ''))

        self.save_button.clicked.connect(self.save_item)

    def _populate_fields(self):
        self.name_input.setText(self.item_data.get('name', ''))
        self.sku_input.setText(self.item_data.get('sku', ''))
        self.ean_input.setText(self.item_data.get('ean', ''))
        self.description_input.setText(self.item_data.get('description', ''))
        
        price = self.item_data.get('price')
        self.price_input.setValue(price if price is not None else 0.0)
        
        # ZMĚNA: Zaškrtnutí kategorií, které položka již má
        item_categories = self.item_data.get('categories', [])
        current_cat_ids = [c['id'] for c in item_categories]
        
        for i in range(self.category_list.count()):
            list_item = self.category_list.item(i)
            cat_id = list_item.data(Qt.ItemDataRole.UserRole)
            if cat_id in current_cat_ids:
                list_item.setCheckState(Qt.CheckState.Checked)

    def save_item(self):
        # ZMĚNA: Posbíráme všechna ID zaškrtnutých kategorií
        selected_cat_ids = []
        for i in range(self.category_list.count()):
            list_item = self.category_list.item(i)
            if list_item.checkState() == Qt.CheckState.Checked:
                selected_cat_ids.append(list_item.data(Qt.ItemDataRole.UserRole))

        data = {
            "name": self.name_input.text().strip(),
            "sku": self.sku_input.text().strip(),
            "ean": self.ean_input.text().strip() or None,
            "description": self.description_input.toPlainText().strip() or None,
            "price": self.price_input.value(),
            "category_ids": selected_cat_ids # Přejmenováno na category_ids pro API
        }
        
        if not data["name"] or not data["sku"]:
            QMessageBox.warning(self, "Chybějící údaje", "Název a SKU jsou povinné.")
            return

        self.save_button.setEnabled(False)
        self.save_button.setText("Ukládám...")
        
        result = None
        if self.is_edit_mode:
            # U editace pošleme všechna data, API si s tím poradí (nebo filtrujte změny)
            result = self.api_client.update_inventory_item(self.item_data['id'], data)
        else:
            result = self.api_client.create_inventory_item(data)
            if result:
                self.created_item = result
            
        self.save_button.setEnabled(True)
        self.save_button.setText("Uložit")

        if result:
            self.accept()
        else:
            QMessageBox.critical(self, "Chyba", "Položku se nepodařilo uložit.")