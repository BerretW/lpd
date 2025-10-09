# windows/picking_order_create_dialog.py
from PyQt6.QtWidgets import (QDialog, QVBoxLayout, QFormLayout, QLineEdit, 
                             QPushButton, QMessageBox, QComboBox, QTableWidget,
                             QTableWidgetItem, QAbstractItemView, QHeaderView,
                             QSpinBox, QHBoxLayout, QTextEdit)
from PyQt6.QtCore import Qt

class PickingOrderCreateDialog(QDialog):
    def __init__(self, api_client, inventory_data, locations, parent=None):
        super().__init__(parent)
        self.api_client = api_client
        self.inventory_data = inventory_data
        self.locations = locations

        self.setWindowTitle("Vytvořit požadavek na materiál")
        self.setMinimumSize(700, 500)

        layout = QVBoxLayout(self)
        form = QFormLayout()

        self.source_location_combo = QComboBox()
        self.dest_location_combo = QComboBox()
        for loc in self.locations:
            self.source_location_combo.addItem(loc['name'], loc['id'])
            self.dest_location_combo.addItem(loc['name'], loc['id'])

        self.notes_input = QTextEdit()
        self.notes_input.setMaximumHeight(60)

        form.addRow("Zdrojový sklad (odkud):", self.source_location_combo)
        form.addRow("Cílový sklad (kam):", self.dest_location_combo)
        form.addRow("Poznámka:", self.notes_input)
        layout.addLayout(form)

        # Tabulka položek
        self.items_table = QTableWidget()
        self.items_table.setColumnCount(3)
        self.items_table.setHorizontalHeaderLabels(["Typ požadavku", "Položka / Popis", "Požadované množství"])
        self.items_table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)
        layout.addWidget(self.items_table)

        # Tlačítka pro správu řádků
        row_buttons_layout = QHBoxLayout()
        self.add_existing_item_button = QPushButton("Přidat existující položku")
        self.add_new_item_button = QPushButton("Přidat novou (popisem)")
        self.remove_item_button = QPushButton("Odebrat vybraný řádek")
        row_buttons_layout.addWidget(self.add_existing_item_button)
        row_buttons_layout.addWidget(self.add_new_item_button)
        row_buttons_layout.addStretch()
        row_buttons_layout.addWidget(self.remove_item_button)
        layout.addLayout(row_buttons_layout)

        self.submit_button = QPushButton("Odeslat požadavek")
        layout.addWidget(self.submit_button)

        # Propojení
        self.add_existing_item_button.clicked.connect(lambda: self.add_row('existing'))
        self.add_new_item_button.clicked.connect(lambda: self.add_row('new'))
        self.remove_item_button.clicked.connect(self.remove_row)
        self.submit_button.clicked.connect(self.submit_order)
        
        self.add_row('existing') # Začneme s jedním řádkem

    def add_row(self, row_type):
        row_count = self.items_table.rowCount()
        self.items_table.insertRow(row_count)

        # Typ požadavku
        type_item = QTableWidgetItem("Existující položka" if row_type == 'existing' else "Nová položka (popis)")
        type_item.setData(Qt.ItemDataRole.UserRole, row_type) # Uložíme si typ
        type_item.setFlags(type_item.flags() & ~Qt.ItemFlag.ItemIsEditable)
        self.items_table.setItem(row_count, 0, type_item)
        
        # Položka / Popis
        if row_type == 'existing':
            combo = QComboBox()
            for item in self.inventory_data:
                combo.addItem(f"{item['name']} (SKU: {item['sku']})", item['id'])
            self.items_table.setCellWidget(row_count, 1, combo)
        else:
            self.items_table.setCellWidget(row_count, 1, QLineEdit())

        # Množství
        spinbox = QSpinBox()
        spinbox.setRange(1, 9999)
        self.items_table.setCellWidget(row_count, 2, spinbox)

    def remove_row(self):
        current_row = self.items_table.currentRow()
        if current_row >= 0:
            self.items_table.removeRow(current_row)

    def submit_order(self):
        if self.source_location_combo.currentData() == self.dest_location_combo.currentData():
            QMessageBox.warning(self, "Chyba", "Zdrojový a cílový sklad nemohou být stejné.")
            return

        items_payload = []
        for row in range(self.items_table.rowCount()):
            row_type = self.items_table.item(row, 0).data(Qt.ItemDataRole.UserRole)
            quantity = self.items_table.cellWidget(row, 2).value()
            item_data = {}

            if row_type == 'existing':
                widget = self.items_table.cellWidget(row, 1)
                item_data["inventory_item_id"] = widget.currentData()
            else: # new
                widget = self.items_table.cellWidget(row, 1)
                description = widget.text().strip()
                if not description:
                    QMessageBox.warning(self, "Chyba", f"Na řádku {row+1} chybí popis pro novou položku.")
                    return
                item_data["requested_item_description"] = description
            
            item_data["requested_quantity"] = quantity
            items_payload.append(item_data)
            
        if not items_payload:
            QMessageBox.warning(self, "Chyba", "Požadavek musí obsahovat alespoň jednu položku.")
            return

        payload = {
            "source_location_id": self.source_location_combo.currentData(),
            "destination_location_id": self.dest_location_combo.currentData(),
            "notes": self.notes_input.toPlainText().strip(),
            "items": items_payload
        }
        
        result = self.api_client.create_picking_order(payload)
        if result:
            QMessageBox.information(self, "Úspěch", f"Požadavek s ID {result['id']} byl úspěšně vytvořen.")
            self.accept()
        else:
            QMessageBox.critical(self, "Chyba", "Vytvoření požadavku selhalo.")