# windows/main_window.py
from PyQt6.QtWidgets import (QMainWindow, QWidget, QVBoxLayout, QTableWidget, QTableWidgetItem,
                             QPushButton, QHBoxLayout, QLineEdit, QLabel, QAbstractItemView, 
                             QMessageBox, QFileDialog, QComboBox, QGroupBox, QSplitter, 
                             QTabWidget, QToolBar, QSizePolicy, QMenu)
from PyQt6.QtGui import QAction, QKeySequence
from PyQt6.QtCore import Qt, QDateTime, QSize
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
        
        # Datové zásobníky
        self.inventory_data = []
        self.picking_orders = []
        self.categories_flat = []
        self.locations = []
        self.company_members = []

        # Inicializace UI
        self._create_actions()
        self._create_menubar()
        self._setup_ui()
        
        # Načtení dat
        self.load_initial_data()
        self.statusBar().showMessage(f"Přihlášen jako: {api_client.user_email}")

    def _create_actions(self):
        """Definice všech akcí aplikace s ikonami a zkratkami."""
        # --- SKLAD ---
        self.automaton_action = QAction(qta.icon('fa5s.robot'), "Skladový automat", self)
        self.automaton_action.setShortcut(QKeySequence("Ctrl+A"))
        self.add_item_action = QAction(qta.icon('fa5s.plus-circle'), "Nová položka", self)
        self.add_item_action.setShortcut(QKeySequence("Ctrl+N"))
        self.edit_item_action = QAction(qta.icon('fa5s.edit'), "Upravit položku", self)
        self.edit_item_action.setShortcut(QKeySequence("Ctrl+E"))
        self.locations_action = QAction(qta.icon('fa5s.map-marker-alt'), "Správa lokací", self)
        self.categories_action = QAction(qta.icon('fa5s.sitemap'), "Správa kategorií", self)

        # --- POŽADAVKY ---
        self.create_picking_order_action = QAction(qta.icon('fa5s.file-medical'), "Vytvořit požadavek", self)
        self.create_picking_order_action.setShortcut(QKeySequence("Ctrl+P"))
        self.fulfill_picking_order_action = QAction(qta.icon('fa5s.check-double'), "Zpracovat požadavek", self)
        self.delete_picking_order_action = QAction(qta.icon('fa5s.trash'), "Smazat požadavek", self)

        # --- POHYBY ---
        self.movement_action = QAction(qta.icon('fa5s.dolly-flatbed'), "Příjem / Přesun", self)
        self.movement_action.setShortcut(QKeySequence("Ctrl+M"))
        self.write_off_action = QAction(qta.icon('fa5s.trash-alt'), "Odepsat položku", self)

        # --- NÁSTROJE ---
        self.audit_log_action = QAction(qta.icon('fa5s.history'), "Historie pohybů", self)
        self.audit_log_action.setShortcut(QKeySequence("Ctrl+H"))
        self.import_xls_action = QAction(qta.icon('fa5s.file-upload'), "Import z XLS", self)
        self.export_inventory_action = QAction(qta.icon('fa5s.file-excel'), "Export inventury", self)
        self.refresh_action = QAction(qta.icon('fa5s.sync-alt'), "Obnovit vše", self)
        self.refresh_action.setShortcut(QKeySequence("F5"))

    def _create_menubar(self):
        """Vytvoří strukturované hlavní menu."""
        menu = self.menuBar()
        stock_menu = menu.addMenu("&Sklad")
        stock_menu.addAction(self.automaton_action)
        stock_menu.addSeparator()
        stock_menu.addAction(self.add_item_action)
        stock_menu.addAction(self.edit_item_action)
        stock_menu.addSeparator()
        stock_menu.addAction(self.locations_action)
        stock_menu.addAction(self.categories_action)

        orders_menu = menu.addMenu("&Požadavky")
        orders_menu.addAction(self.create_picking_order_action)
        orders_menu.addAction(self.fulfill_picking_order_action)
        orders_menu.addSeparator()
        orders_menu.addAction(self.delete_picking_order_action)

        move_menu = menu.addMenu("P&ohyby")
        move_menu.addAction(self.movement_action)
        move_menu.addAction(self.write_off_action)

        tools_menu = menu.addMenu("&Nástroje")
        tools_menu.addAction(self.audit_log_action)
        tools_menu.addSeparator()
        tools_menu.addAction(self.import_xls_action)
        tools_menu.addAction(self.export_inventory_action)
        tools_menu.addSeparator()
        tools_menu.addAction(self.refresh_action)

    def _create_toolbar(self):
        """Vytvoří zjednodušený toolbar s popisky."""
        toolbar = QToolBar("Hlavní panel")
        toolbar.setIconSize(QSize(24, 24))
        toolbar.setToolButtonStyle(Qt.ToolButtonStyle.ToolButtonTextBesideIcon)
        self.addToolBar(toolbar)
        toolbar.addAction(self.refresh_action)
        toolbar.addSeparator()
        toolbar.addAction(self.automaton_action)
        toolbar.addSeparator()
        toolbar.addAction(self.add_item_action)
        toolbar.addAction(self.create_picking_order_action)
        toolbar.addSeparator()
        toolbar.addAction(self.movement_action)
        spacer = QWidget(); spacer.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)
        toolbar.addWidget(spacer)
        toolbar.addAction(self.export_inventory_action)

    def _setup_ui(self):
        self.central_widget = QWidget()
        self.setCentralWidget(self.central_widget)
        self.layout = QVBoxLayout(self.central_widget)
        self.tabs = QTabWidget()
        self.inventory_tab = self._create_inventory_tab()
        self.picking_orders_tab = self._create_picking_orders_tab()
        self.tabs.addTab(self.inventory_tab, qta.icon('fa5s.boxes'), "Skladové položky")
        self.tabs.addTab(self.picking_orders_tab, qta.icon('fa5s.clipboard-list'), "Požadavky na materiál")
        self.layout.addWidget(self.tabs)
        self._connect_signals()

    def _create_inventory_tab(self):
        tab = QWidget(); layout = QVBoxLayout(tab)
        fg = QGroupBox("Filtry"); fl = QHBoxLayout(fg)
        fl.addWidget(QLabel("Hledat:")); self.search_input = QLineEdit(); fl.addWidget(self.search_input)
        fl.addWidget(QLabel("Kategorie:")); self.category_filter_combo = QComboBox(); fl.addWidget(self.category_filter_combo)
        fl.addWidget(QLabel("EAN:")); self.ean_search_input = QLineEdit(); fl.addWidget(self.ean_search_input)
        
        splitter = QSplitter(Qt.Orientation.Vertical)
        self.inventory_table = QTableWidget(); self.inventory_table.setColumnCount(7)
        self.inventory_table.setHorizontalHeaderLabels(["ID", "Název", "SKU", "EAN", "Celkem", "Cena", "Kategorie"])
        self.inventory_table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.inventory_table.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self.inventory_table.setAlternatingRowColors(True)
        
        ldg = QGroupBox("Rozpis lokací"); ldl = QVBoxLayout(ldg)
        self.location_detail_table = QTableWidget(); self.location_detail_table.setColumnCount(2)
        self.location_detail_table.setHorizontalHeaderLabels(["Lokace", "Množství"])
        ldl.addWidget(self.location_detail_table)
        
        splitter.addWidget(self.inventory_table); splitter.addWidget(ldg); splitter.setSizes([500, 300])
        layout.addWidget(fg); layout.addWidget(splitter)
        return tab

    def _create_picking_orders_tab(self):
        tab = QWidget(); layout = QVBoxLayout(tab)
        fg = QGroupBox("Stav"); fl = QHBoxLayout(fg)
        self.picking_status_filter = QComboBox()
        self.picking_status_filter.addItem("Vše", "all"); self.picking_status_filter.addItem("Nové", "new")
        fl.addWidget(self.picking_status_filter); fl.addStretch()
        
        splitter = QSplitter(Qt.Orientation.Vertical)
        self.picking_orders_table = QTableWidget(); self.picking_orders_table.setColumnCount(7)
        self.picking_orders_table.setHorizontalHeaderLabels(["ID", "Stav", "Z", "Do", "Uživatel", "Datum", "Poznámka"])
        self.picking_orders_table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        
        dg = QGroupBox("Položky"); dl = QVBoxLayout(dg)
        self.picking_order_detail_table = QTableWidget(); self.picking_order_detail_table.setColumnCount(4)
        dl.addWidget(self.picking_order_detail_table)
        
        splitter.addWidget(self.picking_orders_table); splitter.addWidget(dg); splitter.setSizes([400, 400])
        layout.addWidget(fg); layout.addWidget(splitter)
        return tab

    def _connect_signals(self):
        # Akce v menu a toolbaru
        self.refresh_action.triggered.connect(self.load_initial_data)
        self.automaton_action.triggered.connect(self.open_automaton)
        self.add_item_action.triggered.connect(self.add_new_item)
        self.edit_item_action.triggered.connect(self.edit_selected_item)
        self.locations_action.triggered.connect(self.manage_locations)
        self.categories_action.triggered.connect(self.manage_categories)
        self.create_picking_order_action.triggered.connect(self.open_create_picking_order_dialog)
        self.fulfill_picking_order_action.triggered.connect(self.open_fulfill_picking_order_dialog)
        self.delete_picking_order_action.triggered.connect(self.delete_selected_picking_order)
        self.movement_action.triggered.connect(self.manage_movements)
        self.write_off_action.triggered.connect(self.open_write_off_dialog)
        self.audit_log_action.triggered.connect(self.show_audit_logs)
        self.import_xls_action.triggered.connect(self.import_from_xls)
        self.export_inventory_action.triggered.connect(self.export_inventory_xls)

        # Interakce v tabulce skladu
        self.inventory_table.itemSelectionChanged.connect(self.update_location_details_view)
        self.inventory_table.doubleClicked.connect(self.edit_selected_item) # <--- TENTO ŘÁDEK
        
        # Filtry a hledání
        self.search_input.textChanged.connect(self.filter_inventory_table)
        self.category_filter_combo.currentIndexChanged.connect(self.load_inventory_data)
        self.picking_status_filter.currentIndexChanged.connect(self.load_picking_orders)
        self.picking_orders_table.itemSelectionChanged.connect(self.update_picking_order_detail_view)
        self.ean_search_input.returnPressed.connect(self.process_ean_search)

    # --- METODY PRO NAČÍTÁNÍ A ZOBRAZENÍ ---

    def load_initial_data(self):
        self.load_company_members()
        self.load_categories()
        self.load_locations()
        self.load_inventory_data()
        self.load_picking_orders()

    def load_company_members(self): self.company_members = self.api_client.get_company_members() or []
    def load_locations(self): self.locations = self.api_client.get_locations() or []
    
    def load_categories(self):
        tree = self.api_client.get_categories() or []
        self.categories_flat = []
        def flatten(items, prefix=""):
            for i in items:
                self.categories_flat.append({'id': i['id'], 'name': prefix + i['name']})
                if i.get('children'): flatten(i['children'], prefix + "  ↳ ")
        flatten(tree)
        self.category_filter_combo.blockSignals(True)
        self.category_filter_combo.clear()
        self.category_filter_combo.addItem("Všechny", -1)
        for c in self.categories_flat: self.category_filter_combo.addItem(c['name'], c['id'])
        self.category_filter_combo.blockSignals(False)

    def load_inventory_data(self):
        cat_id = self.category_filter_combo.currentData()
        self.inventory_data = self.api_client.get_inventory_items(category_id=cat_id) or []
        self.inventory_table.setRowCount(0)
        self.inventory_table.setRowCount(len(self.inventory_data))
        for r, item in enumerate(self.inventory_data):
            cats = ", ".join([c['name'] for c in item.get('categories', [])])
            self.inventory_table.setItem(r, 0, QTableWidgetItem(str(item['id'])))
            self.inventory_table.setItem(r, 1, QTableWidgetItem(item['name']))
            self.inventory_table.setItem(r, 2, QTableWidgetItem(item['sku']))
            self.inventory_table.setItem(r, 3, QTableWidgetItem(item.get('ean', '')))
            self.inventory_table.setItem(r, 4, QTableWidgetItem(str(item['total_quantity'])))
            self.inventory_table.setItem(r, 5, QTableWidgetItem(f"{item.get('price', 0):.2f}"))
            self.inventory_table.setItem(r, 6, QTableWidgetItem(cats))
        self.inventory_table.resizeColumnsToContents()

    def update_location_details_view(self):
        self.location_detail_table.setRowCount(0)
        sel = self.inventory_table.selectionModel().selectedRows()
        if not sel: return
        iid = int(self.inventory_table.item(sel[0].row(), 0).text())
        item = next((i for i in self.inventory_data if i['id'] == iid), None)
        if item and 'locations' in item:
            self.location_detail_table.setRowCount(len(item['locations']))
            for r, ls in enumerate(item['locations']):
                self.location_detail_table.setItem(r, 0, QTableWidgetItem(ls['location']['name']))
                self.location_detail_table.setItem(r, 1, QTableWidgetItem(str(ls['quantity'])))

    def load_picking_orders(self):
        status = self.picking_status_filter.currentData()
        self.picking_orders = self.api_client.get_picking_orders(status=status) or []
        self.picking_orders_table.setRowCount(len(self.picking_orders))
        for r, o in enumerate(self.picking_orders):
            self.picking_orders_table.setItem(r, 0, QTableWidgetItem(str(o['id'])))
            self.picking_orders_table.setItem(r, 1, QTableWidgetItem(o['status']))
            self.picking_orders_table.setItem(r, 2, QTableWidgetItem(o.get('source_location', {}).get('name', 'N/A')))
            self.picking_orders_table.setItem(r, 3, QTableWidgetItem(o.get('destination_location', {}).get('name', 'N/A')))
            self.picking_orders_table.setItem(r, 4, QTableWidgetItem(o.get('created_by', {}).get('email', 'N/A')))
            self.picking_orders_table.setItem(r, 5, QTableWidgetItem(o['created_at']))
            self.picking_orders_table.setItem(r, 6, QTableWidgetItem(o.get('notes', '')))

    def update_picking_order_detail_view(self):
        self.picking_order_detail_table.setRowCount(0)
        sel = self.picking_orders_table.selectionModel().selectedRows()
        if not sel: return
        oid = int(self.picking_orders_table.item(sel[0].row(), 0).text())
        order = next((o for o in self.picking_orders if o['id'] == oid), None)
        if order:
            self.picking_order_detail_table.setRowCount(len(order['items']))
            for r, it in enumerate(order['items']):
                name = it['inventory_item']['name'] if it['inventory_item'] else it['requested_item_description']
                self.picking_order_detail_table.setItem(r, 0, QTableWidgetItem(name))
                self.picking_order_detail_table.setItem(r, 1, QTableWidgetItem(it['inventory_item']['sku'] if it['inventory_item'] else ""))
                self.picking_order_detail_table.setItem(r, 2, QTableWidgetItem(str(it['requested_quantity'])))
                self.picking_order_detail_table.setItem(r, 3, QTableWidgetItem(str(it.get('picked_quantity', 0))))

    def filter_inventory_table(self):
        txt = self.search_input.text().lower()
        for r in range(self.inventory_table.rowCount()):
            match = txt in self.inventory_table.item(r, 1).text().lower() or txt in self.inventory_table.item(r, 2).text().lower()
            self.inventory_table.setRowHidden(r, not match)

    def process_ean_search(self):
        ean = self.ean_search_input.text().strip(); self.ean_search_input.clear()
        for r in range(self.inventory_table.rowCount()):
            if self.inventory_table.item(r, 3).text() == ean: self.inventory_table.selectRow(r); return

    # --- CHYBĚJÍCÍ METODY PRO DIALOGY ---

    def add_new_item(self):
        tree = self.api_client.get_categories() or []
        if ItemDialog(self.api_client, tree).exec(): self.load_inventory_data()

    def edit_selected_item(self):
        sel = self.inventory_table.selectionModel().selectedRows()
        if not sel: return
        iid = int(self.inventory_table.item(sel[0].row(), 0).text())
        item = next((i for i in self.inventory_data if i['id'] == iid), None)
        tree = self.api_client.get_categories() or []
        if item and ItemDialog(self.api_client, tree, item_data=item).exec(): self.load_inventory_data()

    def manage_locations(self):
        if LocationDialog(self.api_client, self).exec(): self.load_initial_data()

    def manage_categories(self):
        if CategoryDialog(self.api_client, self).exec(): self.load_categories()

    def manage_movements(self):
        if MovementDialog(self.api_client, self.inventory_data, self.locations, self).exec(): self.load_inventory_data()

    def open_write_off_dialog(self):
        sel = self.inventory_table.selectionModel().selectedRows()
        sid = int(self.inventory_table.item(sel[0].row(), 0).text()) if sel else None
        stock = [i for i in self.inventory_data if i.get('total_quantity', 0) > 0]
        if WriteOffDialog(self.api_client, stock, self, sid).exec(): self.load_inventory_data()

    def show_audit_logs(self): AuditLogDialog(self.api_client, self.inventory_data, self.company_members, self).exec()
    def open_automaton(self): 
        from .automaton_dialog import AutomatonDialog
        AutomatonDialog(self.api_client, self.inventory_data, self.locations, self.categories_flat, self).exec(); self.load_inventory_data()
    
    def open_create_picking_order_dialog(self):
        if PickingOrderCreateDialog(self.api_client, self.inventory_data, self.locations, self).exec(): self.load_picking_orders()

    def open_fulfill_picking_order_dialog(self):
        sel = self.picking_orders_table.selectionModel().selectedRows()
        if not sel: return
        oid = int(self.picking_orders_table.item(sel[0].row(), 0).text())
        order = next((o for o in self.picking_orders if o['id'] == oid), None)
        if order: 
            dlg = PickingOrderFulfillDialog(self.api_client, order, self.inventory_data, self)
            dlg.inventory_updated.connect(self.load_inventory_data)
            if dlg.exec(): self.load_picking_orders()

    def delete_selected_picking_order(self):
        sel = self.picking_orders_table.selectionModel().selectedRows()
        if not sel: return
        oid = int(self.picking_orders_table.item(sel[0].row(), 0).text())
        if QMessageBox.question(self, "Smazat?", f"Smazat požadavek {oid}?", QMessageBox.StandardButton.Yes|QMessageBox.StandardButton.No) == QMessageBox.StandardButton.Yes:
            if self.api_client.delete_picking_order(oid): self.load_picking_orders()

    def import_from_xls(self):
        if ImportDialog(self.api_client, self).exec(): self.load_initial_data()
    
    def export_inventory_xls(self):
        path, _ = QFileDialog.getSaveFileName(self, "Export", "inventura.xlsx", "Excel (*.xlsx)")
        if path: export_inventory_to_xls(self.inventory_data, path)