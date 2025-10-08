# windows/main_window.py
import pandas as pd
from PyQt6.QtWidgets import (QMainWindow, QWidget, QVBoxLayout, QTableWidget, QTableWidgetItem,
                             QPushButton, QHBoxLayout, QLineEdit, QLabel, QAbstractItemView, 
                             QMessageBox, QFileDialog, QComboBox, QGroupBox, QSplitter)
from PyQt6.QtCore import Qt
import qtawesome as qta

from styling import MAIN_STYLESHEET
from .item_dialog import ItemDialog
from .category_dialog import CategoryDialog
# --- NOVÉ IMPORTY ---
from .location_dialog import LocationDialog
from .movement_dialog import MovementDialog
from xls_exporter import export_inventory_to_xls, export_audit_logs_to_xls

class MainWindow(QMainWindow):
    def __init__(self, api_client):
        super().__init__()
        self.api_client = api_client
        self.setWindowTitle("Skladník Plus")
        self.setWindowIcon(qta.icon('fa5s.warehouse'))
        self.setGeometry(100, 100, 1400, 800)
        
        self.setStyleSheet(MAIN_STYLESHEET)
        self.central_widget = QWidget()
        self.setCentralWidget(self.central_widget)
        self.layout = QVBoxLayout(self.central_widget)
        
        self.inventory_data = []
        self.categories_flat = []
        self.locations = [] # Nový stav pro lokace

        self._setup_ui()
        self.load_initial_data()
        self.statusBar().showMessage(f"Přihlášen jako: {api_client.user_email}")

    def _setup_ui(self):
        # --- HORNÍ PANEL S TLAČÍTKY ---
        top_layout = QHBoxLayout()
        top_layout.setContentsMargins(0, 0, 0, 10)
        
        # Skupina pro správu dat
        data_group = QGroupBox("Správa položek")
        data_layout = QHBoxLayout(data_group)
        self.add_button = QPushButton(qta.icon('fa5s.plus-circle'), " Nová položka")
        self.edit_button = QPushButton(qta.icon('fa5s.edit'), " Upravit položku")
        self.refresh_button = QPushButton(qta.icon('fa5s.sync-alt'), " Obnovit vše")
        data_layout.addWidget(self.add_button)
        data_layout.addWidget(self.edit_button)
        data_layout.addWidget(self.refresh_button)
        
        # Skupina pro skladové pohyby
        move_group = QGroupBox("Skladové operace")
        move_layout = QHBoxLayout(move_group)
        self.place_button = QPushButton(qta.icon('fa5s.dolly-flatbed'), " Naskladnit / Přesunout")
        self.locations_button = QPushButton(qta.icon('fa5s.map-marker-alt'), " Správa lokací")
        self.categories_button = QPushButton(qta.icon('fa5s.sitemap'), " Správa kategorií")
        move_layout.addWidget(self.place_button)
        move_layout.addWidget(self.locations_button)
        move_layout.addWidget(self.categories_button)

        # Skupina pro exporty
        io_group = QGroupBox("Import / Export")
        io_layout = QHBoxLayout(io_group)
        self.import_xls_button = QPushButton(qta.icon('fa5s.file-upload'), " Import z XLS")
        self.export_inventory_button = QPushButton(qta.icon('fa5s.file-excel'), " Export inventury")
        self.export_movements_button = QPushButton(qta.icon('fa5s.file-excel'), " Export pohybů")
        io_layout.addWidget(self.import_xls_button)
        io_layout.addWidget(self.export_inventory_button)
        io_layout.addWidget(self.export_movements_button)

        top_layout.addWidget(data_group)
        top_layout.addWidget(move_group)
        top_layout.addWidget(io_group)
        top_layout.addStretch()
        
        # --- PANEL S FILTRY ---
        filter_groupbox = QGroupBox("Filtry a vyhledávání")
        filter_layout = QHBoxLayout(filter_groupbox)
        filter_layout.addWidget(QLabel("Hledat:"))
        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("Napište název, SKU...")
        filter_layout.addWidget(self.search_input)
        filter_layout.addSpacing(20)
        filter_layout.addWidget(QLabel("Kategorie:"))
        self.category_filter_combo = QComboBox()
        filter_layout.addWidget(self.category_filter_combo)
        filter_layout.addSpacing(20)
        filter_layout.addWidget(QLabel("Skenovat EAN:"))
        self.ean_input = QLineEdit()
        self.ean_input.setPlaceholderText("Kurzor zde pro skenování...")
        filter_layout.addWidget(self.ean_input)

        # --- HLAVNÍ OBSAH (SPLITTER) ---
        main_splitter = QSplitter(Qt.Orientation.Vertical)

        # Horní část splitteru (tabulka položek)
        self.table = QTableWidget()
        self.table.setColumnCount(7)
        self.table.setHorizontalHeaderLabels(["ID", "Název", "SKU", "EAN", "Celkem kusů", "Cena", "Kategorie"])
        self.table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.table.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self.table.setAlternatingRowColors(True)
        self.table.verticalHeader().setVisible(False)
        main_splitter.addWidget(self.table)
        
        # Dolní část splitteru (detail lokací)
        detail_group = QGroupBox("Rozpis množství na lokacích pro vybranou položku")
        detail_layout = QVBoxLayout(detail_group)
        self.location_detail_table = QTableWidget()
        self.location_detail_table.setColumnCount(2)
        self.location_detail_table.setHorizontalHeaderLabels(["Název lokace", "Počet kusů"])
        self.location_detail_table.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self.location_detail_table.horizontalHeader().setStretchLastSection(True)
        detail_layout.addWidget(self.location_detail_table)
        main_splitter.addWidget(detail_group)
        
        main_splitter.setSizes([500, 300])

        self.layout.addLayout(top_layout)
        self.layout.addWidget(filter_groupbox)
        self.layout.addWidget(main_splitter)
        
        # --- PROPOJENÍ SIGNÁLŮ ---
        self.refresh_button.clicked.connect(self.load_initial_data)
        self.add_button.clicked.connect(self.add_new_item)
        self.edit_button.clicked.connect(self.edit_selected_item)
        self.table.doubleClicked.connect(self.edit_selected_item)
        self.table.itemSelectionChanged.connect(self.update_location_details_view)
        
        self.categories_button.clicked.connect(self.manage_categories)
        self.locations_button.clicked.connect(self.manage_locations)
        self.place_button.clicked.connect(self.manage_movements)
        
        self.search_input.textChanged.connect(self.filter_table_by_text)
        self.category_filter_combo.currentIndexChanged.connect(self.load_inventory_data)
        self.ean_input.returnPressed.connect(self.handle_ean_scan)
        
        self.import_xls_button.clicked.connect(self.import_from_xls)
        self.export_inventory_button.clicked.connect(self.export_inventory_xls)
        self.export_movements_button.clicked.connect(self.export_movements_xls)

    def load_initial_data(self):
        self.statusBar().showMessage("Načítám data z API...")
        self.load_categories()
        self.load_locations()
        self.load_inventory_data()

    def load_locations(self):
        self.locations = self.api_client.get_locations()
        if self.locations is None: self.locations = []

    def load_categories(self):
        categories_tree = self.api_client.get_categories()
        self.categories_flat = []
        if categories_tree is not None: self._flatten_categories(categories_tree, self.categories_flat)
        current_selection = self.category_filter_combo.currentData()
        self.category_filter_combo.blockSignals(True)
        self.category_filter_combo.clear()
        self.category_filter_combo.addItem("Všechny kategorie", -1)
        for cat in self.categories_flat: self.category_filter_combo.addItem(cat['name'], cat['id'])
        index = self.category_filter_combo.findData(current_selection)
        if index != -1: self.category_filter_combo.setCurrentIndex(index)
        self.category_filter_combo.blockSignals(False)

    def _flatten_categories(self, categories, flat_list, prefix=""):
        for cat in categories:
            flat_list.append({'id': cat['id'], 'name': prefix + cat['name']})
            if cat.get('children'): self._flatten_categories(cat['children'], flat_list, prefix + "- ")

    def load_inventory_data(self):
        self.statusBar().showMessage("Načítám skladové položky...")
        selected_category_id = self.category_filter_combo.currentData()
        self.inventory_data = self.api_client.get_inventory_items(category_id=selected_category_id)
        
        self.table.setRowCount(0)
        self.location_detail_table.setRowCount(0)
        if self.inventory_data is None:
            QMessageBox.critical(self, "Chyba", "Nepodařilo se načíst data ze skladu.")
            return

        self.table.setRowCount(len(self.inventory_data))
        for row, item in enumerate(self.inventory_data):
            category = item.get('category')
            category_name = category.get('name', '') if category else ''
            price = item.get('price')
            price_str = f"{price:.2f} Kč" if price is not None else "N/A"
            
            # --- ZMĚNA: Používáme 'total_quantity' ---
            quantity_item = QTableWidgetItem(str(item['total_quantity']))
            quantity_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            price_item = QTableWidgetItem(price_str)
            price_item.setTextAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
            
            self.table.setItem(row, 0, QTableWidgetItem(str(item['id'])))
            self.table.setItem(row, 1, QTableWidgetItem(item['name']))
            self.table.setItem(row, 2, QTableWidgetItem(item['sku']))
            self.table.setItem(row, 3, QTableWidgetItem(item.get('ean', '')))
            self.table.setItem(row, 4, quantity_item)
            self.table.setItem(row, 5, price_item)
            self.table.setItem(row, 6, QTableWidgetItem(category_name))
        
        self.table.resizeColumnsToContents()
        self.table.horizontalHeader().setStretchLastSection(True)
        self.filter_table_by_text()
        self.statusBar().showMessage(f"Načteno {len(self.inventory_data)} položek.", 5000)

    def update_location_details_view(self):
        self.location_detail_table.setRowCount(0)
        selected_rows = self.table.selectionModel().selectedRows()
        if not selected_rows: return

        item_id = int(self.table.item(selected_rows[0].row(), 0).text())
        item_data = next((item for item in self.inventory_data if item['id'] == item_id), None)
        
        if item_data and 'locations' in item_data:
            locations = item_data['locations']
            self.location_detail_table.setRowCount(len(locations))
            for row, loc_stock in enumerate(locations):
                loc_name = loc_stock['location']['name']
                loc_qty = loc_stock['quantity']
                self.location_detail_table.setItem(row, 0, QTableWidgetItem(loc_name))
                qty_item = QTableWidgetItem(str(loc_qty))
                qty_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
                self.location_detail_table.setItem(row, 1, qty_item)

    def filter_table_by_text(self):
        filter_text = self.search_input.text().lower()
        for row in range(self.table.rowCount()):
            name_text = self.table.item(row, 1).text().lower()
            sku_text = self.table.item(row, 2).text().lower()
            text_match = (filter_text in name_text or filter_text in sku_text)
            self.table.setRowHidden(row, not text_match)

    def handle_ean_scan(self):
        # ... (beze změny)
        pass

    def manage_categories(self):
        dialog = CategoryDialog(self.api_client, self)
        if dialog.exec(): self.load_categories()

    def manage_locations(self):
        dialog = LocationDialog(self.api_client, self)
        if dialog.exec(): self.load_locations()
        
    def manage_movements(self):
        dialog = MovementDialog(self.api_client, self.inventory_data, self.locations, self)
        if dialog.exec():
            self.load_inventory_data()

    def edit_selected_item(self):
        selected_rows = self.table.selectionModel().selectedRows()
        if not selected_rows: return
        item_id = int(self.table.item(selected_rows[0].row(), 0).text())
        item_data = next((item for item in self.inventory_data if item['id'] == item_id), None)
        if item_data:
            dialog = ItemDialog(self.api_client, self.categories_flat, item_data=item_data)
            if dialog.exec():
                self.statusBar().showMessage("Položka úspěšně upravena.", 5000)
                self.load_inventory_data()

    def add_new_item(self, prefill_ean=None):
        dialog = ItemDialog(self.api_client, self.categories_flat, prefill_ean=prefill_ean)
        if dialog.exec():
            self.statusBar().showMessage("Položka úspěšně vytvořena.", 5000)
            self.load_inventory_data()

    def import_from_xls(self):
        QMessageBox.information(self, "Změna v importu", 
            "Import nyní aktualizuje pouze popisné údaje položek (název, cena, SKU, EAN atd.).\n\n"
            "Množství na skladě se již neimportuje. Pro naskladnění prosím použijte tlačítko 'Naskladnit / Přesunout'.")
        
        path, _ = QFileDialog.getOpenFileName(self, "Otevřít soubor pro import údajů", "", "Excel soubory (*.xlsx *.xls)")
        if not path: return
        
        # ... Logika pro aktualizaci dat, ale bez `quantity` ...
        self.statusBar().showMessage("Import byl zjednodušen. Zkontrolujte prosím data.")
        self.load_initial_data()
    
    def export_inventory_xls(self):
        # ... (beze změny)
        path, _ = QFileDialog.getSaveFileName(self, "Uložit inventuru jako...", "inventura.xlsx", "Excel soubory (*.xlsx)")
        if not path: return
        try:
            export_inventory_to_xls(self.inventory_data, path)
            QMessageBox.information(self, "Export úspěšný", f"Inventura byla uložena do souboru:\n{path}")
        except Exception as e:
            QMessageBox.critical(self, "Chyba exportu", f"Nastala chyba: {e}")

    def export_movements_xls(self):
        # ... (beze změny)
        path, _ = QFileDialog.getSaveFileName(self, "Uložit pohyby jako...", "pohyby_skladu.xlsx", "Excel soubory (*.xlsx)")
        if not path: return
        audit_logs = self.api_client.get_audit_logs()
        if audit_logs is None: return
        try:
            export_audit_logs_to_xls(audit_logs, path)
            QMessageBox.information(self, "Export úspěšný", f"Historie pohybů byla uložena do souboru:\n{path}")
        except Exception as e:
            QMessageBox.critical(self, "Chyba exportu", f"Nastala chyba: {e}")