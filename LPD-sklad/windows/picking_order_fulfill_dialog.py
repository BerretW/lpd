# windows/picking_order_fulfill_dialog.py
from PyQt6.QtWidgets import (QDialog, QVBoxLayout, QHBoxLayout, 
                             QPushButton, QMessageBox, QComboBox, QTableWidget,
                             QTableWidgetItem, QAbstractItemView, QHeaderView,
                             QSpinBox, QLabel, QWidget)
from PyQt6.QtCore import Qt, pyqtSignal # Důležité: pyqtSignal musí být importován
import qtawesome as qta

from .item_dialog import ItemDialog

class PickingOrderFulfillDialog(QDialog):
    # --- OPRAVA: Definice signálu vrácena zpět ---
    inventory_updated = pyqtSignal()

    def __init__(self, api_client, order_data, inventory_data, parent=None):
        super().__init__(parent)
        self.api_client = api_client
        self.order_data = order_data
        
        # Vytvoříme kopii listu, abychom neupravovali data přímo v hlavním okně,
        # dokud nedojde k obnovení z API.
        self.inventory_data = list(inventory_data) 

        self.setWindowTitle(f"Zpracovat požadavek č. {order_data['id']}")
        self.setMinimumSize(800, 500)

        layout = QVBoxLayout(self)
        
        source_location = order_data.get('source_location')
        source_name = "Hlavní sklad" if source_location is None else source_location.get('name', 'N/A')
        
        info_text = (
            f"<b>Ze skladu:</b> {source_name}<br>"
            f"<b>Do skladu:</b> {order_data['destination_location']['name']}<br>"
            f"<b>Poznámka:</b> {order_data.get('notes', '<em>bez poznámky</em>')}"
        )
        layout.addWidget(QLabel(info_text))

        self.items_table = QTableWidget()
        self.items_table.setColumnCount(4)
        self.items_table.setHorizontalHeaderLabels(["Požadavek", "Požadováno ks", "Vychystat ks", "Přiřadit položku (pokud nová)"])
        self.items_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        self.items_table.verticalHeader().setVisible(False)
        layout.addWidget(self.items_table)
        
        self.submit_button = QPushButton("Potvrdit vychystání a provést přesun")
        layout.addWidget(self.submit_button)
        
        self.submit_button.clicked.connect(self.submit_fulfillment)

        self.populate_table()

    def populate_table(self):
        items = self.order_data.get('items', [])
        self.items_table.setRowCount(len(items))

        for row, item in enumerate(items):
            inventory_item_data = item.get('inventory_item')
            
            if inventory_item_data:
                desc = inventory_item_data.get('name', 'CHYBA')
            else:
                desc = item.get('requested_item_description', 'CHYBA')

            desc_cell = QTableWidgetItem(desc)
            desc_cell.setFlags(desc_cell.flags() & ~Qt.ItemFlag.ItemIsEditable)

            req_qty = str(item['requested_quantity'])
            req_qty_cell = QTableWidgetItem(req_qty)
            req_qty_cell.setFlags(req_qty_cell.flags() & ~Qt.ItemFlag.ItemIsEditable)
            
            self.items_table.setItem(row, 0, desc_cell)
            self.items_table.setItem(row, 1, req_qty_cell)
            
            picked_spinbox = QSpinBox()
            picked_spinbox.setRange(0, item['requested_quantity'])
            picked_spinbox.setValue(item['requested_quantity'])
            self.items_table.setCellWidget(row, 2, picked_spinbox)

            if inventory_item_data is None:
                widget = QWidget()
                h_layout = QHBoxLayout(widget)
                h_layout.setContentsMargins(2, 2, 2, 2)
                
                item_combo = QComboBox()
                item_combo.addItem("--- Vyberte / Vytvořte kartu ---", -1)
                for inv_item in self.inventory_data:
                    item_combo.addItem(f"{inv_item['name']} (SKU: {inv_item['sku']})", inv_item['id'])
                
                create_button = QPushButton(qta.icon('fa5s.plus'), "")
                create_button.setToolTip("Vytvořit novou skladovou kartu pro tento požadavek")
                create_button.clicked.connect(lambda _, r=row, d=desc: self.create_new_inventory_item(r, d))

                h_layout.addWidget(item_combo)
                h_layout.addWidget(create_button)
                self.items_table.setCellWidget(row, 3, widget)
            else:
                existing_item_name = inventory_item_data['name']
                cell = QTableWidgetItem(existing_item_name)
                cell.setFlags(cell.flags() & ~Qt.ItemFlag.ItemIsEditable)
                self.items_table.setItem(row, 3, cell)

    def create_new_inventory_item(self, row, description):
        """Otevře dialog pro vytvoření nové položky a po úspěchu ji vybere."""
        # Získáme kategorie z rodičovského okna (pokud existují)
        categories_flat = []
        parent = self.parent()
        if parent and hasattr(parent, 'categories_flat'):
            categories_flat = parent.categories_flat

        dialog = ItemDialog(self.api_client, categories_flat, prefill_data={'name': description})
        if dialog.exec():
            new_item = dialog.created_item
            if new_item:
                # Přidáme do lokálního seznamu pro tento dialog
                self.inventory_data.append(new_item)
                
                # Najdeme ComboBox na správném řádku
                container_widget = self.items_table.cellWidget(row, 3)
                if container_widget:
                    combo = container_widget.findChild(QComboBox)
                    if combo:
                        # Přidáme novou položku do seznamu a rovnou ji vybereme
                        combo.addItem(f"{new_item['name']} (SKU: {new_item['sku']})", new_item['id'])
                        combo.setCurrentIndex(combo.count() - 1)
                
                # --- OPRAVA: Vyšleme signál hlavnímu oknu ---
                self.inventory_updated.emit()

    def submit_fulfillment(self):
        items_payload = []
        for row in range(self.items_table.rowCount()):
            order_item = self.order_data['items'][row]
            order_item_id = order_item['id']
            picked_quantity = self.items_table.cellWidget(row, 2).value()
            
            item_data = { "picking_order_item_id": order_item_id, "picked_quantity": picked_quantity }

            # Zkontrolujeme, zda musíme přiřadit skladovou kartu
            if order_item['inventory_item'] is None:
                container_widget = self.items_table.cellWidget(row, 3)
                widget = container_widget.findChild(QComboBox)
                inv_item_id = widget.currentData()
                if inv_item_id == -1:
                    # Pokud nebylo nic vychystáno (0 ks), není nutné kartu přiřazovat
                    if picked_quantity > 0:
                        QMessageBox.warning(self, "Chyba", f"Na řádku {row+1} vychystáváte zboží, musíte přiřadit skladovou kartu.")
                        return
                else:
                    item_data["inventory_item_id"] = inv_item_id
            
            items_payload.append(item_data)
            
        payload = {"items": items_payload}
        result = self.api_client.fulfill_picking_order(self.order_data['id'], payload)
        
        if result and "error" not in result:
            QMessageBox.information(self, "Úspěch", "Požadavek byl úspěšně zpracován.")
            self.accept()
        else:
            error_msg = result.get('error') if isinstance(result, dict) else "Neznámá chyba."
            QMessageBox.critical(self, "Chyba při zpracování", f"Požadavek se nepodařilo splnit:\n{error_msg}")