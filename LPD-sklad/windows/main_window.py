# windows/main_window.py
import pandas as pd
from PyQt6.QtWidgets import (QMainWindow, QWidget, QVBoxLayout, QTableWidget, QTableWidgetItem,
                             QPushButton, QHBoxLayout, QLineEdit, QLabel, QAbstractItemView, 
                             QMessageBox, QFileDialog, QComboBox, QGroupBox)
from PyQt6.QtCore import Qt
import qtawesome as qta

from styling import MAIN_STYLESHEET
from .item_dialog import ItemDialog
from .category_dialog import CategoryDialog
from xls_exporter import export_inventory_to_xls, export_audit_logs_to_xls

class MainWindow(QMainWindow):
    def __init__(self, api_client):
        super().__init__()
        self.api_client = api_client
        self.setWindowTitle("Skladník Plus")
        self.setWindowIcon(qta.icon('fa5s.warehouse'))
        self.setGeometry(100, 100, 1200, 700)
        
        self.setStyleSheet(MAIN_STYLESHEET)
        self.central_widget = QWidget()
        self.setCentralWidget(self.central_widget)
        self.layout = QVBoxLayout(self.central_widget)
        
        self.inventory_data = []
        self.categories_flat = []

        self._setup_ui()
        self.load_initial_data()
        self.statusBar().showMessage(f"Přihlášen jako: {api_client.user_email}")

    def _setup_ui(self):
        # ... (UI setup zůstává stejný)
        top_layout = QHBoxLayout()
        top_layout.setContentsMargins(0, 0, 0, 10)
        data_group = QGroupBox("Správa dat")
        data_layout = QHBoxLayout(data_group)
        self.add_button = QPushButton(qta.icon('fa5s.plus-circle'), " Nová položka")
        self.edit_button = QPushButton(qta.icon('fa5s.edit'), " Upravit")
        self.refresh_button = QPushButton(qta.icon('fa5s.sync-alt'), " Obnovit")
        self.categories_button = QPushButton(qta.icon('fa5s.sitemap'), " Kategorie")
        data_layout.addWidget(self.add_button)
        data_layout.addWidget(self.edit_button)
        data_layout.addWidget(self.refresh_button)
        data_layout.addWidget(self.categories_button)
        io_group = QGroupBox("Import / Export do XLS")
        io_layout = QHBoxLayout(io_group)
        self.import_xls_button = QPushButton(qta.icon('fa5s.file-upload'), " Importovat sklad")
        self.export_inventory_button = QPushButton(qta.icon('fa5s.file-excel'), " Exportovat inventuru")
        self.export_movements_button = QPushButton(qta.icon('fa5s.file-excel'), " Exportovat pohyby")
        io_layout.addWidget(self.import_xls_button)
        io_layout.addWidget(self.export_inventory_button)
        io_layout.addWidget(self.export_movements_button)
        top_layout.addWidget(data_group)
        top_layout.addWidget(io_group)
        top_layout.addStretch()
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
        self.table = QTableWidget()
        self.table.setColumnCount(7)
        self.table.setHorizontalHeaderLabels(["ID", "Název", "SKU", "EAN", "Počet kusů", "Cena", "Kategorie"])
        self.table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.table.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self.table.setAlternatingRowColors(True)
        self.table.verticalHeader().setVisible(False)
        self.layout.addLayout(top_layout)
        self.layout.addWidget(filter_groupbox)
        self.layout.addWidget(self.table)
        
        # --- ÚPRAVA PROPOJENÍ SIGNÁLŮ ---
        self.refresh_button.clicked.connect(self.load_initial_data)
        self.add_button.clicked.connect(self.add_new_item)
        self.edit_button.clicked.connect(self.edit_selected_item)
        self.table.doubleClicked.connect(self.edit_selected_item)
        self.categories_button.clicked.connect(self.manage_categories)
        self.search_input.textChanged.connect(self.filter_table_by_text) # Změna na lokální textový filtr
        self.category_filter_combo.currentIndexChanged.connect(self.load_inventory_data) # Změna kategorie znovu načte data
        self.ean_input.returnPressed.connect(self.handle_ean_scan)
        self.import_xls_button.clicked.connect(self.import_from_xls)
        self.export_inventory_button.clicked.connect(self.export_inventory_xls)
        self.export_movements_button.clicked.connect(self.export_movements_xls)

    def load_initial_data(self):
        self.statusBar().showMessage("Načítám kategorie a sklad...")
        self.load_categories()
        self.load_inventory_data() # Toto již zavolá API s výchozím filtrem

    def load_categories(self):
        # ... (tato metoda zůstává beze změny)
        categories_tree = self.api_client.get_categories()
        self.categories_flat = []
        if categories_tree is not None: self._flatten_categories(categories_tree, self.categories_flat)
        current_selection = self.category_filter_combo.currentData()
        self.category_filter_combo.blockSignals(True) # Dočasně zablokujeme signály, abychom nespustili reload
        self.category_filter_combo.clear()
        self.category_filter_combo.addItem("Všechny kategorie", -1)
        for cat in self.categories_flat: self.category_filter_combo.addItem(cat['name'], cat['id'])
        index = self.category_filter_combo.findData(current_selection)
        if index != -1: self.category_filter_combo.setCurrentIndex(index)
        self.category_filter_combo.blockSignals(False) # Odblokujeme signály

    def _flatten_categories(self, categories, flat_list, prefix=""):
        # ... (tato metoda zůstává beze změny)
        for cat in categories:
            flat_list.append({'id': cat['id'], 'name': prefix + cat['name']})
            if cat.get('children'): self._flatten_categories(cat['children'], flat_list, prefix + "- ")

    def load_inventory_data(self):
        """Načte data z API na základě aktuálně vybrané kategorie."""
        self.statusBar().showMessage("Načítám data ze skladu...")
        selected_category_id = self.category_filter_combo.currentData()
        
        self.inventory_data = self.api_client.get_inventory_items(category_id=selected_category_id)
        
        self.table.setRowCount(0)
        if self.inventory_data is None:
            QMessageBox.critical(self, "Chyba", "Nepodařilo se načíst data ze skladu."); return

        self.table.setRowCount(len(self.inventory_data))
        for row, item in enumerate(self.inventory_data):
            category_name = item.get('category', {}).get('name', '') if item.get('category') else ''
            price = item.get('price')
            price_str = f"{price:.2f} Kč" if price is not None else "N/A"
            self.table.setItem(row, 0, QTableWidgetItem(str(item['id'])))
            self.table.setItem(row, 1, QTableWidgetItem(item['name']))
            self.table.setItem(row, 2, QTableWidgetItem(item['sku']))
            self.table.setItem(row, 3, QTableWidgetItem(item.get('ean', '')))
            quantity_item = QTableWidgetItem(str(item['quantity'])); quantity_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            self.table.setItem(row, 4, quantity_item)
            price_item = QTableWidgetItem(price_str); price_item.setTextAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
            self.table.setItem(row, 5, price_item)
            self.table.setItem(row, 6, QTableWidgetItem(category_name))
        
        self.table.resizeColumnsToContents()
        self.table.horizontalHeader().setStretchLastSection(True)
        
        # Aplikujeme textový filtr na nově načtená data
        self.filter_table_by_text()
        self.statusBar().showMessage(f"Načteno {len(self.inventory_data)} položek.", 5000)

    def filter_table_by_text(self):
        """Filtruje POUZE podle textu v search boxu. Běží lokálně."""
        filter_text = self.search_input.text().lower()
        for row in range(self.table.rowCount()):
            name_text = self.table.item(row, 1).text().lower()
            sku_text = self.table.item(row, 2).text().lower()
            
            text_match = (filter_text in name_text or filter_text in sku_text)
            self.table.setRowHidden(row, not text_match)

    # Všechny ostatní metody (handle_ean_scan, manage_categories, atd.) zůstávají stejné
    def handle_ean_scan(self):
        ean = self.ean_input.text()
        if not ean: return
        self.statusBar().showMessage(f"Hledám EAN: {ean}...")
        item = self.api_client.find_item_by_ean(ean)
        if item:
            self.statusBar().showMessage(f"Položka '{item['name']}' nalezena.", 5000)
            dialog = ItemDialog(self.api_client, self.categories_flat, item_data=item)
            if dialog.exec(): self.load_inventory_data()
        else:
            self.statusBar().showMessage(f"EAN {ean} nenalezen.", 5000)
            reply = QMessageBox.question(self, "Položka nenalezena", f"Položka s EAN kódem {ean} nebyla nalezena. Chcete ji vytvořit?", QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No)
            if reply == QMessageBox.StandardButton.Yes: self.add_new_item(prefill_ean=ean)
        self.ean_input.clear()

    def manage_categories(self):
        dialog = CategoryDialog(self.api_client, self); dialog.exec(); self.load_categories()

    def edit_selected_item(self):
        selected_rows = self.table.selectionModel().selectedRows()
        if not selected_rows: return
        item_id = int(self.table.item(selected_rows[0].row(), 0).text())
        item_data = next((item for item in self.inventory_data if item['id'] == item_id), None)
        if item_data:
            dialog = ItemDialog(self.api_client, self.categories_flat, item_data=item_data)
            if dialog.exec(): self.statusBar().showMessage("Položka úspěšně upravena.", 5000); self.load_inventory_data()

    def add_new_item(self, prefill_ean=None):
        dialog = ItemDialog(self.api_client, self.categories_flat, prefill_ean=prefill_ean)
        if dialog.exec(): self.statusBar().showMessage("Položka úspěšně vytvořena.", 5000); self.load_inventory_data()

    def import_from_xls(self):
        path, _ = QFileDialog.getOpenFileName(self, "Otevřít soubor", "", "Excel soubory (*.xlsx *.xls)")
        if not path: return
        try:
            df = pd.read_excel(path)
            required_cols = ['Název', 'SKU']
            if not all(col in df.columns for col in required_cols): raise ValueError(f"Soubor musí obsahovat sloupce: {', '.join(required_cols)}")
        except Exception as e: QMessageBox.critical(self, "Chyba při čtení souboru", f"Nastala chyba: {e}"); return
        reply = QMessageBox.question(self, "Potvrzení importu", f"Nalezeno {len(df)} položek. Chcete spustit import?\nPOZOR: Položky se stejným SKU budou aktualizovány!", QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No)
        if reply == QMessageBox.StandardButton.No: return
        self.statusBar().showMessage("Probíhá import...")
        created_count, updated_count = 0, 0
        sku_map = {item['sku']: item['id'] for item in self.inventory_data}
        cat_name_map = {cat['name'].lower(): cat['id'] for cat in self.categories_flat}
        for index, row in df.iterrows():
            sku = row.get('SKU')
            if pd.isna(sku): continue
            category_name = row.get('Kategorie', '')
            cat_id = cat_name_map.get(str(category_name).lower()) if not pd.isna(category_name) else None
            item_data = {"name": row.get('Název'), "sku": str(sku), "ean": str(row.get('EAN')) if not pd.isna(row.get('EAN')) else None, "quantity": int(row.get('Počet kusů', 0)), "price": float(row.get('Cena', 0.0)), "description": str(row.get('Popis', '')) if not pd.isna(row.get('Popis')) else None, "category_id": cat_id}
            if sku in sku_map: self.api_client.update_inventory_item(sku_map[sku], item_data); updated_count += 1
            else:
                if self.api_client.create_inventory_item(item_data): created_count += 1
            self.statusBar().showMessage(f"Zpracovávám {index + 1}/{len(df)}...")
        QMessageBox.information(self, "Import dokončen", f"Vytvořeno: {created_count} nových položek.\nAktualizováno: {updated_count} stávajících položek.")
        self.load_initial_data()
    
    def export_inventory_xls(self):
        path, _ = QFileDialog.getSaveFileName(self, "Uložit inventuru jako...", "inventura.xlsx", "Excel soubory (*.xlsx)")
        if not path: return
        self.statusBar().showMessage("Exportuji inventuru do XLS...")
        try:
            export_inventory_to_xls(self.inventory_data, path)
            self.statusBar().showMessage("Inventura úspěšně exportována.", 5000)
            QMessageBox.information(self, "Export úspěšný", f"Inventura byla uložena do souboru:\n{path}")
        except Exception as e:
            QMessageBox.critical(self, "Chyba exportu", f"Nastala chyba: {e}")
            self.statusBar().showMessage("Chyba při exportu.", 5000)

    def export_movements_xls(self):
        path, _ = QFileDialog.getSaveFileName(self, "Uložit pohyby jako...", "pohyby_skladu.xlsx", "Excel soubory (*.xlsx)")
        if not path: return
        self.statusBar().showMessage("Načítám historii pohybů z API...")
        audit_logs = self.api_client.get_audit_logs()
        if audit_logs is None:
            QMessageBox.critical(self, "Chyba", "Nepodařilo se načíst historii pohybů."); return
        self.statusBar().showMessage("Exportuji pohyby ve skladu do XLS...")
        try:
            export_audit_logs_to_xls(audit_logs, path)
            self.statusBar().showMessage("Pohyby ve skladu úspěšně exportovány.", 5000)
            QMessageBox.information(self, "Export úspěšný", f"Historie pohybů byla uložena do souboru:\n{path}")
        except Exception as e:
            QMessageBox.critical(self, "Chyba exportu", f"Nastala chyba: {e}")
            self.statusBar().showMessage("Chyba při exportu.", 5000)