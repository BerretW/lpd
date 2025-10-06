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

class MainWindow(QMainWindow):
    def __init__(self, api_client):
        super().__init__()
        self.api_client = api_client
        self.setWindowTitle("Skladník Plus")
        self.setWindowIcon(qta.icon('fa5s.warehouse'))
        self.setGeometry(100, 100, 1200, 700)
        
        # Aplikace stylu na celé okno a jeho potomky
        self.setStyleSheet(MAIN_STYLESHEET)

        self.central_widget = QWidget()
        self.setCentralWidget(self.central_widget)
        
        self.layout = QVBoxLayout(self.central_widget)
        
        self.inventory_data = []
        self.categories_flat = []

        self._setup_ui()
        self.load_initial_data()
        
        # Zobrazení přihlášeného uživatele ve stavovém řádku
        self.statusBar().showMessage(f"Přihlášen jako: {api_client.user_email}")

    def _setup_ui(self):
        # --- Horní panel s tlačítky ---
        top_layout = QHBoxLayout()
        top_layout.setContentsMargins(0, 0, 0, 10) # Malé odsazení dole

        self.add_button = QPushButton(qta.icon('fa5s.plus-circle'), " Nová položka")
        self.edit_button = QPushButton(qta.icon('fa5s.edit'), " Upravit vybranou")
        self.refresh_button = QPushButton(qta.icon('fa5s.sync-alt'), " Obnovit data")
        self.categories_button = QPushButton(qta.icon('fa5s.sitemap'), " Spravovat kategorie")
        
        self.export_button = QPushButton(qta.icon('fa5s.file-excel'), " Export do XLS")
        self.import_button = QPushButton(qta.icon('fa5s.file-upload'), " Import z XLS")
        
        top_layout.addWidget(self.add_button)
        top_layout.addWidget(self.edit_button)
        top_layout.addWidget(self.refresh_button)
        top_layout.addWidget(self.categories_button)
        top_layout.addStretch()
        top_layout.addWidget(self.export_button)
        top_layout.addWidget(self.import_button)

        # --- Filtrovací panel ---
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
        
        # --- Tabulka ---
        self.table = QTableWidget()
        self.table.setColumnCount(7)
        self.table.setHorizontalHeaderLabels(["ID", "Název", "SKU", "EAN", "Počet kusů", "Cena", "Kategorie"])
        self.table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.table.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self.table.setAlternatingRowColors(True) # Zapne střídání barev
        self.table.verticalHeader().setVisible(False) # Skryje číslování řádků
        
        # --- Přidání do hlavního layoutu ---
        self.layout.addLayout(top_layout)
        self.layout.addWidget(filter_groupbox)
        self.layout.addWidget(self.table)
        
        # ... (propojení signálů zůstává stejné)
        self.refresh_button.clicked.connect(self.load_initial_data)
        self.add_button.clicked.connect(self.add_new_item)
        self.edit_button.clicked.connect(self.edit_selected_item)
        self.table.doubleClicked.connect(self.edit_selected_item)
        self.categories_button.clicked.connect(self.manage_categories)
        self.search_input.textChanged.connect(self.filter_table)
        self.category_filter_combo.currentIndexChanged.connect(self.filter_table)
        self.ean_input.returnPressed.connect(self.handle_ean_scan)
        self.export_button.clicked.connect(self.export_to_xls)
        self.import_button.clicked.connect(self.import_from_xls)

    # Všechny ostatní metody (load_initial_data, load_categories, atd.) zůstávají
    # funkčně stejné, není potřeba je měnit. Níže je jejich kompletní kód pro jistotu.
    
    def load_initial_data(self):
        self.statusBar().showMessage("Načítám kategorie a sklad...")
        self.load_categories()
        self.load_inventory_data()
        self.statusBar().showMessage("Data načtena.", 5000)

    def _flatten_categories(self, categories, flat_list, prefix=""):
        for cat in categories:
            flat_list.append({'id': cat['id'], 'name': prefix + cat['name']})
            if cat.get('children'):
                self._flatten_categories(cat['children'], flat_list, prefix + "- ")

    def load_categories(self):
        categories_tree = self.api_client.get_categories()
        self.categories_flat = []
        if categories_tree is not None:
            self._flatten_categories(categories_tree, self.categories_flat)
        
        current_selection = self.category_filter_combo.currentData()
        self.category_filter_combo.clear()
        self.category_filter_combo.addItem("Všechny kategorie", -1)
        for cat in self.categories_flat:
            self.category_filter_combo.addItem(cat['name'], cat['id'])
        
        # Obnovení výběru, pokud stále existuje
        index = self.category_filter_combo.findData(current_selection)
        if index != -1:
            self.category_filter_combo.setCurrentIndex(index)


    def load_inventory_data(self):
        self.inventory_data = self.api_client.get_inventory_items()
        self.table.setRowCount(0)
        
        if self.inventory_data is None:
            QMessageBox.critical(self, "Chyba", "Nepodařilo se načíst data ze skladu.")
            return
            
        self.table.setRowCount(len(self.inventory_data))
        for row, item in enumerate(self.inventory_data):
            category_name = item.get('category', {}).get('name', '') if item.get('category') else ''
            price = item.get('price')
            price_str = f"{price:.2f} Kč" if price is not None else "N/A"
            
            self.table.setItem(row, 0, QTableWidgetItem(str(item['id'])))
            self.table.setItem(row, 1, QTableWidgetItem(item['name']))
            self.table.setItem(row, 2, QTableWidgetItem(item['sku']))
            self.table.setItem(row, 3, QTableWidgetItem(item.get('ean', '')))
            
            quantity_item = QTableWidgetItem(str(item['quantity']))
            quantity_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            self.table.setItem(row, 4, quantity_item)

            price_item = QTableWidgetItem(price_str)
            price_item.setTextAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
            self.table.setItem(row, 5, price_item)
            
            self.table.setItem(row, 6, QTableWidgetItem(category_name))
        
        self.table.resizeColumnsToContents()
        self.table.horizontalHeader().setStretchLastSection(True)
        self.filter_table()

    def filter_table(self):
        filter_text = self.search_input.text().lower()
        category_id = self.category_filter_combo.currentData()

        for row in range(self.table.rowCount()):
            text_match = False
            category_match = False

            if (filter_text in self.table.item(row, 1).text().lower() or
                filter_text in self.table.item(row, 2).text().lower()):
                text_match = True

            item_id = int(self.table.item(row, 0).text())
            item_data = next((item for item in self.inventory_data if item['id'] == item_id), None)
            if category_id == -1 or (item_data and item_data.get('category_id') == category_id):
                category_match = True

            self.table.setRowHidden(row, not (text_match and category_match))

    def handle_ean_scan(self):
        ean = self.ean_input.text()
        if not ean: return
            
        self.statusBar().showMessage(f"Hledám EAN: {ean}...")
        item = self.api_client.find_item_by_ean(ean)
        
        if item:
            self.statusBar().showMessage(f"Položka '{item['name']}' nalezena.", 5000)
            dialog = ItemDialog(self.api_client, self.categories_flat, item_data=item)
            if dialog.exec():
                self.load_inventory_data()
        else:
            self.statusBar().showMessage(f"EAN {ean} nenalezen.", 5000)
            reply = QMessageBox.question(self, "Položka nenalezena",
                                         f"Položka s EAN kódem {ean} nebyla nalezena. Chcete ji vytvořit?",
                                         QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No)
            if reply == QMessageBox.StandardButton.Yes:
                self.add_new_item(prefill_ean=ean)
        
        self.ean_input.clear()

    def manage_categories(self):
        dialog = CategoryDialog(self.api_client, self)
        dialog.exec()
        self.load_categories()

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

    def export_to_xls(self):
        if not self.inventory_data:
            QMessageBox.warning(self, "Export", "Není co exportovat.")
            return

        path, _ = QFileDialog.getSaveFileName(self, "Uložit jako...", "sklad_export.xlsx", "Excel soubory (*.xlsx)")
        if not path: return

        self.statusBar().showMessage("Exportuji data do XLS...")
        try:
            df = pd.DataFrame(self.inventory_data)
            df['category_name'] = df['category'].apply(lambda x: x['name'] if x and 'name' in x else '')
            df_export = df[['name', 'sku', 'ean', 'quantity', 'price', 'category_name', 'description']]
            df_export.columns = ['Název', 'SKU', 'EAN', 'Počet kusů', 'Cena', 'Kategorie', 'Popis']
            
            df_export.to_excel(path, index=False)
            self.statusBar().showMessage(f"Data úspěšně exportována.", 5000)
            QMessageBox.information(self, "Export úspěšný", f"Data byla uložena do souboru:\n{path}")
        except Exception as e:
            QMessageBox.critical(self, "Chyba exportu", f"Nastala chyba: {e}")
            self.statusBar().showMessage("Chyba při exportu.", 5000)
            
    def import_from_xls(self):
        path, _ = QFileDialog.getOpenFileName(self, "Otevřít soubor", "", "Excel soubory (*.xlsx *.xls)")
        if not path: return

        try:
            df = pd.read_excel(path)
            required_cols = ['Název', 'SKU']
            if not all(col in df.columns for col in required_cols):
                raise ValueError(f"Soubor musí obsahovat sloupce: {', '.join(required_cols)}")
        except Exception as e:
            QMessageBox.critical(self, "Chyba při čtení souboru", f"Nastala chyba: {e}")
            return
        
        reply = QMessageBox.question(self, "Potvrzení importu", 
            f"Nalezeno {len(df)} položek. Chcete spustit import?\nPOZOR: Položky se stejným SKU budou aktualizovány!",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No)

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

            item_data = {
                "name": row.get('Název'), "sku": str(sku),
                "ean": str(row.get('EAN')) if not pd.isna(row.get('EAN')) else None,
                "quantity": int(row.get('Počet kusů', 0)),
                "price": float(row.get('Cena', 0.0)),
                "description": str(row.get('Popis', '')) if not pd.isna(row.get('Popis')) else None,
                "category_id": cat_id
            }

            if sku in sku_map:
                self.api_client.update_inventory_item(sku_map[sku], item_data)
                updated_count += 1
            else:
                new_item = self.api_client.create_inventory_item(item_data)
                if new_item: created_count += 1
            
            self.statusBar().showMessage(f"Zpracovávám {index + 1}/{len(df)}...")

        QMessageBox.information(self, "Import dokončen", 
            f"Vytvořeno: {created_count} nových položek.\nAktualizováno: {updated_count} stávajících položek.")
        self.load_initial_data()