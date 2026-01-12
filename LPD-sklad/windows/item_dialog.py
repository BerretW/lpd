# windows/item_dialog.py
from PyQt6.QtWidgets import (QDialog, QVBoxLayout, QFormLayout, QLineEdit, 
                             QPushButton, QMessageBox, QDoubleSpinBox, QTreeWidget, 
                             QTreeWidgetItem, QTextEdit, QLabel, QHBoxLayout, 
                             QComboBox, QInputDialog, QFileDialog, QFrame) # Přidáno QFileDialog, QFrame
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QPixmap, QImage # Přidáno pro práci s obrázky
import requests # Potřebujeme pro stažení obrázku (nebo použít api_client helper, ale tady je to specifické)
import qtawesome as qta
from config import API_BASE_URL # Potřebujeme pro sestavení URL obrázku

class ItemDialog(QDialog):
    def __init__(self, api_client, categories_tree, item_data=None, prefill_data=None):
        super().__init__()
        self.api_client = api_client
        self.categories_tree = categories_tree or []
        self.item_data = item_data
        self.created_item = None
        
        self.manufacturers = []
        self.suppliers = []

        self.is_edit_mode = self.item_data is not None
        self.setWindowTitle("Upravit položku" if self.is_edit_mode else "Vytvořit novou položku")
        self.setMinimumWidth(850) # Zvětšeno kvůli obrázku
        self.setMinimumHeight(600)
        
        # --- Hlavní Layout (Horizontální rozdělení) ---
        main_layout = QHBoxLayout(self)
        
        # --- Levý panel (Formulář) ---
        form_widget = QFrame()
        form_layout_wrapper = QVBoxLayout(form_widget)
        form_layout_wrapper.setContentsMargins(0, 0, 0, 0)
        
        self.name_input = QLineEdit()
        self.sku_input = QLineEdit()
        self.ean_input = QLineEdit()
        
        self.price_input = QDoubleSpinBox()
        self.price_input.setRange(0.0, 999999.0)
        self.price_input.setDecimals(2)
        self.price_input.setSuffix(" Kč")
        
        self.manufacturer_combo = QComboBox()
        self.add_manufacturer_btn = QPushButton(qta.icon('fa5s.plus'), "")
        self.add_manufacturer_btn.setFixedWidth(30)
        
        self.supplier_combo = QComboBox()
        self.add_supplier_btn = QPushButton(qta.icon('fa5s.plus'), "")
        self.add_supplier_btn.setFixedWidth(30)

        self.cat_search_input = QLineEdit()
        self.cat_search_input.setPlaceholderText("Hledat kategorii...")
        self.cat_search_input.setClearButtonEnabled(True)
        
        self.category_tree = QTreeWidget()
        self.category_tree.setHeaderHidden(True)
        self.category_tree.setStyleSheet("QTreeWidget::item { padding: 4px; }")
        
        self.description_input = QTextEdit()
        self.description_input.setMaximumHeight(80)
        
        self.save_button = QPushButton("Uložit položku")
        self.save_button.setMinimumHeight(40)
        self.save_button.setStyleSheet("font-weight: bold; background-color: #5e81ac;")

        # Sestavení formuláře
        form_layout = QFormLayout()
        form_layout.addRow("Název*:", self.name_input)
        form_layout.addRow("SKU*:", self.sku_input)
        form_layout.addRow("EAN:", self.ean_input)
        form_layout.addRow("Cena (bez DPH):", self.price_input)
        
        man_layout = QHBoxLayout(); man_layout.addWidget(self.manufacturer_combo); man_layout.addWidget(self.add_manufacturer_btn)
        form_layout.addRow("Výrobce:", man_layout)

        sup_layout = QHBoxLayout(); sup_layout.addWidget(self.supplier_combo); sup_layout.addWidget(self.add_supplier_btn)
        form_layout.addRow("Dodavatel:", sup_layout)
        
        form_layout_wrapper.addLayout(form_layout)
        form_layout_wrapper.addWidget(QLabel("Kategorie:"))
        form_layout_wrapper.addWidget(self.cat_search_input)
        form_layout_wrapper.addWidget(self.category_tree)
        form_layout_wrapper.addWidget(QLabel("Popis:"))
        form_layout_wrapper.addWidget(self.description_input)
        form_layout_wrapper.addWidget(self.save_button)
        
        main_layout.addWidget(form_widget, stretch=2) # Formulář zabere 2/3 místa

        # --- Pravý panel (Obrázek) ---
        image_panel = QFrame()
        image_panel.setFrameShape(QFrame.Shape.StyledPanel)
        image_layout = QVBoxLayout(image_panel)
        
        image_layout.addWidget(QLabel("Obrázek položky:"))
        
        self.image_label = QLabel("Žádný obrázek")
        self.image_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.image_label.setMinimumSize(250, 250)
        self.image_label.setStyleSheet("border: 2px dashed #4c566a; background-color: #2e3440;")
        self.image_label.setScaledContents(True) # Automatické škálování
        image_layout.addWidget(self.image_label)
        
        self.upload_btn = QPushButton(qta.icon('fa5s.camera'), " Nahrát foto")
        self.upload_btn.setEnabled(self.is_edit_mode) # Povolit jen při editaci (musíme mít ID)
        if not self.is_edit_mode:
            self.upload_btn.setToolTip("Pro nahrání obrázku položku nejprve uložte.")
            
        image_layout.addWidget(self.upload_btn)
        image_layout.addStretch()
        
        main_layout.addWidget(image_panel, stretch=1) # Obrázek zabere 1/3 místa

        # --- Inicializace ---
        self._load_partners_data()
        self._populate_category_tree(self.categories_tree, self.category_tree.invisibleRootItem())
        
        if self.is_edit_mode:
            self._populate_fields()
            self._load_item_image() # Načíst obrázek pokud existuje
        elif prefill_data:
            self.name_input.setText(prefill_data.get('name', ''))
            self.ean_input.setText(prefill_data.get('ean', ''))

        # --- Signály ---
        self.save_button.clicked.connect(self.save_item)
        self.cat_search_input.textChanged.connect(self._filter_categories)
        self.add_manufacturer_btn.clicked.connect(self.create_new_manufacturer)
        self.add_supplier_btn.clicked.connect(self.create_new_supplier)
        self.upload_btn.clicked.connect(self.select_and_upload_image)

    # ... (metody _load_partners_data, create_new_manufacturer, create_new_supplier, _populate_category_tree, _filter_categories, _get_selected_category_ids zůstávají beze změny) ...
    # ZKOPÍROVAT PŮVODNÍ METODY SEM
    
    def _load_partners_data(self):
        self.manufacturers = self.api_client.get_manufacturers() or []
        self.suppliers = self.api_client.get_suppliers() or []
        self.manufacturer_combo.clear(); self.manufacturer_combo.addItem("--- Neurčeno ---", -1)
        for m in self.manufacturers: self.manufacturer_combo.addItem(m['name'], m['id'])
        self.supplier_combo.clear(); self.supplier_combo.addItem("--- Neurčeno ---", -1)
        for s in self.suppliers: self.supplier_combo.addItem(s['name'], s['id'])

    def create_new_manufacturer(self):
        name, ok = QInputDialog.getText(self, "Nový výrobce", "Název:")
        if ok and name:
            res = self.api_client.create_manufacturer(name)
            if res: self.manufacturer_combo.addItem(res['name'], res['id']); self.manufacturer_combo.setCurrentIndex(self.manufacturer_combo.count()-1)

    def create_new_supplier(self):
        name, ok = QInputDialog.getText(self, "Nový dodavatel", "Název:")
        if ok and name:
            res = self.api_client.create_supplier(name)
            if res: self.supplier_combo.addItem(res['name'], res['id']); self.supplier_combo.setCurrentIndex(self.supplier_combo.count()-1)

    def _populate_category_tree(self, categories, parent_item):
        for cat in categories:
            item = QTreeWidgetItem(parent_item); item.setText(0, cat['name']); item.setData(0, Qt.ItemDataRole.UserRole, cat['id'])
            item.setFlags(item.flags()|Qt.ItemFlag.ItemIsUserCheckable); item.setCheckState(0, Qt.CheckState.Unchecked)
            if cat.get('children'): self._populate_category_tree(cat['children'], item)
            
    def _filter_categories(self):
        txt = self.cat_search_input.text().lower()
        def f(item):
            match = txt in item.text(0).lower()
            ch = any(f(item.child(i)) for i in range(item.childCount()))
            item.setHidden(not (match or ch))
            if ch: item.setExpanded(True)
            return match or ch
        for i in range(self.category_tree.topLevelItemCount()): f(self.category_tree.topLevelItem(i))

    def _get_selected_category_ids(self):
        ids = []
        def t(item):
            if item.checkState(0)==Qt.CheckState.Checked: ids.append(item.data(0, Qt.ItemDataRole.UserRole))
            for i in range(item.childCount()): t(item.child(i))
        for i in range(self.category_tree.topLevelItemCount()): t(self.category_tree.topLevelItem(i))
        return ids

    def _populate_fields(self):
        self.name_input.setText(self.item_data.get('name', ''))
        self.sku_input.setText(self.item_data.get('sku', ''))
        self.ean_input.setText(self.item_data.get('ean', ''))
        self.description_input.setText(self.item_data.get('description', ''))
        self.price_input.setValue(self.item_data.get('price') or 0.0)
        
        if self.item_data.get('manufacturer'):
            idx = self.manufacturer_combo.findData(self.item_data['manufacturer']['id'])
            if idx >= 0: self.manufacturer_combo.setCurrentIndex(idx)
        if self.item_data.get('supplier'):
            idx = self.supplier_combo.findData(self.item_data['supplier']['id'])
            if idx >= 0: self.supplier_combo.setCurrentIndex(idx)
            
        cids = [c['id'] for c in self.item_data.get('categories', [])]
        def ch(item):
            if item.data(0, Qt.ItemDataRole.UserRole) in cids:
                item.setCheckState(0, Qt.CheckState.Checked)
                p = item.parent(); 
                while p: p.setExpanded(True); p = p.parent()
            for i in range(item.childCount()): ch(item.child(i))
        for i in range(self.category_tree.topLevelItemCount()): ch(self.category_tree.topLevelItem(i))

    # --- NOVÉ METODY PRO OBRÁZKY ---

    def _load_item_image(self):
        """Stáhne a zobrazí obrázek, pokud URL existuje."""
        image_url = self.item_data.get('image_url')
        if not image_url:
            return # Zůstane výchozí text "Žádný obrázek"

        # Pokud je URL relativní, doplníme base URL
        if not image_url.startswith("http"):
            # Předpokládáme, že backend nevrací počáteční lomítko, nebo ho ošetříme
            full_url = f"{API_BASE_URL}/{image_url.lstrip('/')}"
        else:
            full_url = image_url

        try:
            # Stáhneme obrázek (synchronně, pro jednoduchost)
            response = requests.get(full_url, timeout=5)
            if response.status_code == 200:
                pixmap = QPixmap()
                pixmap.loadFromData(response.content)
                if not pixmap.isNull():
                    self.image_label.setPixmap(pixmap)
                else:
                    self.image_label.setText("Chyba formátu")
            else:
                self.image_label.setText("Nelze načíst")
        except Exception as e:
            print(f"Chyba při stahování obrázku: {e}")
            self.image_label.setText("Chyba spojení")

    def select_and_upload_image(self):
        """Otevře dialog, vybere soubor a pošle na API."""
        if not self.item_data or 'id' not in self.item_data:
            return

        file_path, _ = QFileDialog.getOpenFileName(
            self, "Vybrat obrázek", "", "Obrázky (*.png *.jpg *.jpeg *.bmp)"
        )
        
        if file_path:
            self.upload_btn.setText("Nahrávám...")
            self.upload_btn.setEnabled(False)
            
            # Volání API
            updated_item = self.api_client.upload_inventory_item_image(self.item_data['id'], file_path)
            
            self.upload_btn.setText("Nahrát foto")
            self.upload_btn.setEnabled(True)

            if updated_item:
                QMessageBox.information(self, "Úspěch", "Obrázek byl nahrán.")
                self.item_data = updated_item # Aktualizujeme data
                self._load_item_image() # Znovu načteme obrázek z URL (pro jistotu)
            else:
                QMessageBox.critical(self, "Chyba", "Nahrávání selhalo.")

    def save_item(self):
        # ... (zbytek metody save_item zůstává stejný jako v předchozí odpovědi) ...
        # Pouze si dejte pozor na importy a proměnné
        man_id = self.manufacturer_combo.currentData(); man_id = None if man_id == -1 else man_id
        sup_id = self.supplier_combo.currentData(); sup_id = None if sup_id == -1 else sup_id
        
        data = {
            "name": self.name_input.text().strip(),
            "sku": self.sku_input.text().strip(),
            "ean": self.ean_input.text().strip() or None,
            "description": self.description_input.toPlainText().strip() or None,
            "price": self.price_input.value(),
            "category_ids": self._get_selected_category_ids(),
            "manufacturer_id": man_id,
            "supplier_id": sup_id
        }
        
        if not data["name"] or not data["sku"]:
            QMessageBox.warning(self, "Chyba", "Název a SKU jsou povinné.")
            return

        self.save_button.setEnabled(False)
        if self.is_edit_mode:
            res = self.api_client.update_inventory_item(self.item_data['id'], data)
        else:
            res = self.api_client.create_inventory_item(data)
            self.created_item = res
            
        self.save_button.setEnabled(True)
        if res: self.accept()
        else: QMessageBox.critical(self, "Chyba", "Uložení selhalo.")