import sys
import json
import base64
from datetime import datetime

from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, 
    QLabel, QLineEdit, QPushButton, QTabWidget, QTableWidget, 
    QTableWidgetItem, QHeaderView, QMessageBox, QCheckBox, QDialog, 
    QTextEdit, QFormLayout, QDialogButtonBox, QRadioButton, QButtonGroup,
    QDateEdit, QListWidget, QListWidgetItem, QDoubleSpinBox, QAbstractItemView
)
from PyQt6.QtCore import QSettings, Qt, QDate
from PyQt6.QtGui import QTextDocument, QColor, QPalette, QColor
from PyQt6.QtPrintSupport import QPrinter

from config import ORGANIZATION_NAME, APP_NAME
from api import ApiClient

# --- STYLING (Oprava barev pro Windows Dark Mode) ---
def apply_dark_theme(app):
    """Nastaví konzistentní tmavý vzhled, aby se barvy nebily."""
    app.setStyle("Fusion")
    palette = QPalette()
    palette.setColor(QPalette.ColorRole.Window, QColor(53, 53, 53))
    palette.setColor(QPalette.ColorRole.WindowText, Qt.GlobalColor.white)
    palette.setColor(QPalette.ColorRole.Base, QColor(25, 25, 25))
    palette.setColor(QPalette.ColorRole.AlternateBase, QColor(53, 53, 53))
    palette.setColor(QPalette.ColorRole.ToolTipBase, Qt.GlobalColor.black)
    palette.setColor(QPalette.ColorRole.ToolTipText, Qt.GlobalColor.white)
    palette.setColor(QPalette.ColorRole.Text, Qt.GlobalColor.white)
    palette.setColor(QPalette.ColorRole.Button, QColor(53, 53, 53))
    palette.setColor(QPalette.ColorRole.ButtonText, Qt.GlobalColor.white)
    palette.setColor(QPalette.ColorRole.BrightText, Qt.GlobalColor.red)
    palette.setColor(QPalette.ColorRole.Link, QColor(42, 130, 218))
    palette.setColor(QPalette.ColorRole.Highlight, QColor(42, 130, 218))
    palette.setColor(QPalette.ColorRole.HighlightedText, Qt.GlobalColor.black)
    app.setPalette(palette)
    
    # CSS pro specifické widgety, aby byly čitelné
    app.setStyleSheet("""
        QToolTip { color: #ffffff; background-color: #2a82da; border: 1px solid white; }
        QLineEdit, QDateEdit, QDoubleSpinBox { 
            background-color: #ffffff; 
            color: #000000; 
            border: 1px solid #555;
            padding: 4px;
        }
        QTableWidget { gridline-color: #555555; }
        QHeaderView::section { background-color: #353535; color: white; border: 1px solid #555; }
        QListWidget { background-color: #252525; color: white; }
        QLabel { color: white; }
        QPushButton { 
            background-color: #0275d8; 
            color: white; 
            border-radius: 4px; 
            padding: 6px; 
        }
        QPushButton:hover { background-color: #025aa5; }
        QPushButton:disabled { background-color: #555; color: #aaa; }
    """)

# --- POMOCNÉ TŘÍDY ---

class GenericFormDialog(QDialog):
    def __init__(self, parent, title, fields, data=None):
        super().__init__(parent)
        self.setWindowTitle(title)
        self.resize(400, 200)
        self.inputs = {}
        self.data = data or {}
        
        layout = QFormLayout(self)
        
        for label, key in fields.items():
            inp = QLineEdit()
            # Pokud máme data, předvyplníme
            if self.data and key in self.data:
                inp.setText(str(self.data[key]))
                
            layout.addRow(label, inp)
            self.inputs[key] = inp
            
        buttons = QDialogButtonBox(QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel)
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        layout.addRow(buttons)

    def get_data(self):
        out = {}
        for key, inp in self.inputs.items():
            val = inp.text().strip()
            # Základní konverze pro čísla
            if key in ['price', 'margin_percentage']:
                try:
                    val = float(val)
                except ValueError:
                    val = 0.0
            out[key] = val
        return out

# --- FAKTURAČNÍ WIZARD ---

class InvoiceConfigDialog(QDialog):
    """Krok 1: Výběr rozsahu"""
    def __init__(self, parent, api, work_order_id):
        super().__init__(parent)
        self.setWindowTitle("Konfigurace faktury")
        self.resize(500, 300)
        self.api = api
        self.work_order_id = work_order_id
        
        layout = QVBoxLayout(self)
        layout.addWidget(QLabel("<h3>Rozsah fakturace</h3>"))
        
        # Radio buttons
        self.rb_all = QRadioButton("Celá zakázka")
        self.rb_period = QRadioButton("Dle období")
        self.rb_tasks = QRadioButton("Dle úkolů")
        self.rb_all.setChecked(True)
        
        self.bg = QButtonGroup()
        self.bg.addButton(self.rb_all)
        self.bg.addButton(self.rb_period)
        self.bg.addButton(self.rb_tasks)
        
        layout.addWidget(self.rb_all)
        layout.addWidget(self.rb_period)
        
        # Období
        self.period_widget = QWidget()
        pl = QHBoxLayout(self.period_widget)
        self.date_from = QDateEdit(QDate.currentDate().addDays(-30))
        self.date_to = QDateEdit(QDate.currentDate())
        self.date_from.setCalendarPopup(True)
        self.date_to.setCalendarPopup(True)
        pl.addWidget(QLabel("Od:"))
        pl.addWidget(self.date_from)
        pl.addWidget(QLabel("Do:"))
        pl.addWidget(self.date_to)
        layout.addWidget(self.period_widget)
        
        layout.addWidget(self.rb_tasks)
        
        # Úkoly
        self.tasks_widget = QWidget()
        tl = QVBoxLayout(self.tasks_widget)
        self.task_list = QListWidget()
        tl.addWidget(self.task_list)
        layout.addWidget(self.tasks_widget)
        
        # Eventy
        self.bg.buttonClicked.connect(self.on_mode_change)
        self.on_mode_change() # Init stav
        
        # Tlačítka
        btn_layout = QHBoxLayout()
        btn_ok = QPushButton("Vygenerovat náhled")
        btn_ok.setStyleSheet("background-color: #d9534f; font-weight: bold;")
        btn_cancel = QPushButton("Zrušit")
        
        btn_ok.clicked.connect(self.accept)
        btn_cancel.clicked.connect(self.reject)
        
        btn_layout.addStretch()
        btn_layout.addWidget(btn_cancel)
        btn_layout.addWidget(btn_ok)
        layout.addLayout(btn_layout)

    def on_mode_change(self):
        self.period_widget.setVisible(self.rb_period.isChecked())
        self.tasks_widget.setVisible(self.rb_tasks.isChecked())
        if self.rb_tasks.isChecked() and self.task_list.count() == 0:
            self.load_tasks()

    def load_tasks(self):
        try:
            tasks = self.api.get_tasks(self.work_order_id)
            self.task_list.clear()
            for t in tasks:
                item = QListWidgetItem(t['name'])
                item.setFlags(item.flags() | Qt.ItemFlag.ItemIsUserCheckable)
                item.setCheckState(Qt.CheckState.Unchecked)
                item.setData(Qt.ItemDataRole.UserRole, t['id'])
                self.task_list.addItem(item)
        except Exception as e:
            QMessageBox.warning(self, "Chyba", f"Nepodařilo se načíst úkoly: {e}")

    def get_config(self):
        cfg = {"mode": "all", "start_date": None, "end_date": None, "task_ids": []}
        if self.rb_period.isChecked():
            cfg["mode"] = "period"
            cfg["start_date"] = self.date_from.date().toString("yyyy-MM-dd")
            cfg["end_date"] = self.date_to.date().toString("yyyy-MM-dd")
        elif self.rb_tasks.isChecked():
            cfg["mode"] = "tasks"
            for i in range(self.task_list.count()):
                item = self.task_list.item(i)
                if item.checkState() == Qt.CheckState.Checked:
                    cfg["task_ids"].append(item.data(Qt.ItemDataRole.UserRole))
        return cfg

class InvoiceEditorDialog(QDialog):
    """Krok 2: Editor faktury"""
    def __init__(self, parent, report_data, config, api, work_order_id):
        super().__init__(parent)
        self.setWindowTitle(f"Faktura: {report_data.get('work_order_name', '')}")
        self.resize(1000, 750)
        self.report_data = report_data
        self.api = api
        self.work_order_id = work_order_id
        
        layout = QVBoxLayout(self)
        
        # Horní lišta
        top_bar = QHBoxLayout()
        top_bar.addWidget(QLabel(f"<h2>{report_data.get('work_order_name')}</h2>"))
        top_bar.addStretch()
        
        self.btn_mark = QPushButton("Označit jako fakturované")
        self.btn_mark.setStyleSheet("background-color: #5cb85c;")
        self.btn_mark.clicked.connect(self.mark_as_billed)
        
        self.btn_print = QPushButton("Tisk / PDF")
        self.btn_print.clicked.connect(self.print_pdf)
        
        top_bar.addWidget(self.btn_mark)
        top_bar.addWidget(self.btn_print)
        layout.addLayout(top_bar)
        
        # Tabulky
        layout.addWidget(QLabel("<b>PRÁCE</b>"))
        self.table_work = QTableWidget()
        self.init_table(self.table_work, ["Popis", "Hodiny", "Sazba/hod (Edit)", "Celkem"])
        layout.addWidget(self.table_work)
        
        layout.addWidget(QLabel("<b>MATERIÁL</b>"))
        self.table_mat = QTableWidget()
        self.init_table(self.table_mat, ["Položka", "Množství", "Cena/ks (Edit)", "Celkem"])
        layout.addWidget(self.table_mat)
        
        # Globální úpravy (žlutý box)
        adj_widget = QWidget()
        # CSS nastaví černý text uvnitř žlutého boxu, aby byl čitelný
        adj_widget.setStyleSheet("""
            background-color: #fff3cd; 
            border-radius: 5px; 
            padding: 10px; 
            color: black;
        """)
        adj_layout = QHBoxLayout(adj_widget)
        
        lbl_adj = QLabel("Globální úprava ceny (Sleva / Přirážka):")
        lbl_adj.setStyleSheet("color: black; font-weight: bold;") # Vynutit černou barvu písma
        
        self.spin_adj = QDoubleSpinBox()
        self.spin_adj.setRange(-100, 1000)
        self.spin_adj.setSuffix(" %")
        self.spin_adj.valueChanged.connect(self.recalculate)
        
        adj_layout.addWidget(lbl_adj)
        adj_layout.addWidget(self.spin_adj)
        adj_layout.addStretch()
        layout.addWidget(adj_widget)
        
        # Součty
        self.lbl_total = QLabel("<h1>Celkem k úhradě: 0 Kč</h1>")
        self.lbl_total.setAlignment(Qt.AlignmentFlag.AlignRight)
        layout.addWidget(self.lbl_total)
        
        # Naplnění dat
        self.populate_tables()
        self.recalculate()
        
        # Připojení signálů změny po naplnění dat
        self.table_work.itemChanged.connect(self.on_item_changed)
        self.table_mat.itemChanged.connect(self.on_item_changed)

    def init_table(self, table, headers):
        table.setColumnCount(len(headers))
        table.setHorizontalHeaderLabels(headers)
        table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        # Nastavení stylu pro editovatelné buňky (bílé pozadí, černý text)
        table.setStyleSheet("""
            QTableWidget { background-color: #252525; color: white; gridline-color: #555; }
            QTableWidget::item:selected { background-color: #2a82da; }
        """)

    def populate_tables(self):
        # Práce
        logs = self.report_data.get("time_logs", [])
        self.table_work.setRowCount(len(logs))
        for i, log in enumerate(logs):
            self.set_item(self.table_work, i, 0, f"{log['task_name']}", editable=False)
            self.set_item(self.table_work, i, 1, str(log['hours']), editable=False)
            self.set_item(self.table_work, i, 2, str(log['rate']), editable=True) # Sazba
            self.set_item(self.table_work, i, 3, str(log['total_price']), editable=False)

        # Materiál
        items = self.report_data.get("used_items", [])
        self.table_mat.setRowCount(len(items))
        for i, item in enumerate(items):
            self.set_item(self.table_mat, i, 0, f"{item['item_name']}", editable=False)
            self.set_item(self.table_mat, i, 1, str(item['quantity']), editable=False)
            self.set_item(self.table_mat, i, 2, str(item['unit_price_sold']), editable=True) # Cena/ks
            self.set_item(self.table_mat, i, 3, str(item['total_price']), editable=False)

    def set_item(self, table, row, col, text, editable=False):
        item = QTableWidgetItem(text)
        if not editable:
            item.setFlags(item.flags() ^ Qt.ItemFlag.ItemIsEditable)
            item.setForeground(QColor("#cccccc")) # Šedivější pro read-only
        else:
            # Editovatelné buňky - výrazné
            item.setBackground(QColor("#ffffff"))
            item.setForeground(QColor("#000000"))
            item.setFont(QFont("Arial", 10, QFont.Weight.Bold))
        
        table.setItem(row, col, item)

    def on_item_changed(self, item):
        # Ochrana proti rekurzi (změna -> přepočet -> změna buňky 'Celkem' -> loop)
        table = item.tableWidget()
        if item.column() != 2: # Reagujeme jen na změnu ceny/sazby
            return
            
        row = item.row()
        try:
            val_per_unit = float(item.text().replace(",", "."))
            qty = float(table.item(row, 1).text())
            new_total = round(val_per_unit * qty, 2)
            
            # Dočasně vypnout signály, abychom mohli zapsat do tabulky bez vyvolání loopu
            table.blockSignals(True)
            table.item(row, 3).setText(str(new_total))
            table.blockSignals(False)
            
            self.recalculate()
        except ValueError:
            pass # Ignorovat nečísla

    def recalculate(self):
        total = 0.0
        # Práce
        for i in range(self.table_work.rowCount()):
            try: total += float(self.table_work.item(i, 3).text())
            except: pass
        
        # Materiál
        for i in range(self.table_mat.rowCount()):
            try: total += float(self.table_mat.item(i, 3).text())
            except: pass
            
        # Globální úprava
        adj = self.spin_adj.value()
        grand_total = total * (1 + adj / 100.0)
        
        self.lbl_total.setText(f"<h1>Celkem k úhradě: {grand_total:.2f} Kč</h1>")

    def mark_as_billed(self):
        try:
            self.api.update_work_order_status(self.work_order_id, "billed")
            QMessageBox.information(self, "OK", "Označeno jako fakturované.")
            self.btn_mark.setEnabled(False)
        except Exception as e:
            QMessageBox.critical(self, "Chyba", str(e))

    def print_pdf(self):
        # Jednoduché HTML pro tisk
        html = f"""
        <h1>Faktura</h1>
        <h2>{self.report_data.get('work_order_name')}</h2>
        <hr>
        <table width="100%" border="1" cellspacing="0" cellpadding="4">
            <tr><th>Popis</th><th>Množství</th><th>Cena/mj</th><th>Celkem</th></tr>
        """
        # Práce do HTML
        html += "<tr><td colspan='4'><b>PRÁCE</b></td></tr>"
        for i in range(self.table_work.rowCount()):
            html += f"<tr><td>{self.table_work.item(i,0).text()}</td><td>{self.table_work.item(i,1).text()}</td><td>{self.table_work.item(i,2).text()}</td><td>{self.table_work.item(i,3).text()}</td></tr>"
        
        # Materiál do HTML
        html += "<tr><td colspan='4'><b>MATERIÁL</b></td></tr>"
        for i in range(self.table_mat.rowCount()):
            html += f"<tr><td>{self.table_mat.item(i,0).text()}</td><td>{self.table_mat.item(i,1).text()}</td><td>{self.table_mat.item(i,2).text()}</td><td>{self.table_mat.item(i,3).text()}</td></tr>"
            
        html += f"""
        </table>
        <br>
        <h3 align="right">Úprava ceny: {self.spin_adj.value()} %</h3>
        <h1 align="right">{self.lbl_total.text()}</h1>
        """
        
        from PyQt6.QtWidgets import QFileDialog
        fn, _ = QFileDialog.getSaveFileName(self, "Uložit PDF", "faktura.pdf", "PDF (*.pdf)")
        if fn:
            doc = QTextDocument()
            doc.setHtml(html)
            printer = QPrinter()
            printer.setOutputFormat(QPrinter.OutputFormat.PdfFormat)
            printer.setOutputFileName(fn)
            doc.print(printer)
            QMessageBox.information(self, "Hotovo", "Uloženo.")

# --- LOGIN & MAIN WINDOW ---

class LoginWindow(QWidget):
    def __init__(self, api_client, on_success):
        super().__init__()
        self.api = api_client
        self.on_success = on_success
        self.settings = QSettings(ORGANIZATION_NAME, APP_NAME)
        self.init_ui()

    def init_ui(self):
        self.setWindowTitle("Login")
        self.setGeometry(400, 300, 300, 200)
        layout = QVBoxLayout(self)
        
        self.email = QLineEdit()
        self.email.setPlaceholderText("Email")
        self.pwd = QLineEdit()
        self.pwd.setPlaceholderText("Heslo")
        self.pwd.setEchoMode(QLineEdit.EchoMode.Password)
        self.chk = QCheckBox("Pamatovat si mě")
        
        btn = QPushButton("Přihlásit")
        btn.clicked.connect(self.do_login)
        
        layout.addWidget(QLabel("<h2>Přihlášení</h2>"))
        layout.addWidget(self.email)
        layout.addWidget(self.pwd)
        layout.addWidget(self.chk)
        layout.addWidget(btn)
        
        if self.settings.value("email"):
            self.email.setText(self.settings.value("email"))
            self.chk.setChecked(True)
        if self.settings.value("password"):
            self.pwd.setText(self.settings.value("password"))

    def do_login(self):
        email = self.email.text()
        pwd = self.pwd.text()
        data = self.api.login(email, pwd)
        if data:
            self.api.set_token(data['access_token'])
            # Dekódování JWT pro CompanyID
            try:
                # Jednoduchý padding fix a decode
                part = data['access_token'].split('.')[1]
                part += '=' * (-len(part) % 4)
                payload = json.loads(base64.urlsafe_b64decode(part))
                
                # Získání company_id (předpokládáme pole tenants)
                tenants = payload.get('tenants', [])
                if tenants:
                    self.api.set_company_id(tenants[0])
                else:
                    raise Exception("Žádná firma přiřazena uživateli")
                    
                if self.chk.isChecked():
                    self.settings.setValue("email", email)
                    self.settings.setValue("password", pwd)
                else:
                    self.settings.clear()
                    
                self.on_success()
            except Exception as e:
                QMessageBox.critical(self, "Chyba", f"Chyba tokenu: {e}")
        else:
            QMessageBox.warning(self, "Chyba", "Špatné údaje")

class MainWindow(QMainWindow):
    def __init__(self, api):
        super().__init__()
        self.api = api
        self.setWindowTitle("Účetní Systém")
        self.resize(1100, 700)
        
        cw = QWidget()
        self.setCentralWidget(cw)
        layout = QVBoxLayout(cw)
        
        tabs = QTabWidget()
        layout.addWidget(tabs)
        
        # 1. Zákazníci
        self.tab_clients = QWidget()
        self.setup_clients(self.tab_clients)
        tabs.addTab(self.tab_clients, "Zákazníci")
        
        # 2. Sklad
        self.tab_inv = QWidget()
        self.setup_inventory(self.tab_inv)
        tabs.addTab(self.tab_inv, "Sklad")
        
        # 3. Zakázky
        self.tab_wo = QWidget()
        self.setup_wo(self.tab_wo)
        tabs.addTab(self.tab_wo, "Zakázky")

    # --- ZÁKAZNÍCI ---
    def setup_clients(self, tab):
        l = QVBoxLayout(tab)
        h = QHBoxLayout()
        btn_add = QPushButton("Přidat")
        btn_ref = QPushButton("Obnovit")
        h.addWidget(btn_add)
        h.addWidget(btn_ref)
        h.addStretch()
        l.addLayout(h)
        
        self.tbl_clients = QTableWidget()
        self.tbl_clients.setColumnCount(4)
        self.tbl_clients.setHorizontalHeaderLabels(["ID", "Jméno", "Email", "IČO"])
        self.tbl_clients.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        self.tbl_clients.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        l.addWidget(self.tbl_clients)
        
        btn_ref.clicked.connect(self.load_clients)
        btn_add.clicked.connect(self.add_client)
        self.tbl_clients.doubleClicked.connect(self.edit_client)
        self.load_clients()

    def load_clients(self):
        data = self.api.get_clients()
        self.tbl_clients.setRowCount(len(data))
        for i, c in enumerate(data):
            self.tbl_clients.setItem(i, 0, QTableWidgetItem(str(c['id'])))
            self.tbl_clients.setItem(i, 1, QTableWidgetItem(c['name']))
            self.tbl_clients.setItem(i, 2, QTableWidgetItem(c.get('email', '')))
            self.tbl_clients.setItem(i, 3, QTableWidgetItem(c.get('ico', '')))

    def add_client(self):
        dlg = GenericFormDialog(self, "Nový klient", {"Jméno": "name", "Email": "email", "IČO": "ico"})
        if dlg.exec():
            try:
                self.api.create_client(dlg.get_data())
                self.load_clients()
            except Exception as e: QMessageBox.critical(self, "Chyba", str(e))

    def edit_client(self):
        # OPRAVENO: Nyní se načtou data z API
        row = self.tbl_clients.currentRow()
        if row < 0: return
        cid = self.tbl_clients.item(row, 0).text()
        
        client_data = self.api.get_client(cid)
        if not client_data:
            QMessageBox.critical(self, "Chyba", "Nepodařilo se načíst detail klienta.")
            return

        # Mapování klíčů (API vrací 'name', 'email', formulář chce 'Jméno' atd.)
        fields = {"Jméno": "name", "Email": "email", "IČO": "ico", "Adresa": "address"}
        dlg = GenericFormDialog(self, "Editace klienta", fields, data=client_data)
        
        if dlg.exec():
            try:
                self.api.update_client(cid, dlg.get_data())
                self.load_clients()
            except Exception as e: QMessageBox.critical(self, "Chyba", str(e))

    # --- SKLAD ---
    def setup_inventory(self, tab):
        l = QVBoxLayout(tab)
        h = QHBoxLayout()
        btn_add = QPushButton("Nová položka")
        btn_ref = QPushButton("Obnovit")
        h.addWidget(btn_add)
        h.addWidget(btn_ref)
        h.addStretch()
        l.addLayout(h)
        
        self.tbl_inv = QTableWidget()
        self.tbl_inv.setColumnCount(4)
        self.tbl_inv.setHorizontalHeaderLabels(["ID", "Název", "SKU", "Cena"])
        self.tbl_inv.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        l.addWidget(self.tbl_inv)
        
        btn_ref.clicked.connect(self.load_inv)
        btn_add.clicked.connect(self.add_inv)
        self.load_inv()

    def load_inv(self):
        data = self.api.get_inventory()
        self.tbl_inv.setRowCount(len(data))
        for i, it in enumerate(data):
            self.tbl_inv.setItem(i, 0, QTableWidgetItem(str(it['id'])))
            self.tbl_inv.setItem(i, 1, QTableWidgetItem(it['name']))
            self.tbl_inv.setItem(i, 2, QTableWidgetItem(it['sku']))
            self.tbl_inv.setItem(i, 3, QTableWidgetItem(str(it.get('price', 0))))

    def add_inv(self):
        dlg = GenericFormDialog(self, "Zboží", {"Název": "name", "SKU": "sku", "Cena": "price"})
        if dlg.exec():
            try:
                self.api.create_item(dlg.get_data())
                self.load_inv()
            except Exception as e: QMessageBox.critical(self, "Chyba", str(e))

    # --- ZAKÁZKY ---
    def setup_wo(self, tab):
        l = QVBoxLayout(tab)
        h = QHBoxLayout()
        btn_ref = QPushButton("Obnovit")
        h.addWidget(btn_ref)
        h.addStretch()
        l.addLayout(h)
        
        self.tbl_wo = QTableWidget()
        self.tbl_wo.setColumnCount(5)
        self.tbl_wo.setHorizontalHeaderLabels(["ID", "Název", "Klient", "Status", "Akce"])
        self.tbl_wo.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        l.addWidget(self.tbl_wo)
        
        btn_ref.clicked.connect(self.load_wo)
        self.load_wo()

    def load_wo(self):
        data = self.api.get_work_orders()
        self.tbl_wo.setRowCount(len(data))
        for i, wo in enumerate(data):
            self.tbl_wo.setItem(i, 0, QTableWidgetItem(str(wo['id'])))
            self.tbl_wo.setItem(i, 1, QTableWidgetItem(wo['name']))
            cname = wo['client']['name'] if wo.get('client') else ""
            self.tbl_wo.setItem(i, 2, QTableWidgetItem(cname))
            self.tbl_wo.setItem(i, 3, QTableWidgetItem(wo['status']))
            
            btn = QPushButton("Fakturovat")
            btn.clicked.connect(lambda ch, wid=wo['id']: self.open_invoice(wid))
            self.tbl_wo.setCellWidget(i, 4, btn)

    def open_invoice(self, wid):
        dlg = InvoiceConfigDialog(self, self.api, wid)
        if dlg.exec():
            cfg = dlg.get_config()
            try:
                report = self.api.get_billing_report(wid, cfg['start_date'], cfg['end_date'])
                dlg_edit = InvoiceEditorDialog(self, report, cfg, self.api, wid)
                dlg_edit.exec()
                self.load_wo()
            except Exception as e:
                QMessageBox.critical(self, "Chyba", f"Chyba při generování: {e}")

if __name__ == "__main__":
    app = QApplication(sys.argv)
    apply_dark_theme(app) # APLIKOVÁNÍ STYLU
    
    api = ApiClient()
    
    def on_login():
        login.close()
        main = MainWindow(api)
        main.show()
        app._main = main
        
    login = LoginWindow(api, on_login)
    login.show()
    sys.exit(app.exec())