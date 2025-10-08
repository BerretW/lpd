# windows/location_dialog.py
from PyQt6.QtWidgets import (QDialog, QVBoxLayout, QHBoxLayout, QListWidget, QListWidgetItem, 
                             QPushButton, QMessageBox, QLineEdit, QFormLayout, QGroupBox,
                             QSplitter, QTextEdit, QWidget)
from PyQt6.QtCore import Qt

class LocationDialog(QDialog):
    def __init__(self, api_client, parent=None):
        super().__init__(parent)
        self.api_client = api_client
        self.locations = []
        self.selected_location_id = None

        self.setWindowTitle("Správa skladových lokací")
        self.setMinimumSize(600, 400)

        # --- Layout ---
        main_layout = QHBoxLayout(self)
        splitter = QSplitter(Qt.Orientation.Horizontal)
        main_layout.addWidget(splitter)
        
        # Levý panel (seznam)
        left_panel = QWidget()
        left_layout = QVBoxLayout(left_panel)
        self.location_list = QListWidget()
        left_layout.addWidget(self.location_list)
        splitter.addWidget(left_panel)
        
        # Pravý panel (formulář)
        right_panel = QWidget()
        right_layout = QVBoxLayout(right_panel)
        
        form_group = QGroupBox("Detail lokace")
        form_layout = QFormLayout()
        self.name_input = QLineEdit()
        self.description_input = QTextEdit()
        self.description_input.setMaximumHeight(80)
        form_layout.addRow("Název*:", self.name_input)
        form_layout.addRow("Popis:", self.description_input)
        form_group.setLayout(form_layout)
        
        button_layout = QHBoxLayout()
        self.new_button = QPushButton("Nová")
        self.save_button = QPushButton("Uložit")
        self.delete_button = QPushButton("Smazat")
        button_layout.addWidget(self.new_button)
        button_layout.addStretch()
        button_layout.addWidget(self.save_button)
        button_layout.addWidget(self.delete_button)
        
        right_layout.addWidget(form_group)
        right_layout.addLayout(button_layout)
        right_layout.addStretch()
        right_panel.setLayout(right_layout)
        splitter.addWidget(right_panel)

        splitter.setSizes([200, 400])

        # --- Signály ---
        self.location_list.currentItemChanged.connect(self.display_location_details)
        self.new_button.clicked.connect(self.clear_form_for_new)
        self.save_button.clicked.connect(self.save_location)

        # Načtení dat
        self.load_locations()
        self.clear_form_for_new()

    def load_locations(self):
        self.locations = self.api_client.get_locations()
        self.location_list.clear()
        if self.locations:
            for loc in self.locations:
                item = QListWidgetItem(loc['name'])
                item.setData(Qt.ItemDataRole.UserRole, loc['id'])
                self.location_list.addItem(item)
        else:
            QMessageBox.warning(self, "Info", "Nebyly nalezeny žádné lokace.")

    def display_location_details(self, current, previous):
        if not current:
            return
        
        self.selected_location_id = current.data(Qt.ItemDataRole.UserRole)
        location_data = next((loc for loc in self.locations if loc['id'] == self.selected_location_id), None)
        
        if location_data:
            self.name_input.setText(location_data.get('name', ''))
            self.description_input.setText(location_data.get('description', ''))
            self.save_button.setText("Uložit změny")
            self.delete_button.setEnabled(True)

    def clear_form_for_new(self):
        self.selected_location_id = None
        self.location_list.setCurrentItem(None)
        self.name_input.clear()
        self.description_input.clear()
        self.name_input.setFocus()
        self.save_button.setText("Vytvořit novou")
        self.delete_button.setEnabled(False)

    def save_location(self):
        name = self.name_input.text().strip()
        if not name:
            QMessageBox.warning(self, "Chyba", "Název lokace je povinný.")
            return

        payload = {
            "name": name,
            "description": self.description_input.toPlainText().strip()
        }

        if self.selected_location_id:
            # TODO: Update
            QMessageBox.information(self, "Info", "Funkce úprav zatím není implementována.")

        else: # Vytvoření nové
            result = self.api_client.create_location(payload)
            if result:
                QMessageBox.information(self, "Úspěch", f"Lokace '{name}' byla vytvořena.")
                self.load_locations()
                self.clear_form_for_new()
            else:
                 QMessageBox.critical(self, "Chyba", "Nepodařilo se vytvořit lokaci.")