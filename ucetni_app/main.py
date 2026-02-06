import sys
import json
import base64
from datetime import datetime

from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, 
    QLabel, QLineEdit, QPushButton, QTabWidget, QTableWidget, 
    QTableWidgetItem, QHeaderView, QMessageBox, QCheckBox, QDialog, 
    QTextEdit, QFormLayout, QDialogButtonBox, QRadioButton, QButtonGroup,
    QDateEdit, QListWidget, QListWidgetItem, QDoubleSpinBox, QAbstractItemView,
    QGroupBox, QComboBox, QScrollArea, QFrame
)
from PyQt6.QtCore import QSettings, Qt, QDate
from PyQt6.QtGui import QTextDocument, QColor, QPalette, QFont, QIcon
from PyQt6.QtPrintSupport import QPrinter

from config import ORGANIZATION_NAME, APP_NAME
from api import ApiClient

# --- STYLING ---
def apply_dark_theme(app):
    """Nastaví konzistentní tmavý vzhled."""
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
    
    app.setStyleSheet("""
        QToolTip { color: #ffffff; background-color: #2a82da; border: 1px solid white; }
        QLineEdit, QDateEdit, QDoubleSpinBox, QComboBox { 
            background-color: #ffffff; 
            color: #000000; 
            border: 1px solid #555;
            padding: 4px;
            border-radius: 3px;
        }
        QTableWidget { gridline-color: #555555; }
        QHeaderView::section { background-color: #353535; color: white; border: 1px solid #555; }
        QListWidget { background-color: #252525; color: white; }
        QLabel { color: white; }
        QGroupBox { 
            border: 1px solid #555; 
            margin-top: 20px; 
            font-weight: bold; 
            color: white; 
        }
        QGroupBox::title { subcontrol-origin: margin; subcontrol-position: top left; padding: 0 3px; }
        QPushButton { 
            background-color: #0275d8; 
            color: white; 
            border-radius: 4px; 
            padding: 6px; 
        }
        QPushButton:hover { background-color: #025aa5; }
        QPushButton:disabled { background-color: #555; color: #aaa; }
        
        /* Červené tlačítko pro smazání */
        QPushButton.btn-danger { background-color: #d9534f; }
        QPushButton.btn-danger:hover { background-color: #c9302c; }
        
        /* Zelené tlačítko */
        QPushButton.btn-success { background-color: #5cb85c; }
        QPushButton.btn-success:hover { background-color: #449d44; }
    """)

# --- HELPERS ---

def flatten_categories(categories, prefix=""):
    """Převede strom kategorií na plochý seznam pro ComboBox"""
    flat = []
    for cat in categories:
        name = f"{prefix}{cat['name']}"
        flat.append((cat['id'], name))
        if cat.get('children'):
            flat.extend(flatten_categories(cat['children'], prefix=f"{name} > "))
    return flat

class GenericFormDialog(QDialog):
    """Jednoduchý dialog pro rychlé vytvoření (např. nové zboží)"""
    def __init__(self, parent, title, fields, data=None):
        super().__init__(parent)
        self.setWindowTitle(title)
        self.resize(400, 200)
        self.inputs = {}
        self.data = data or {}
        layout = QFormLayout(self)
        for label, key in fields.items():
            inp = QLineEdit()
            if self.data and key in self.data: inp.setText(str(self.data[key]))
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
            if key in ['price', 'margin_percentage']:
                try: val = float(val)
                except: val = 0.0
            out[key] = val
        return out

# --- POKROČILÝ EDITOR KLIENTA ---

class ClientEditorDialog(QDialog):
    def __init__(self, parent, api, client_id, client_data):
        super().__init__(parent)
        self.api = api
        self.client_id = client_id
        self.client_data = client_data or {}
        self.setWindowTitle("Upravit zákazníka")
        self.resize(700, 800)
        
        # Hlavní layout
        main_layout = QVBoxLayout(self)
        
        # Scroll Area, kdyby bylo okno malé
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        content_widget = QWidget()
        self.layout = QVBoxLayout(content_widget)
        scroll.setWidget(content_widget)
        main_layout.addWidget(scroll)

        # 1. SEKCE: ZÁKLADNÍ ÚDAJE
        gb_basic = QGroupBox("Základní údaje")
        gb_layout = QVBoxLayout(gb_basic)
        
        self.inputs = {}
        
        # Helper pro řádek s inputem
        def add_input(label, key, val=None):
            lbl = QLabel(label)
            inp = QLineEdit()
            if val is not None: inp.setText(str(val))
            gb_layout.addWidget(lbl)
            gb_layout.addWidget(inp)
            self.inputs[key] = inp
            return inp

        # Řádky formuláře
        add_input("Jméno / Název firmy", "name", self.client_data.get("name"))
        add_input("Oficiální název (pokud se liší)", "legal_name", self.client_data.get("legal_name", ""))
        add_input("Adresa", "address", self.client_data.get("address", ""))
        
        # Dva sloupce pro kontakt
        row_contact = QHBoxLayout()
        v1 = QVBoxLayout(); v1.addWidget(QLabel("Kontaktní osoba")); 
        inp_cp = QLineEdit(self.client_data.get("contact_person", "")); v1.addWidget(inp_cp); row_contact.addLayout(v1)
        self.inputs["contact_person"] = inp_cp
        
        v2 = QVBoxLayout(); v2.addWidget(QLabel("Telefon")); 
        inp_ph = QLineEdit(self.client_data.get("phone", "")); v2.addWidget(inp_ph); row_contact.addLayout(v2)
        self.inputs["phone"] = inp_ph
        gb_layout.addLayout(row_contact)

        # Email a Marže
        row_mail = QHBoxLayout()
        v3 = QVBoxLayout(); v3.addWidget(QLabel("Email")); 
        inp_em = QLineEdit(self.client_data.get("email", "")); v3.addWidget(inp_em); row_mail.addLayout(v3)
        self.inputs["email"] = inp_em
        
        v4 = QVBoxLayout(); v4.addWidget(QLabel("Výchozí marže (%)")); 
        inp_mar = QDoubleSpinBox(); inp_mar.setRange(0, 1000); 
        inp_mar.setValue(float(self.client_data.get("margin_percentage") or 0))
        v4.addWidget(inp_mar); row_mail.addLayout(v4)
        self.inputs["margin_percentage"] = inp_mar
        gb_layout.addLayout(row_mail)
        
        # ICO / DIC
        row_ids = QHBoxLayout()
        v5 = QVBoxLayout(); v5.addWidget(QLabel("IČO")); 
        inp_ico = QLineEdit(self.client_data.get("ico", "")); v5.addWidget(inp_ico); row_ids.addLayout(v5)
        self.inputs["ico"] = inp_ico
        
        v6 = QVBoxLayout(); v6.addWidget(QLabel("DIČ")); 
        inp_dic = QLineEdit(self.client_data.get("dic", "")); v6.addWidget(inp_dic); row_ids.addLayout(v6)
        self.inputs["dic"] = inp_dic
        gb_layout.addLayout(row_ids)
        
        self.layout.addWidget(gb_basic)

        # 2. SEKCE: SPECIFICKÉ MARŽE
        gb_margins = QGroupBox("Specifické marže podle kategorií")
        margins_layout = QVBoxLayout(gb_margins)
        
        # Přidávací řádek
        add_box = QFrame()
        add_box.setStyleSheet("background-color: #3a3a3a; border-radius: 5px; padding: 5px;")
        add_layout = QHBoxLayout(add_box)
        
        self.cat_combo = QComboBox()
        self.load_categories_to_combo() # Naplnit kategorie
        
        self.margin_spin = QDoubleSpinBox()
        self.margin_spin.setRange(0, 1000)
        self.margin_spin.setSuffix(" %")
        self.margin_spin.setPlaceholderText("Marže %")
        
        btn_add_margin = QPushButton("+ Přidat")
        btn_add_margin.clicked.connect(self.add_specific_margin)
        
        add_layout.addWidget(QLabel("Přidat výjimku:"))
        add_layout.addWidget(self.cat_combo, 2)
        add_layout.addWidget(self.margin_spin, 1)
        add_layout.addWidget(btn_add_margin)
        margins_layout.addWidget(add_box)
        
        # Tabulka marží
        self.margin_table = QTableWidget()
        self.margin_table.setColumnCount(3)
        self.margin_table.setHorizontalHeaderLabels(["Kategorie", "Marže", "Akce"])
        self.margin_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        self.margin_table.setStyleSheet("QTableWidget { background-color: #ffffff; color: black; }") 
        # Zde dáváme bílé pozadí pro tabulku marží, aby vypadala jako "input list"
        
        margins_layout.addWidget(self.margin_table)
        self.layout.addWidget(gb_margins)
        
        # Načíst existující marže
        self.load_margins()

        # TLAČÍTKA DOLE
        btn_layout = QHBoxLayout()
        btn_cancel = QPushButton("Zrušit")
        btn_save = QPushButton("Uložit zákazníka")
        btn_save.setProperty("class", "btn-success") # Pro styling (volitelné)
        btn_save.setStyleSheet("background-color: #d9534f; font-weight: bold; padding: 8px;") # Červené jako na screenu
        
        btn_cancel.clicked.connect(self.reject)
        btn_save.clicked.connect(self.save_client)
        
        btn_layout.addStretch()
        btn_layout.addWidget(btn_cancel)
        btn_layout.addWidget(btn_save)
        main_layout.addLayout(btn_layout)

    def load_categories_to_combo(self):
        cats_tree = self.api.get_categories()
        flat_cats = flatten_categories(cats_tree)
        self.cat_combo.clear()
        self.cat_combo.addItem("-- Vyberte kategorii --", None)
        for cat_id, name in flat_cats:
            self.cat_combo.addItem(name, cat_id)

    def load_margins(self):
        margins = self.api.get_client_margins(self.client_id)
        self.margin_table.setRowCount(0)
        self.margin_table.setRowCount(len(margins))
        
        for i, m in enumerate(margins):
            # Kategorie
            self.margin_table.setItem(i, 0, QTableWidgetItem(m['category_name']))
            # Marže
            item_marg = QTableWidgetItem(f"{m['margin_percentage']} %")
            item_marg.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            self.margin_table.setItem(i, 1, item_marg)
            
            # Tlačítko smazat
            btn_del = QPushButton("Smazat")
            btn_del.setProperty("class", "btn-danger")
            btn_del.setStyleSheet("color: red; border: none; font-weight: bold;")
            btn_del.setCursor(Qt.CursorShape.PointingHandCursor)
            # Uložíme si ID kategorie pro mazání
            btn_del.clicked.connect(lambda _, cat_id=m['category_id']: self.delete_margin(cat_id))
            self.margin_table.setCellWidget(i, 2, btn_del)

    def add_specific_margin(self):
        cat_id = self.cat_combo.currentData()
        if not cat_id:
            QMessageBox.warning(self, "Chyba", "Vyberte kategorii")
            return
        
        margin = self.margin_spin.value()
        try:
            self.api.set_client_margin(self.client_id, cat_id, margin)
            self.load_margins() # Refresh tabulky
            self.margin_spin.setValue(0)
        except Exception as e:
            QMessageBox.critical(self, "Chyba", str(e))

    def delete_margin(self, category_id):
        if QMessageBox.question(self, "Smazat", "Opravdu smazat tuto marži?") == QMessageBox.StandardButton.Yes:
            try:
                self.api.delete_client_margin(self.client_id, category_id)
                self.load_margins()
            except Exception as e:
                QMessageBox.critical(self, "Chyba", str(e))

    def save_client(self):
        # Sbírání dat z formuláře
        data = {}
        for key, inp in self.inputs.items():
            if isinstance(inp, QLineEdit):
                data[key] = inp.text().strip()
            elif isinstance(inp, QDoubleSpinBox):
                data[key] = inp.value()
        
        try:
            self.api.update_client(self.client_id, data)
            self.accept()
        except Exception as e:
            QMessageBox.critical(self, "Chyba při ukládání", str(e))


# --- FAKTURAČNÍ DIALOGY (WIZARD) ---

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
        
        self.bg.buttonClicked.connect(self.on_mode_change)
        self.on_mode_change()
        
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
        
        top_bar = QHBoxLayout()
        top_bar.addWidget(QLabel(f"<h2>{report_data.get('work_order_name')}</h2>"))
        top_bar.addStretch()
        
        self.btn_mark = QPushButton("Označit jako fakturované")
        self.btn_mark.setProperty("class", "btn-success")
        self.btn_mark.clicked.connect(self.mark_as_billed)
        
        self.btn_print = QPushButton("Tisk / PDF")
        self.btn_print.clicked.connect(self.print_pdf)
        
        top_bar.addWidget(self.btn_mark)
        top_bar.addWidget(self.btn_print)
        layout.addLayout(top_bar)
        
        layout.addWidget(QLabel("<b>PRÁCE</b>"))
        self.table_work = QTableWidget()
        self.init_table(self.table_work, ["Popis", "Hodiny", "Sazba/hod (Edit)", "Celkem"])
        layout.addWidget(self.table_work)
        
        layout.addWidget(QLabel("<b>MATERIÁL</b>"))
        self.table_mat = QTableWidget()
        self.init_table(self.table_mat, ["Položka", "Množství", "Cena/ks (Edit)", "Celkem"])
        layout.addWidget(self.table_mat)
        
        adj_widget = QWidget()
        adj_widget.setStyleSheet("""
            background-color: #fff3cd; border-radius: 5px; padding: 10px; color: black;
        """)
        adj_layout = QHBoxLayout(adj_widget)
        lbl_adj = QLabel("Globální úprava ceny (Sleva / Přirážka):")
        lbl_adj.setStyleSheet("color: black; font-weight: bold;") 
        self.spin_adj = QDoubleSpinBox()
        self.spin_adj.setRange(-100, 1000)
        self.spin_adj.setSuffix(" %")
        self.spin_adj.valueChanged.connect(self.recalculate)
        adj_layout.addWidget(lbl_adj)
        adj_layout.addWidget(self.spin_adj)
        adj_layout.addStretch()
        layout.addWidget(adj_widget)
        
        self.lbl_total = QLabel("<h1>Celkem k úhradě: 0 Kč</h1>")
        self.lbl_total.setAlignment(Qt.AlignmentFlag.AlignRight)
        layout.addWidget(self.lbl_total)
        
        self.populate_tables()
        self.recalculate()
        self.table_work.itemChanged.connect(self.on_item_changed)
        self.table_mat.itemChanged.connect(self.on_item_changed)

    def init_table(self, table, headers):
        table.setColumnCount(len(headers))
        table.setHorizontalHeaderLabels(headers)
        table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        # Editovatelné buňky bílé
        table.setStyleSheet("QTableWidget { background-color: #252525; color: white; gridline-color: #555; }")

    def populate_tables(self):
        logs = self.report_data.get("time_logs", [])
        self.table_work.setRowCount(len(logs))
        for i, log in enumerate(logs):
            self.set_item(self.table_work, i, 0, f"{log['task_name']}", editable=False)
            self.set_item(self.table_work, i, 1, str(log['hours']), editable=False)
            self.set_item(self.table_work, i, 2, str(log['rate']), editable=True)
            self.set_item(self.table_work, i, 3, str(log['total_price']), editable=False)

        items = self.report_data.get("used_items", [])
        self.table_mat.setRowCount(len(items))
        for i, item in enumerate(items):
            self.set_item(self.table_mat, i, 0, f"{item['item_name']}", editable=False)
            self.set_item(self.table_mat, i, 1, str(item['quantity']), editable=False)
            self.set_item(self.table_mat, i, 2, str(item['unit_price_sold']), editable=True)
            self.set_item(self.table_mat, i, 3, str(item['total_price']), editable=False)

    def set_item(self, table, row, col, text, editable=False):
        item = QTableWidgetItem(text)
        if not editable:
            item.setFlags(item.flags() ^ Qt.ItemFlag.ItemIsEditable)
            item.setForeground(QColor("#cccccc"))
        else:
            item.setBackground(QColor("#ffffff"))
            item.setForeground(QColor("#000000"))
            item.setFont(QFont("Arial", 10, QFont.Weight.Bold))
        table.setItem(row, col, item)

    def on_item_changed(self, item):
        table = item.tableWidget()
        if item.column() != 2: return
        row = item.row()
        try:
            val_per_unit = float(item.text().replace(",", "."))
            qty = float(table.item(row, 1).text())
            new_total = round(val_per_unit * qty, 2)
            table.blockSignals(True)
            table.item(row, 3).setText(str(new_total))
            table.blockSignals(False)
            self.recalculate()
        except ValueError: pass

    def recalculate(self):
        total = 0.0
        for i in range(self.table_work.rowCount()):
            try: total += float(self.table_work.item(i, 3).text())
            except: pass
        for i in range(self.table_mat.rowCount()):
            try: total += float(self.table_mat.item(i, 3).text())
            except: pass
        adj = self.spin_adj.value()
        grand_total = total * (1 + adj / 100.0)
        self.lbl_total.setText(f"<h1>Celkem k úhradě: {grand_total:.2f} Kč</h1>")

    def mark_as_billed(self):
        try:
            self.api.update_work_order_status(self.work_order_id, "billed")
            QMessageBox.information(self, "OK", "Označeno jako fakturované.")
            self.btn_mark.setEnabled(False)
        except Exception as e: QMessageBox.critical(self, "Chyba", str(e))

    def print_pdf(self):
        html = f"""
        <h1>Faktura</h1>
        <h2>{self.report_data.get('work_order_name')}</h2>
        <hr>
        <table width="100%" border="1" cellspacing="0" cellpadding="4">
            <tr><th>Popis</th><th>Množství</th><th>Cena/mj</th><th>Celkem</th></tr>
        """
        html += "<tr><td colspan='4'><b>PRÁCE</b></td></tr>"
        for i in range(self.table_work.rowCount()):
            html += f"<tr><td>{self.table_work.item(i,0).text()}</td><td>{self.table_work.item(i,1).text()}</td><td>{self.table_work.item(i,2).text()}</td><td>{self.table_work.item(i,3).text()}</td></tr>"
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

# --- MAIN WINDOW ---

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
            try:
                part = data['access_token'].split('.')[1]
                part += '=' * (-len(part) % 4)
                payload = json.loads(base64.urlsafe_b64decode(part))
                tenants = payload.get('tenants', [])
                if tenants: self.api.set_company_id(tenants[0])
                else: raise Exception("Žádná firma")
                if self.chk.isChecked():
                    self.settings.setValue("email", email)
                    self.settings.setValue("password", pwd)
                else: self.settings.clear()
                self.on_success()
            except Exception as e: QMessageBox.critical(self, "Chyba", f"Chyba tokenu: {e}")
        else: QMessageBox.warning(self, "Chyba", "Špatné údaje")

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
        
        self.tab_clients = QWidget()
        self.setup_clients(self.tab_clients)
        tabs.addTab(self.tab_clients, "Zákazníci")
        
        self.tab_inv = QWidget()
        self.setup_inventory(self.tab_inv)
        tabs.addTab(self.tab_inv, "Sklad")
        
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
        row = self.tbl_clients.currentRow()
        if row < 0: return
        cid = self.tbl_clients.item(row, 0).text()
        try:
            client_data = self.api.get_client(cid)
            # POUŽITÍ NOVÉHO DIALOGU
            dlg = ClientEditorDialog(self, self.api, cid, client_data)
            if dlg.exec():
                self.load_clients()
        except Exception as e:
            QMessageBox.critical(self, "Chyba", f"Nelze načíst klienta: {e}")

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
            except Exception as e: QMessageBox.critical(self, "Chyba", f"Chyba: {e}")

if __name__ == "__main__":
    app = QApplication(sys.argv)
    apply_dark_theme(app)
    api = ApiClient()
    def on_login():
        login.close()
        main = MainWindow(api)
        main.show()
        app._main = main
    login = LoginWindow(api, on_login)
    login.show()
    sys.exit(app.exec())