# windows/audit_log_dialog.py
from PyQt6.QtWidgets import (QDialog, QVBoxLayout, QHBoxLayout, QPushButton, QMessageBox, 
                             QTableWidget, QTableWidgetItem, QAbstractItemView, QGroupBox,
                             QComboBox, QLabel, QDateEdit, QDialogButtonBox, QFileDialog)
from PyQt6.QtCore import QDate, QDateTime, Qt
from xls_exporter import export_audit_logs_to_xls

# Slovník pro převod technických názvů akcí na čitelné
ACTION_MAP = {
    "Všechny akce": None,
    "Vytvoření položky": "created",
    "Úprava položky": "updated",
    "Naskladnění": "location_placed",
    "Přesun": "location_transferred",
    "Vyskladnění (použití)": "location_withdrawn",
    "Odpis": "write_off",
    "Smazání položky": "deleted",
}

class AuditLogDialog(QDialog):
    def __init__(self, api_client, inventory_data, company_members, parent=None):
        super().__init__(parent)
        self.api_client = api_client
        self.inventory_data = inventory_data
        self.company_members = company_members
        self.audit_logs = []

        self.setWindowTitle("Historie skladových pohybů (Audit Log)")
        self.setMinimumSize(1100, 700)

        # --- Layout ---
        self.layout = QVBoxLayout(self)

        # --- Filtry ---
        filter_group = QGroupBox("Filtry")
        filter_layout = QHBoxLayout(filter_group)
        
        # Filtr položky
        filter_layout.addWidget(QLabel("Položka:"))
        self.item_filter = QComboBox()
        filter_layout.addWidget(self.item_filter, 1) # Přidán stretch factor
        
        # Filtr uživatele
        filter_layout.addWidget(QLabel("Uživatel:"))
        self.user_filter = QComboBox()
        filter_layout.addWidget(self.user_filter, 1)

        # Filtr akce
        filter_layout.addWidget(QLabel("Typ akce:"))
        self.action_filter = QComboBox()
        filter_layout.addWidget(self.action_filter, 1)

        # Filtr data
        self.date_from = QDateEdit()
        self.date_from.setCalendarPopup(True)
        self.date_from.setDate(QDate.currentDate().addMonths(-1))
        self.date_to = QDateEdit()
        self.date_to.setCalendarPopup(True)
        self.date_to.setDate(QDate.currentDate())
        date_layout = QHBoxLayout()
        date_layout.addWidget(QLabel("Od:"))
        date_layout.addWidget(self.date_from)
        date_layout.addWidget(QLabel("Do:"))
        date_layout.addWidget(self.date_to)
        
        self.filter_button = QPushButton("Filtrovat")
        
        # Seskupení filtrů pro lepší zobrazení
        filter_layout.addLayout(date_layout)
        filter_layout.addSpacing(20)
        filter_layout.addWidget(self.filter_button)
        filter_layout.addStretch()
        
        self.layout.addWidget(filter_group)

        # --- Tabulka ---
        self.table = QTableWidget()
        self.table.setColumnCount(6)
        self.table.setHorizontalHeaderLabels(["Datum a čas", "Akce", "Uživatel", "SKU Položky", "Název Položky", "Detail změny"])
        self.table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.table.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self.table.setAlternatingRowColors(True)
        self.table.verticalHeader().setVisible(False)
        self.layout.addWidget(self.table)

        # --- Spodní tlačítka ---
        button_box = QDialogButtonBox()
        self.export_button = button_box.addButton("Exportovat do XLS", QDialogButtonBox.ActionRole)
        self.close_button = button_box.addButton(QDialogButtonBox.StandardButton.Close)
        self.layout.addWidget(button_box)

        # --- Propojení ---
        self.filter_button.clicked.connect(self.load_data)
        self.export_button.clicked.connect(self.export_to_xls)
        self.close_button.clicked.connect(self.accept)
        
        # --- Inicializace ---
        self.populate_filters()
        self.load_data()

    def populate_filters(self):
        # Položky
        self.item_filter.addItem("Všechny položky", -1)
        for item in sorted(self.inventory_data, key=lambda x: x['name']):
            self.item_filter.addItem(f"{item['name']} (SKU: {item['sku']})", item['id'])
            
        # Uživatelé
        self.user_filter.addItem("Všichni uživatelé", -1)
        for member in sorted(self.company_members, key=lambda x: x['user']['email']):
            user = member['user']
            self.user_filter.addItem(user['email'], user['id'])
            
        # Akce
        for display_name, technical_name in ACTION_MAP.items():
            self.action_filter.addItem(display_name, technical_name)

    def load_data(self):
        item_id = self.item_filter.currentData()
        user_id = self.user_filter.currentData()
        action = self.action_filter.currentData()
        start_date = self.date_from.date().toString("yyyy-MM-dd")
        end_date = self.date_to.date().toString("yyyy-MM-dd")
        
        self.filter_button.setEnabled(False)
        self.filter_button.setText("Načítám...")
        
        self.audit_logs = self.api_client.get_audit_logs(
            item_id=item_id,
            user_id=user_id,
            action=action,
            start_date=start_date,
            end_date=end_date,
            limit=5000
        )
        
        self.filter_button.setEnabled(True)
        self.filter_button.setText("Filtrovat")

        if self.audit_logs is None:
            QMessageBox.critical(self, "Chyba", "Nepodařilo se načíst historii pohybů.")
            self.audit_logs = []
        
        self._populate_table()

    def _populate_table(self):
        self.table.setRowCount(0)
        self.table.setRowCount(len(self.audit_logs))

        # Mapování technických názvů zpět na čitelné pro zobrazení
        reverse_action_map = {v: k for k, v in ACTION_MAP.items()}

        for row, log in enumerate(self.audit_logs):
            dt = QDateTime.fromString(log['timestamp'], Qt.DateFormat.ISODate)
            dt_str = dt.toLocalTime().toString("dd.MM.yyyy HH:mm:ss")
            
            action_key = log.get('action')
            action_display = reverse_action_map.get(action_key, action_key) # Zobrazí hezký název, nebo technický, když nenajde
            
            user_email = log.get('user', {}).get('email', 'N/A')
            item_sku = log.get('inventory_item', {}).get('sku', 'N/A')
            item_name = log.get('inventory_item', {}).get('name', 'Smazaná položka')

            self.table.setItem(row, 0, QTableWidgetItem(dt_str))
            self.table.setItem(row, 1, QTableWidgetItem(action_display))
            self.table.setItem(row, 2, QTableWidgetItem(user_email))
            self.table.setItem(row, 3, QTableWidgetItem(item_sku))
            self.table.setItem(row, 4, QTableWidgetItem(item_name))
            self.table.setItem(row, 5, QTableWidgetItem(log.get('details', '')))
        
        self.table.resizeColumnsToContents()
        self.table.horizontalHeader().setStretchLastSection(True)

    def export_to_xls(self):
        if not self.audit_logs:
            QMessageBox.warning(self, "Export", "Nejsou žádná data k exportu.")
            return

        path, _ = QFileDialog.getSaveFileName(self, "Uložit historii jako...", "historie_pohybu.xlsx", "Excel soubory (*.xlsx)")
        if not path:
            return
        
        try:
            # Před exportem můžeme vylepšit data o čitelné názvy akcí
            export_data = self.audit_logs.copy()
            reverse_action_map = {v: k for k, v in ACTION_MAP.items()}
            for log in export_data:
                action_key = log.get('action')
                log['action'] = reverse_action_map.get(action_key, action_key)

            export_audit_logs_to_xls(export_data, path)
            QMessageBox.information(self, "Úspěch", f"Historie byla úspěšně uložena do souboru:\n{path}")
        except Exception as e:
            QMessageBox.critical(self, "Chyba exportu", f"Při exportu nastala chyba: {e}")