# windows/movement_dialog.py
from PyQt6.QtWidgets import (QDialog, QVBoxLayout, QFormLayout, QLineEdit, QSpinBox, 
                             QPushButton, QMessageBox, QComboBox, QTabWidget, QWidget)

class MovementDialog(QDialog):
    def __init__(self, api_client, items, locations, parent=None):
        super().__init__(parent)
        self.api_client = api_client
        self.items = items
        self.locations = locations
        
        self.setWindowTitle("Skladové pohyby")
        self.setMinimumWidth(450)
        
        main_layout = QVBoxLayout(self)
        self.tabs = QTabWidget()
        main_layout.addWidget(self.tabs)

        self._create_place_tab()
        self._create_transfer_tab()

    def _create_place_tab(self):
        """Vytvoří záložku pro naskladnění."""
        tab = QWidget()
        layout = QFormLayout(tab)

        self.place_item_combo = QComboBox()
        for item in self.items:
            self.place_item_combo.addItem(f"{item['name']} (SKU: {item['sku']})", item['id'])

        self.place_location_combo = QComboBox()
        for loc in self.locations:
            self.place_location_combo.addItem(loc['name'], loc['id'])
            
        self.place_quantity_spin = QSpinBox()
        self.place_quantity_spin.setRange(1, 99999)

        self.place_details_input = QLineEdit()
        self.place_details_input.setPlaceholderText("Nepovinné (např. číslo příjemky)")
        
        self.place_button = QPushButton("Naskladnit")

        layout.addRow("Položka:", self.place_item_combo)
        layout.addRow("Cílová lokace:", self.place_location_combo)
        layout.addRow("Počet kusů:", self.place_quantity_spin)
        layout.addRow("Poznámka:", self.place_details_input)
        layout.addRow(self.place_button)
        
        self.tabs.addTab(tab, "Naskladnění")
        self.place_button.clicked.connect(self.handle_place_stock)

    def _create_transfer_tab(self):
        """Vytvoří záložku pro přesun."""
        tab = QWidget()
        layout = QFormLayout(tab)

        self.transfer_item_combo = QComboBox()
        for item in self.items:
            self.transfer_item_combo.addItem(f"{item['name']} (SKU: {item['sku']})", item['id'])

        self.transfer_from_combo = QComboBox()
        self.transfer_to_combo = QComboBox()
        for loc in self.locations:
            self.transfer_from_combo.addItem(loc['name'], loc['id'])
            self.transfer_to_combo.addItem(loc['name'], loc['id'])

        self.transfer_quantity_spin = QSpinBox()
        self.transfer_quantity_spin.setRange(1, 99999)
        
        self.transfer_details_input = QLineEdit()
        self.transfer_details_input.setPlaceholderText("Nepovinné (např. jméno technika)")
        
        self.transfer_button = QPushButton("Přesunout")
        
        layout.addRow("Položka:", self.transfer_item_combo)
        layout.addRow("Z lokace:", self.transfer_from_combo)
        layout.addRow("Na lokaci:", self.transfer_to_combo)
        layout.addRow("Počet kusů:", self.transfer_quantity_spin)
        layout.addRow("Poznámka:", self.transfer_details_input)
        layout.addRow(self.transfer_button)

        self.tabs.addTab(tab, "Přesun")
        self.transfer_button.clicked.connect(self.handle_transfer_stock)

    def handle_place_stock(self):
        payload = {
            "inventory_item_id": self.place_item_combo.currentData(),
            "location_id": self.place_location_combo.currentData(),
            "quantity": self.place_quantity_spin.value(),
            "details": self.place_details_input.text().strip()
        }
        if not payload["inventory_item_id"] or not payload["location_id"]:
            QMessageBox.warning(self, "Chyba", "Musíte vybrat položku i lokaci.")
            return

        result = self.api_client.place_stock(payload)
        if result:
            QMessageBox.information(self, "Úspěch", "Položky byly úspěšně naskladněny.")
            self.accept()
        else:
            QMessageBox.critical(self, "Chyba", "Naskladnění se nezdařilo.")

    def handle_transfer_stock(self):
        from_loc = self.transfer_from_combo.currentData()
        to_loc = self.transfer_to_combo.currentData()
        
        if from_loc == to_loc:
            QMessageBox.warning(self, "Chyba", "Zdrojová a cílová lokace nemohou být stejné.")
            return

        payload = {
            "inventory_item_id": self.transfer_item_combo.currentData(),
            "from_location_id": from_loc,
            "to_location_id": to_loc,
            "quantity": self.transfer_quantity_spin.value(),
            "details": self.transfer_details_input.text().strip()
        }
        
        result = self.api_client.transfer_stock(payload)
        if result:
            QMessageBox.information(self, "Úspěch", "Položky byly úspěšně přesunuty.")
            self.accept()
        else:
            QMessageBox.critical(self, "Chyba", "Přesun se nezdařil.")