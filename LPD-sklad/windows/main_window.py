# windows/main_window.py
from PyQt6.QtWidgets import (QMainWindow, QWidget, QVBoxLayout, QTableWidget, QTableWidgetItem,
                             QPushButton, QHBoxLayout, QLineEdit, QLabel, QAbstractItemView, 
                             QMessageBox, QFileDialog, QComboBox, QGroupBox, QSplitter, 
                             QTabWidget, QToolBar, QSizePolicy)
from PyQt6.QtGui import QAction
from PyQt6.QtCore import Qt, QDateTime, QSize # OPRAVA: Přidán import QSize
import qtawesome as qta

from styling import MAIN_STYLESHEET
from .item_dialog import ItemDialog
from .category_dialog import CategoryDialog
from .location_dialog import LocationDialog
from .movement_dialog import MovementDialog
from .write_off_dialog import WriteOffDialog
from .audit_log_dialog import AuditLogDialog
from .picking_order_create_dialog import PickingOrderCreateDialog
from .picking_order_fulfill_dialog import PickingOrderFulfillDialog
from .import_dialog import ImportDialog
from xls_exporter import export_inventory_to_xls

class MainWindow(QMainWindow):
    def __init__(self, api_client):
        super().__init__()
        self.api_client = api_client
        self.setWindowTitle("Skladník Plus")
        self.setWindowIcon(qta.icon('fa5s.warehouse'))
        self.setGeometry(100, 100, 1400, 800)
        
        self.setStyleSheet(MAIN_STYLESHEET)
        
        self.inventory_data = []
        self.picking_orders = []
        self.categories_flat = []
        self.locations = []
        self.company_members = []

        self._create_actions()
        self._setup_ui()
        self.load_initial_data()
        self.statusBar().showMessage(f"Přihlášen jako: {api_client.user_email}")

    def _create_actions(self):
        """NOVÁ METODA: Vytvoří QAction objekty pro použití v toolbaru."""
        # Správa položek a číselníků
        self.add_item_action = QAction(qta.icon('fa5s.plus-circle'), "Nová položka", self)
        self.edit_item_action = QAction(qta.icon('fa5s.edit'), "Upravit položku", self)
        self.locations_action = QAction(qta.icon('fa5s.map-marker-alt'), "Správa lokací", self)
        self.categories_action = QAction(qta.icon('fa5s.sitemap'), "Správa kategorií", self)
        # Požadavky
        self.create_picking_order_action = QAction(qta.icon('fa5s.file-medical'), "Vytvořit požadavek", self)
        self.fulfill_picking_order_action = QAction(qta.icon('fa5s.check-double'), "Zpracovat požadavek", self)
        # Operace
        self.movement_action = QAction(qta.icon('fa5s.dolly-flatbed'), "Naskladnit / Přesunout", self)
        self.write_off_action = QAction(qta.icon('fa5s.trash-alt'), "Odepsat položku", self)
        # Nástroje
        self.audit_log_action = QAction(qta.icon('fa5s.history'), "Historie pohybů", self)
        self.import_xls_action = QAction(qta.icon('fa5s.file-upload'), "Import z XLS", self)
        self.export_inventory_action = QAction(qta.icon('fa5s.file-excel'), "Export inventury", self)
        # Obnovení
        self.refresh_action = QAction(qta.icon('fa5s.sync-alt'), "Obnovit vše", self)


    def _setup_ui(self):
        self.central_widget = QWidget()
        self.setCentralWidget(self.central_widget)
        self.layout = QVBoxLayout(self.central_widget)

        # ZMĚNA: Horní panel je nyní řešen přes QToolBar pro čistší vzhled
        self._create_toolbar()
        
        self.tabs = QTabWidget()
        self.inventory_tab = self._create_inventory_tab()
        self.picking_orders_tab = self._create_picking_orders_tab()
        
        self.tabs.addTab(self.inventory_tab, qta.icon('fa5s.boxes'), "Skladové položky")
        self.tabs.addTab(self.picking_orders_tab, qta.icon('fa5s.clipboard-list'), "Požadavky na materiál")
        
        self.layout.addWidget(self.tabs)
        self._connect_signals()

    def _create_toolbar(self):
        """NOVÁ METODA: Vytvoří a naplní hlavní toolbar."""
        toolbar = QToolBar("Hlavní nástroje")
        
        # OPRAVA: Správné nastavení velikosti ikon
        # Získáme výšku textu a vytvoříme z ní QSize objekt.
        icon_height = self.fontMetrics().height()
        toolbar.setIconSize(QSize(icon_height, icon_height))

        self.addToolBar(toolbar)

        toolbar.addAction(self.add_item_action)
        toolbar.addAction(self.edit_item_action)
        toolbar.addSeparator()
        toolbar.addAction(self.locations_action)
        toolbar.addAction(self.categories_action)
        toolbar.addSeparator()
        toolbar.addAction(self.create_picking_order_action)
        toolbar.addAction(self.fulfill_picking_order_action)
        toolbar.addSeparator()
        toolbar.addAction(self.movement_action)
        toolbar.addAction(self.write_off_action)
        toolbar.addSeparator()
        toolbar.addAction(self.audit_log_action)
        toolbar.addAction(self.import_xls_action)
        toolbar.addAction(self.export_inventory_action)
        
        # Přidá "pružinu", která odtlačí následující akci na pravý okraj
        spacer = QWidget()
        spacer.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)
        toolbar.addWidget(spacer)
        
        toolbar.addAction(self.refresh_action)

    def _create_inventory_tab(self):
        tab = QWidget()
        layout = QVBoxLayout(tab)
        filter_groupbox = QGroupBox("Filtry a vyhledávání")
        filter_layout = QHBoxLayout(filter_groupbox)
        filter_layout.addWidget(QLabel("Hledat:"))
        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("Napište název, SKU...")
        filter_layout.addWidget(self.search_input)
        filter_layout.addWidget(QLabel("Kategorie:"))
        self.category_filter_combo = QComboBox()
        filter_layout.addWidget(self.category_filter_combo)
        filter_layout.addWidget(QLabel("Skenovat EAN:"))
        self.ean_input = QLineEdit()
        self.ean_input.setPlaceholderText("Kurzor zde pro skenování...")
        filter_layout.addWidget(self.ean_input)
        
        splitter = QSplitter(Qt.Orientation.Vertical)
        self.inventory_table = QTableWidget()
        self.inventory_table.setColumnCount(7)
        self.inventory_table.setHorizontalHeaderLabels(["ID", "Název", "SKU", "EAN", "Celkem kusů", "Cena", "Kategorie"])
        self.inventory_table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.inventory_table.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self.inventory_table.setAlternatingRowColors(True)
        self.inventory_table.verticalHeader().setVisible(False)
        
        location_detail_group = QGroupBox("Rozpis množství na lokacích pro vybranou položku")
        location_detail_layout = QVBoxLayout(location_detail_group)
        self.location_detail_table = QTableWidget()
        self.location_detail_table.setColumnCount(2)
        self.location_detail_table.setHorizontalHeaderLabels(["Název lokace", "Počet kusů"])
        self.location_detail_table.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        location_detail_layout.addWidget(self.location_detail_table)
        
        splitter.addWidget(self.inventory_table)
        splitter.addWidget(location_detail_group)
        splitter.setSizes([500, 300])

        layout.addWidget(filter_groupbox)
        layout.addWidget(splitter)
        return tab

    def _create_picking_orders_tab(self):
        tab = QWidget()
        layout = QVBoxLayout(tab)
        filter_groupbox = QGroupBox("Filtrovat požadavky")
        filter_layout = QHBoxLayout(filter_groupbox)
        filter_layout.addWidget(QLabel("Stav:"))
        self.picking_status_filter = QComboBox()
        self.picking_status_filter.addItem("Všechny", "all")
        self.picking_status_filter.addItem("Nové", "new")
        self.picking_status_filter.addItem("V přípravě", "in_progress")
        self.picking_status_filter.addItem("Hotové", "completed")
        self.picking_status_filter.addItem("Zrušené", "cancelled")
        filter_layout.addWidget(self.picking_status_filter)
        filter_layout.addStretch()

        splitter = QSplitter(Qt.Orientation.Vertical)
        self.picking_orders_table = QTableWidget()
        self.picking_orders_table.setColumnCount(7)
        self.picking_orders_table.setHorizontalHeaderLabels(["ID", "Stav", "Ze skladu", "Do skladu", "Vytvořil", "Datum vytvoření", "Poznámka"])
        self.picking_orders_table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.picking_orders_table.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self.picking_orders_table.setAlternatingRowColors(True)
        self.picking_orders_table.verticalHeader().setVisible(False)

        detail_group = QGroupBox("Položky ve vybraném požadavku")
        detail_layout = QVBoxLayout(detail_group)
        self.picking_order_detail_table = QTableWidget()
        self.picking_order_detail_table.setColumnCount(4)
        self.picking_order_detail_table.setHorizontalHeaderLabels(["Položka / Popis", "SKU", "Požadováno ks", "Vychystáno ks"])
        self.picking_order_detail_table.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        detail_layout.addWidget(self.picking_order_detail_table)

        splitter.addWidget(self.picking_orders_table)
        splitter.addWidget(detail_group)
        splitter.setSizes([400, 400])

        layout.addWidget(filter_groupbox)
        layout.addWidget(splitter)
        return tab

    def _connect_signals(self):
        # ZMĚNA: Propojení signálů z QAction místo QPushButton
        self.refresh_action.triggered.connect(self.load_initial_data)
        self.add_item_action.triggered.connect(self.add_new_item)
        self.edit_item_action.triggered.connect(self.edit_selected_item)
        self.locations_action.triggered.connect(self.manage_locations)
        self.categories_action.triggered.connect(self.manage_categories)
        self.create_picking_order_action.triggered.connect(self.open_create_picking_order_dialog)
        self.fulfill_picking_order_action.triggered.connect(self.open_fulfill_picking_order_dialog)
        self.movement_action.triggered.connect(self.manage_movements)
        self.write_off_action.triggered.connect(self.open_write_off_dialog)
        self.audit_log_action.triggered.connect(self.show_audit_logs)
        self.import_xls_action.triggered.connect(self.import_from_xls)
        self.export_inventory_action.triggered.connect(self.export_inventory_xls)

        # Ostatní propojení zůstávají
        self.inventory_table.doubleClicked.connect(self.edit_selected_item)
        self.inventory_table.itemSelectionChanged.connect(self.update_location_details_view)
        self.search_input.textChanged.connect(self.filter_inventory_table)
        self.category_filter_combo.currentIndexChanged.connect(self.load_inventory_data)
        self.picking_status_filter.currentIndexChanged.connect(self.load_picking_orders)
        self.picking_orders_table.itemSelectionChanged.connect(self.update_picking_order_detail_view)

    def load_initial_data(self):
        self.statusBar().showMessage("Načítám data z API...")
        self.load_company_members()
        self.load_categories()
        self.load_locations()
        self.load_inventory_data()
        self.load_picking_orders()
        self.statusBar().showMessage("Všechna data byla úspěšně načtena.", 5000)

    def load_company_members(self): self.company_members = self.api_client.get_company_members() or []
    def load_locations(self): self.locations = self.api_client.get_locations() or []
    def load_categories(self):
        categories_tree = self.api_client.get_categories()
        self.categories_flat = []
        if categories_tree: self._flatten_categories(categories_tree, self.categories_flat)
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
        selected_category_id = self.category_filter_combo.currentData()
        self.inventory_data = self.api_client.get_inventory_items(category_id=selected_category_id) or []
        self.update_inventory_table()

    def load_picking_orders(self):
        status = self.picking_status_filter.currentData()
        self.picking_orders = self.api_client.get_picking_orders(status=status) or []
        self.update_picking_orders_table()

    def update_inventory_table(self):
        self.inventory_table.setRowCount(0)
        self.inventory_table.setRowCount(len(self.inventory_data))
        for row, item in enumerate(self.inventory_data):
            category = item.get('category')
            category_name = category.get('name', '') if category else ''
            price = item.get('price')
            price_str = f"{price:.2f} Kč" if price is not None else "N/A"
            quantity_item = QTableWidgetItem(str(item['total_quantity']))
            quantity_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            self.inventory_table.setItem(row, 0, QTableWidgetItem(str(item['id'])))
            self.inventory_table.setItem(row, 1, QTableWidgetItem(item['name']))
            self.inventory_table.setItem(row, 2, QTableWidgetItem(item['sku']))
            self.inventory_table.setItem(row, 3, QTableWidgetItem(item.get('ean', '')))
            self.inventory_table.setItem(row, 4, quantity_item)
            self.inventory_table.setItem(row, 5, QTableWidgetItem(price_str))
            self.inventory_table.setItem(row, 6, QTableWidgetItem(category_name))
        self.inventory_table.resizeColumnsToContents()

    def update_picking_orders_table(self):
        self.picking_orders_table.setRowCount(0)
        self.picking_orders_table.setRowCount(len(self.picking_orders))
        for row, order in enumerate(self.picking_orders):
            dt = QDateTime.fromString(order['created_at'], Qt.DateFormat.ISODate)
            
            source_location = order.get('source_location')
            source_name = "Hlavní sklad" if source_location is None else source_location.get('name', 'N/A')
            
            self.picking_orders_table.setItem(row, 0, QTableWidgetItem(str(order['id'])))
            self.picking_orders_table.setItem(row, 1, QTableWidgetItem(order['status']))
            self.picking_orders_table.setItem(row, 2, QTableWidgetItem(source_name))
            self.picking_orders_table.setItem(row, 3, QTableWidgetItem(order.get('destination_location', {}).get('name', 'N/A')))
            self.picking_orders_table.setItem(row, 4, QTableWidgetItem(order.get('created_by', {}).get('email', 'N/A')))
            self.picking_orders_table.setItem(row, 5, QTableWidgetItem(dt.toLocalTime().toString("dd.MM.yyyy HH:mm")))
            self.picking_orders_table.setItem(row, 6, QTableWidgetItem(order.get('notes', '')))
        self.picking_orders_table.resizeColumnsToContents()
        self.update_picking_order_detail_view()

    def update_location_details_view(self):
        self.location_detail_table.setRowCount(0)
        selected_rows = self.inventory_table.selectionModel().selectedRows()
        if not selected_rows: return
        item_id = int(self.inventory_table.item(selected_rows[0].row(), 0).text())
        item_data = next((item for item in self.inventory_data if item['id'] == item_id), None)
        if item_data and 'locations' in item_data:
            locations = item_data['locations']
            self.location_detail_table.setRowCount(len(locations))
            for row, loc_stock in enumerate(locations):
                loc_name = loc_stock['location']['name']
                loc_qty = loc_stock['quantity']
                self.location_detail_table.setItem(row, 0, QTableWidgetItem(loc_name))
                self.location_detail_table.setItem(row, 1, QTableWidgetItem(str(loc_qty)))
        self.location_detail_table.resizeColumnsToContents()

    def update_picking_order_detail_view(self):
        self.picking_order_detail_table.setRowCount(0)
        selected_rows = self.picking_orders_table.selectionModel().selectedRows()
        if not selected_rows:
            self.fulfill_picking_order_action.setEnabled(False)
            return
        order_id = int(self.picking_orders_table.item(selected_rows[0].row(), 0).text())
        order = next((o for o in self.picking_orders if o['id'] == order_id), None)
        if not order: return

        can_fulfill = order['status'] in ['new', 'in_progress']
        self.fulfill_picking_order_action.setEnabled(can_fulfill)

        items = order.get('items', [])
        self.picking_order_detail_table.setRowCount(len(items))
        for row, item in enumerate(items):
            inventory_item_data = item.get('inventory_item')
            desc = inventory_item_data['name'] if inventory_item_data else item.get('requested_item_description', 'CHYBA')
            sku = inventory_item_data['sku'] if inventory_item_data else 'Nové'
            req_qty = str(item['requested_quantity'])
            pick_qty = str(item.get('picked_quantity', ''))
            self.picking_order_detail_table.setItem(row, 0, QTableWidgetItem(desc))
            self.picking_order_detail_table.setItem(row, 1, QTableWidgetItem(sku))
            self.picking_order_detail_table.setItem(row, 2, QTableWidgetItem(req_qty))
            self.picking_order_detail_table.setItem(row, 3, QTableWidgetItem(pick_qty))
        self.picking_order_detail_table.resizeColumnsToContents()

    def filter_inventory_table(self):
        filter_text = self.search_input.text().lower()
        for row in range(self.inventory_table.rowCount()):
            name_text = self.inventory_table.item(row, 1).text().lower()
            sku_text = self.inventory_table.item(row, 2).text().lower()
            text_match = (filter_text in name_text or filter_text in sku_text)
            self.inventory_table.setRowHidden(row, not text_match)

    def add_new_item(self):
        dialog = ItemDialog(self.api_client, self.categories_flat)
        if dialog.exec(): self.load_inventory_data()

    def edit_selected_item(self):
        selected_rows = self.inventory_table.selectionModel().selectedRows()
        if not selected_rows: return
        item_id = int(self.inventory_table.item(selected_rows[0].row(), 0).text())
        item_data = next((item for item in self.inventory_data if item['id'] == item_id), None)
        if item_data:
            dialog = ItemDialog(self.api_client, self.categories_flat, item_data=item_data)
            if dialog.exec(): self.load_inventory_data()
        
    def manage_locations(self):
        dialog = LocationDialog(self.api_client, self)
        if dialog.exec(): self.load_initial_data()

    def manage_categories(self):
        dialog = CategoryDialog(self.api_client, self)
        if dialog.exec(): self.load_categories()

    def manage_movements(self):
        dialog = MovementDialog(self.api_client, self.inventory_data, self.locations, self)
        if dialog.exec():
            self.load_inventory_data()

    def open_write_off_dialog(self):
        selected_rows = self.inventory_table.selectionModel().selectedRows()
        selected_item_id = None
        if selected_rows:
            selected_item_id = int(self.inventory_table.item(selected_rows[0].row(), 0).text())
        items_with_stock = [item for item in self.inventory_data if item.get('total_quantity', 0) > 0]
        if not items_with_stock:
             QMessageBox.warning(self, "Info", "Žádné položky nejsou naskladněny.")
             return
        dialog = WriteOffDialog(self.api_client, items_with_stock, self, selected_item_id=selected_item_id)
        if dialog.exec(): self.load_inventory_data()

    def show_audit_logs(self):
        dialog = AuditLogDialog(self.api_client, self.inventory_data, self.company_members, self)
        dialog.exec()
    
    def open_create_picking_order_dialog(self):
        dialog = PickingOrderCreateDialog(self.api_client, self.inventory_data, self.locations, self)
        if dialog.exec():
            self.load_picking_orders()
            self.tabs.setCurrentWidget(self.picking_orders_tab)

    def open_fulfill_picking_order_dialog(self):
        selected_rows = self.picking_orders_table.selectionModel().selectedRows()
        if not selected_rows: return
        order_id = int(self.picking_orders_table.item(selected_rows[0].row(), 0).text())
        order_data = next((o for o in self.picking_orders if o['id'] == order_id), None)
        if order_data:
            dialog = PickingOrderFulfillDialog(self.api_client, order_data, self.inventory_data, self)
            dialog.inventory_updated.connect(self.load_inventory_data)
            if dialog.exec():
                self.load_picking_orders()
                self.load_inventory_data()

    def import_from_xls(self):
        dialog = ImportDialog(self.api_client, self)
        if dialog.exec(): self.load_initial_data()
    
    def export_inventory_xls(self):
        path, _ = QFileDialog.getSaveFileName(self, "Uložit inventuru jako...", "inventura.xlsx", "Excel soubory (*.xlsx)")
        if not path: return
        try:
            export_inventory_to_xls(self.inventory_data, path)
            QMessageBox.information(self, "Export úspěšný", f"Inventura byla uložena do souboru:\n{path}")
        except Exception as e:
            QMessageBox.critical(self, "Chyba exportu", f"Nastala chyba: {e}")