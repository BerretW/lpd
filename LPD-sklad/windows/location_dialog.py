# windows/location_dialog.py
from PyQt6.QtWidgets import (QDialog, QVBoxLayout, QHBoxLayout, QListWidget, QListWidgetItem, 
                             QPushButton, QMessageBox, QLineEdit, QFormLayout, QGroupBox,
                             QSplitter, QTextEdit, QWidget, QDialogButtonBox, QComboBox, QLabel)
from PyQt6.QtCore import Qt

class LocationDialog(QDialog):
    def __init__(self, api_client, parent=None):
        super().__init__(parent)
        self.api_client = api_client
        self.locations = []
        self.company_members = []
        self.selected_location_id = None
        self.data_changed = False

        self.setWindowTitle("Správa skladových lokací a oprávnění")
        self.setMinimumSize(800, 500)

        # --- Hlavní Layout ---
        main_layout = QHBoxLayout(self)
        splitter = QSplitter(Qt.Orientation.Horizontal)
        main_layout.addWidget(splitter)
        
        # --- Levý panel (Seznam lokací) ---
        left_panel = QWidget()
        left_layout = QVBoxLayout(left_panel)
        self.location_list = QListWidget()
        self.new_button = QPushButton("Nová lokace")
        left_layout.addWidget(QLabel("Skladové lokace:"))
        left_layout.addWidget(self.location_list)
        left_layout.addWidget(self.new_button)
        splitter.addWidget(left_panel)
        
        # --- Pravý panel (Detail a Oprávnění) ---
        right_panel = QWidget()
        right_layout = QVBoxLayout(right_panel)
        
        # --- Skupina pro Detail ---
        form_group = QGroupBox("Detail lokace")
        form_layout = QFormLayout()
        self.name_input = QLineEdit()
        self.description_input = QTextEdit()
        self.description_input.setMaximumHeight(80)
        form_layout.addRow("Název*:", self.name_input)
        form_layout.addRow("Popis:", self.description_input)
        form_group.setLayout(form_layout)
        right_layout.addWidget(form_group)

        # --- Skupina pro Oprávnění ---
        permissions_group = QGroupBox("Oprávnění uživatelé")
        permissions_v_layout = QVBoxLayout(permissions_group)

        self.permissions_list = QListWidget()
        self.remove_permission_button = QPushButton("Odebrat oprávnění vybranému")
        permissions_v_layout.addWidget(QLabel("Uživatelé s přístupem:"))
        permissions_v_layout.addWidget(self.permissions_list)
        permissions_v_layout.addWidget(self.remove_permission_button)
        permissions_v_layout.addSpacing(10)

        add_permission_layout = QHBoxLayout()
        self.add_user_combo = QComboBox()
        self.add_permission_button = QPushButton("Přidat oprávnění")
        add_permission_layout.addWidget(QLabel("Přidat uživatele:"))
        add_permission_layout.addWidget(self.add_user_combo, 1)
        add_permission_layout.addWidget(self.add_permission_button)
        permissions_v_layout.addLayout(add_permission_layout)
        right_layout.addWidget(permissions_group)

        right_layout.addStretch()

        # --- Spodní tlačítka ---
        action_button_layout = QHBoxLayout()
        self.save_button = QPushButton("Uložit změny")
        self.delete_button = QPushButton("Smazat lokaci")
        action_button_layout.addStretch()
        action_button_layout.addWidget(self.save_button)
        action_button_layout.addWidget(self.delete_button)
        right_layout.addLayout(action_button_layout)

        self.close_button_box = QDialogButtonBox(QDialogButtonBox.StandardButton.Close)
        right_layout.addWidget(self.close_button_box)

        right_panel.setLayout(right_layout)
        splitter.addWidget(right_panel)
        splitter.setSizes([250, 550])

        # --- Propojení signálů ---
        self.location_list.currentItemChanged.connect(self.display_location_details)
        self.new_button.clicked.connect(self.clear_form_for_new)
        self.save_button.clicked.connect(self.save_location)
        self.delete_button.clicked.connect(self.delete_location)
        self.add_permission_button.clicked.connect(self.add_permission)
        self.remove_permission_button.clicked.connect(self.remove_permission)
        self.close_button_box.rejected.connect(self.reject)

        # --- Načtení dat a počáteční stav ---
        self.load_initial_data()
        self.clear_form_for_new()

    def load_initial_data(self):
        # Načteme všechny členy firmy pro dropdown
        self.company_members = self.api_client.get_company_members()
        if self.company_members is None:
            QMessageBox.critical(self, "Chyba", "Nepodařilo se načíst seznam členů firmy. Správa oprávnění nebude funkční.")
            self.company_members = []
        
        self.add_user_combo.clear()
        self.add_user_combo.addItem("--- Vyberte uživatele ---", -1)
        for member in self.company_members:
            user = member.get('user', {})
            self.add_user_combo.addItem(user.get('email'), user.get('id'))

        # Načteme lokace
        self.load_locations()

    def load_locations(self):
        current_id = self.selected_location_id
        self.locations = self.api_client.get_locations() or []
        self.location_list.blockSignals(True)
        self.location_list.clear()
        
        item_to_select = None
        if self.locations:
            for loc in self.locations:
                item = QListWidgetItem(loc['name'])
                item.setData(Qt.ItemDataRole.UserRole, loc['id'])
                self.location_list.addItem(item)
                if loc['id'] == current_id:
                    item_to_select = item
        
        self.location_list.blockSignals(False)
        
        if item_to_select:
            self.location_list.setCurrentItem(item_to_select)
        else:
            self.clear_form_for_new()

    def display_location_details(self, current, previous):
        if not current:
            self.clear_form_for_new()
            return
        
        self.selected_location_id = current.data(Qt.ItemDataRole.UserRole)
        location_data = next((loc for loc in self.locations if loc['id'] == self.selected_location_id), None)
        
        if location_data:
            self.name_input.setText(location_data.get('name', ''))
            self.description_input.setText(location_data.get('description', ''))
            
            # Naplníme seznam oprávnění
            self.permissions_list.clear()
            authorized_users = location_data.get('authorized_users', [])
            if authorized_users:
                for user in authorized_users:
                    item = QListWidgetItem(user['email'])
                    item.setData(Qt.ItemDataRole.UserRole, user['id']) # Uložíme si ID uživatele
                    self.permissions_list.addItem(item)
            
            self.set_editing_state(True)
        else:
            self.clear_form_for_new()

    def set_editing_state(self, is_editing):
        """Pomocná metoda pro (de)aktivaci widgetů."""
        self.save_button.setText("Uložit změny" if is_editing else "Vytvořit novou")
        self.delete_button.setEnabled(is_editing)
        self.permissions_list.setEnabled(is_editing)
        self.remove_permission_button.setEnabled(is_editing)
        self.add_permission_button.setEnabled(is_editing)
        self.add_user_combo.setEnabled(is_editing)

    def clear_form_for_new(self):
        self.selected_location_id = None
        self.location_list.setCurrentItem(None)
        self.name_input.clear()
        self.description_input.clear()
        self.permissions_list.clear()
        self.name_input.setFocus()
        self.set_editing_state(False)

    def save_location(self):
        name = self.name_input.text().strip()
        if not name:
            QMessageBox.warning(self, "Chyba", "Název lokace je povinný.")
            return

        payload = {
            "name": name,
            "description": self.description_input.toPlainText().strip()
        }
        
        result = None
        if self.selected_location_id:
            # Aktualizace existující
            result = self.api_client.update_location(self.selected_location_id, payload)
        else:
            # Vytvoření nové
            result = self.api_client.create_location(payload)

        if result:
            msg = f"Lokace '{name}' byla úspěšně " + ("upravena." if self.selected_location_id else "vytvořena.")
            QMessageBox.information(self, "Úspěch", msg)
            self.data_changed = True
            # Pokud je nová, uložíme si její ID, abychom ji mohli vybrat
            if not self.selected_location_id:
                self.selected_location_id = result.get('id')
            self.load_locations()
        else:
            QMessageBox.critical(self, "Chyba", "Operaci se nepodařilo provést.")

    def delete_location(self):
        if not self.selected_location_id:
            return
            
        loc_name = self.name_input.text()
        reply = QMessageBox.question(self, "Smazat lokaci?", 
                                     f"Opravdu chcete trvale smazat lokaci '{loc_name}'?\n"
                                     "Tato akce je nevratná!",
                                     QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.Cancel,
                                     QMessageBox.StandardButton.Cancel)

        if reply == QMessageBox.StandardButton.Yes:
            success = self.api_client.delete_location(self.selected_location_id)
            if success:
                QMessageBox.information(self, "Úspěch", f"Lokace '{loc_name}' byla smazána.")
                self.data_changed = True
                self.load_locations()
            else:
                QMessageBox.critical(self, "Chyba", "Lokaci se nepodařilo smazat.")

    def add_permission(self):
        if not self.selected_location_id:
            return
        
        user_email = self.add_user_combo.currentText()
        user_id = self.add_user_combo.currentData()

        if user_id == -1:
            QMessageBox.warning(self, "Chyba", "Vyberte prosím uživatele ze seznamu.")
            return
            
        result = self.api_client.add_location_permission(self.selected_location_id, user_email)
        if result is not None:
            self.data_changed = True
            self.load_locations() # Znovu načteme, abychom dostali aktualizovaný seznam uživatelů
        else:
            QMessageBox.critical(self, "Chyba", f"Nepodařilo se přidat oprávnění pro '{user_email}'.\nUživatel již možná oprávnění má.")

    def remove_permission(self):
        if not self.selected_location_id:
            return
        
        selected_user_item = self.permissions_list.currentItem()
        if not selected_user_item:
            QMessageBox.warning(self, "Chyba", "Vyberte uživatele ze seznamu oprávněných, kterého chcete odebrat.")
            return
            
        user_id = selected_user_item.data(Qt.ItemDataRole.UserRole)
        user_email = selected_user_item.text()

        reply = QMessageBox.question(self, "Odebrat oprávnění?", 
                                     f"Opravdu chcete odebrat uživateli '{user_email}' přístup k této lokaci?",
                                     QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.Cancel,
                                     QMessageBox.StandardButton.Cancel)
        
        if reply == QMessageBox.StandardButton.Yes:
            success = self.api_client.remove_location_permission(self.selected_location_id, user_id)
            if success:
                self.data_changed = True
                self.load_locations()
            else:
                QMessageBox.critical(self, "Chyba", "Nepodařilo se odebrat oprávnění.")

    def reject(self):
        """Zavře okno a signalizuje hlavnímu oknu, zda má obnovit data."""
        if self.data_changed:
            self.accept()
        else:
            super().reject()