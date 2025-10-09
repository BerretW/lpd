# windows/picking_order_fulfill_dialog.py
from PyQt6.QtWidgets import (QDialog, QVBoxLayout, QHBoxLayout, 
                             QPushButton, QMessageBox, QComboBox, QTableWidget,
                             QTableWidgetItem, QAbstractItemView, QHeaderView,
                             QSpinBox, QLabel, QWidget)
from PyQt6.QtCore import Qt, pyqtSignal
import qtawesome as qta
from functools import partial # NOVÝ IMPORT

from .item_dialog import ItemDialog

class PickingOrderFulfillDialog(QDialog):
    inventory_updated = pyqtSignal()

    def __init__(self, api_client, order_data, inventory_data, parent=None):
        super().__init__(parent)
        self.api_client = api_client
        self.order_data = order_data
        self.inventory_data = list(inventory_data) 

        self.setWindowTitle(f"Zpracovat požadavek č. {order_data['id']}")
        self.setMinimumSize(950, 500) # Zvětšeno pro nový sloupec

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
        # ZMĚNA: Přidán nový sloupec pro zdrojovou lokaci
        self.items_table.setColumnCount(5)
        self.items_table.setHorizontalHeaderLabels(["Požadavek", "Požadováno ks", "Vychystat ks", "Zdrojová lokace", "Přiřadit položku (pokud nová)"])
        self.items_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        self.items_table.horizontalHeader().setSectionResizeMode(4, QHeaderView.ResizeMode.Stretch)
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
            
            # --- Sloupec 0: Popis požadavku ---
            desc = inventory_item_data['name'] if inventory_item_data else item.get('requested_item_description', 'CHYBA')
            desc_cell = QTableWidgetItem(desc)
            desc_cell.setFlags(desc_cell.flags() & ~Qt.ItemFlag.ItemIsEditable)
            self.items_table.setItem(row, 0, desc_cell)

            # --- Sloupec 1: Požadované množství ---
            req_qty = str(item['requested_quantity'])
            req_qty_cell = QTableWidgetItem(req_qty)
            req_qty_cell.setFlags(req_qty_cell.flags() & ~Qt.ItemFlag.ItemIsEditable)
            self.items_table.setItem(row, 1, req_qty_cell)
            
            # --- Sloupec 2: Vychystat množství (SpinBox) ---
            picked_spinbox = QSpinBox()
            picked_spinbox.setRange(0, item['requested_quantity'])
            picked_spinbox.setValue(item['requested_quantity'])
            self.items_table.setCellWidget(row, 2, picked_spinbox)

            # --- Sloupec 3: Zdrojová lokace (ComboBox) ---
            source_loc_combo = QComboBox()
            self.items_table.setCellWidget(row, 3, source_loc_combo)
            if inventory_item_data:
                self._update_source_locations_for_row(row, inventory_item_data['id'])

            # --- Sloupec 4: Přiřazení položky (pokud je nová) ---
            if inventory_item_data is None:
                widget = QWidget()
                h_layout = QHBoxLayout(widget)
                h_layout.setContentsMargins(2, 2, 2, 2)
                
                item_combo = QComboBox()
                item_combo.addItem("--- Vyberte / Vytvořte kartu ---", -1)
                for inv_item in self.inventory_data:
                    item_combo.addItem(f"{inv_item['name']} (SKU: {inv_item['sku']})", inv_item['id'])
                
                # Propojíme změnu položky s aktualizací zdrojových lokací
                item_combo.currentIndexChanged.connect(partial(self._on_item_assigned, row))
                
                create_button = QPushButton(qta.icon('fa5s.plus'), "")
                create_button.setToolTip("Vytvořit novou skladovou kartu pro tento požadavek")
                create_button.clicked.connect(partial(self.create_new_inventory_item, row, desc))

                h_layout.addWidget(item_combo)
                h_layout.addWidget(create_button)
                self.items_table.setCellWidget(row, 4, widget)
            else:
                existing_item_name = inventory_item_data['name']
                cell = QTableWidgetItem(existing_item_name)
                cell.setFlags(cell.flags() & ~Qt.ItemFlag.ItemIsEditable)
                self.items_table.setItem(row, 4, cell)


    def _on_item_assigned(self, row, index):
        """NOVÁ METODA: Spustí se, když se změní výběr v ComboBoxu pro přiřazení položky."""
        combo_box = self.sender()
        if combo_box:
            item_id = combo_box.currentData()
            self._update_source_locations_for_row(row, item_id)


    def _update_source_locations_for_row(self, row, inventory_item_id):
        """NOVÁ METODA: Naplní ComboBox zdrojových lokací pro daný řádek."""
        source_loc_combo = self.items_table.cellWidget(row, 3)
        source_loc_combo.clear()
        
        if inventory_item_id == -1:
            source_loc_combo.setEnabled(False)
            return

        # Najdeme kompletní data o položce v našem lokálním seznamu
        item_data = next((i for i in self.inventory_data if i['id'] == inventory_item_id), None)
        
        if not item_data:
            source_loc_combo.setEnabled(False)
            return

        locations_with_stock = [loc for loc in item_data.get('locations', []) if loc['quantity'] > 0]
        
        if not locations_with_stock:
            source_loc_combo.addItem("Není skladem!", -1)
            source_loc_combo.setEnabled(False)
            # Zároveň znemožníme vychystat, pokud není odkud
            self.items_table.cellWidget(row, 2).setValue(0)
            self.items_table.cellWidget(row, 2).setEnabled(False)
            return
        
        source_loc_combo.setEnabled(True)
        self.items_table.cellWidget(row, 2).setEnabled(True)
        for loc_stock in locations_with_stock:
            location_info = loc_stock['location']
            available_qty = loc_stock['quantity']
            source_loc_combo.addItem(
                f"{location_info['name']} (dostupné: {available_qty})", 
                location_info['id']
            )

    def create_new_inventory_item(self, row, description):
        """Otevře dialog pro vytvoření nové položky a po úspěchu ji vybere."""
        categories_flat = []
        parent = self.parent()
        if parent and hasattr(parent, 'categories_flat'):
            categories_flat = parent.categories_flat

        dialog = ItemDialog(self.api_client, categories_flat, prefill_data={'name': description})
        if dialog.exec():
            new_item = dialog.created_item
            if new_item:
                self.inventory_data.append(new_item)
                
                container_widget = self.items_table.cellWidget(row, 4)
                if container_widget:
                    combo = container_widget.findChild(QComboBox)
                    if combo:
                        combo.addItem(f"{new_item['name']} (SKU: {new_item['sku']})", new_item['id'])
                        combo.setCurrentIndex(combo.count() - 1)
                
                self.inventory_updated.emit()
                # Nová položka nemá žádné zásoby, takže se ComboBox lokací správně zablokuje
                self._update_source_locations_for_row(row, new_item['id'])


    def submit_fulfillment(self):
        items_payload = []
        for row in range(self.items_table.rowCount()):
            order_item = self.order_data['items'][row]
            picked_quantity = self.items_table.cellWidget(row, 2).value()

            # --- Sestavení základního payloadu pro položku ---
            item_data = {
                "picking_order_item_id": order_item['id'],
                "picked_quantity": picked_quantity
            }

            # --- Přiřazení skladové karty, pokud byla vyžadována ---
            inventory_item_id = order_item.get('inventory_item', {}).get('id')
            if not inventory_item_id: # Pokud položka v požadavku neměla ID
                container_widget = self.items_table.cellWidget(row, 4)
                widget = container_widget.findChild(QComboBox)
                inventory_item_id = widget.currentData()
                if inventory_item_id != -1:
                    item_data["inventory_item_id"] = inventory_item_id
            
            # --- Pokud nevychystáváme nic, přeskočíme zbytek validace ---
            if picked_quantity == 0:
                items_payload.append(item_data)
                continue

            # --- Validace pro vychystávané položky ---
            # 1. Musí být přiřazena skladová karta
            if not inventory_item_id or inventory_item_id == -1:
                QMessageBox.warning(self, "Chyba", f"Na řádku {row+1} vychystáváte zboží, ale nemáte přiřazenou skladovou kartu.")
                return

            # 2. Musí být vybrána zdrojová lokace
            source_loc_combo = self.items_table.cellWidget(row, 3)
            source_location_id = source_loc_combo.currentData()
            if source_location_id == -1:
                QMessageBox.warning(self, "Chyba", f"Na řádku {row+1} musíte vybrat zdrojovou lokaci, odkud zboží berete.")
                return
            
            # Přidáme ID lokace do payloadu
            item_data["source_location_id"] = source_location_id
            items_payload.append(item_data)
            
        payload = {"items": items_payload}
        result = self.api_client.fulfill_picking_order(self.order_data['id'], payload)
        
        if result and "error" not in result:
            QMessageBox.information(self, "Úspěch", "Požadavek byl úspěšně zpracován.")
            self.accept()
        else:
            error_msg = result.get('error') if isinstance(result, dict) else "Neznámá chyba."
            QMessageBox.critical(self, "Chyba při zpracování", f"Požadavek se nepodařilo splnit:\n{error_msg}")