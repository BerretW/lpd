# windows/item_dialog.py
from PyQt6.QtWidgets import (QDialog, QVBoxLayout, QFormLayout, QLineEdit, 
                             QPushButton, QMessageBox, QDoubleSpinBox, QTreeWidget, 
                             QTreeWidgetItem, QTextEdit, QLabel, QHBoxLayout)
from PyQt6.QtCore import Qt

class ItemDialog(QDialog):
    def __init__(self, api_client, categories_tree, item_data=None, prefill_data=None):
        """
        POZOR: Nyní vyžaduje 'categories_tree' (původní hierarchický formát z API), 
        nikoliv plochý seznam.
        """
        super().__init__()
        self.api_client = api_client
        self.categories_tree = categories_tree or []
        self.item_data = item_data
        self.created_item = None

        self.is_edit_mode = self.item_data is not None
        self.setWindowTitle("Upravit položku" if self.is_edit_mode else "Vytvořit novou položku")
        self.setMinimumWidth(500)
        self.setMinimumHeight(600)
        
        # --- Widgets ---
        self.name_input = QLineEdit()
        self.sku_input = QLineEdit()
        self.ean_input = QLineEdit()
        
        self.price_input = QDoubleSpinBox()
        self.price_input.setRange(0.0, 999999.0)
        self.price_input.setDecimals(2)
        self.price_input.setSuffix(" Kč")
        
        # --- Kategorie s vyhledáváním ---
        self.cat_search_input = QLineEdit()
        self.cat_search_input.setPlaceholderText("Rychlé hledání v kategoriích...")
        self.cat_search_input.setClearButtonEnabled(True)
        
        self.category_tree = QTreeWidget()
        self.category_tree.setHeaderHidden(True)
        self.category_tree.setSelectionMode(QTreeWidget.SelectionMode.NoSelection)
        self.category_tree.setStyleSheet("QTreeWidget::item { padding: 4px; }")
        
        self.description_input = QTextEdit()
        self.description_input.setMaximumHeight(80)
        
        self.save_button = QPushButton("Uložit položku")
        self.save_button.setMinimumHeight(40)
        self.save_button.setStyleSheet("font-weight: bold; background-color: #5e81ac;")

        # --- Layout ---
        layout = QVBoxLayout(self)
        form_layout = QFormLayout()
        form_layout.addRow("Název*:", self.name_input)
        form_layout.addRow("SKU*:", self.sku_input)
        form_layout.addRow("EAN:", self.ean_input)
        form_layout.addRow("Cena (bez DPH):", self.price_input)
        
        # Sekce kategorií
        cat_section = QVBoxLayout()
        cat_section.addWidget(QLabel("Kategorie (zaškrtněte libovolné):"))
        cat_section.addWidget(self.cat_search_input)
        cat_section.addWidget(self.category_tree)
        form_layout.addRow(cat_section)
        
        form_layout.addRow("Popis:", self.description_input)
        
        layout.addLayout(form_layout)
        layout.addWidget(self.save_button)
        
        # --- Inicializace dat ---
        self._populate_category_tree(self.categories_tree, self.category_tree.invisibleRootItem())
        
        if self.is_edit_mode:
            self._populate_fields()
        elif prefill_data:
            self.name_input.setText(prefill_data.get('name', ''))
            self.ean_input.setText(prefill_data.get('ean', ''))

        # --- Signály ---
        self.save_button.clicked.connect(self.save_item)
        self.cat_search_input.textChanged.connect(self._filter_categories)

    def _populate_category_tree(self, categories, parent_item):
        """Rekurzivně naplní strom kategoriemi s checkboxy."""
        for cat in categories:
            item = QTreeWidgetItem(parent_item)
            item.setText(0, cat['name'])
            item.setData(0, Qt.ItemDataRole.UserRole, cat['id'])
            item.setFlags(item.flags() | Qt.ItemFlag.ItemIsUserCheckable)
            item.setCheckState(0, Qt.CheckState.Unchecked)
            
            if cat.get('children'):
                self._populate_category_tree(cat['children'], item)

    def _filter_categories(self):
        """Filtruje strom kategorií podle zadaného textu."""
        search_text = self.cat_search_input.text().lower()
        
        def filter_item(item):
            # Prohledáme název
            text = item.text(0).lower()
            match = search_text in text
            
            # Prohledáme potomky (rekurzivně)
            child_match = False
            for i in range(item.childCount()):
                if filter_item(item.child(i)):
                    child_match = True
            
            # Položku zobrazíme, pokud odpovídá ona nebo některý z potomků
            should_show = match or child_match
            item.setHidden(not should_show)
            
            # Pokud je match v potomkovi, rozbalíme rodiče, aby byl vidět
            if child_match and search_text:
                item.setExpanded(True)
            elif not search_text:
                item.setExpanded(False) # Zabalit vše při smazání hledání (volitelné)
                
            return should_show

        for i in range(self.category_tree.topLevelItemCount()):
            filter_item(self.category_tree.topLevelItem(i))

    def _get_selected_category_ids(self):
        """Posbírá ID všech zaškrtnutých kategorií napříč celým stromem."""
        selected_ids = []
        
        def traverse(item):
            if item.checkState(0) == Qt.CheckState.Checked:
                selected_ids.append(item.data(0, Qt.ItemDataRole.UserRole))
            for i in range(item.childCount()):
                traverse(item.child(i))
                
        for i in range(self.category_tree.topLevelItemCount()):
            traverse(self.category_tree.topLevelItem(i))
        return selected_ids

    def _populate_fields(self):
        """Předvyplní pole při editaci."""
        self.name_input.setText(self.item_data.get('name', ''))
        self.sku_input.setText(self.item_data.get('sku', ''))
        self.ean_input.setText(self.item_data.get('ean', ''))
        self.description_input.setText(self.item_data.get('description', ''))
        
        price = self.item_data.get('price')
        self.price_input.setValue(price if price is not None else 0.0)
        
        # Označení existujících kategorií
        item_categories = self.item_data.get('categories', [])
        current_cat_ids = [c['id'] for c in item_categories]
        
        def check_existing(item):
            cat_id = item.data(0, Qt.ItemDataRole.UserRole)
            if cat_id in current_cat_ids:
                item.setCheckState(0, Qt.CheckState.Checked)
                # Rozbalíme cestu k zaškrtnuté kategorii
                parent = item.parent()
                while parent:
                    parent.setExpanded(True)
                    parent = parent.parent()
            for i in range(item.childCount()):
                check_existing(item.child(i))

        for i in range(self.category_tree.topLevelItemCount()):
            check_existing(self.category_tree.topLevelItem(i))

    def save_item(self):
        selected_ids = self._get_selected_category_ids()

        data = {
            "name": self.name_input.text().strip(),
            "sku": self.sku_input.text().strip(),
            "ean": self.ean_input.text().strip() or None,
            "description": self.description_input.toPlainText().strip() or None,
            "price": self.price_input.value(),
            "category_ids": selected_ids
        }
        
        if not data["name"] or not data["sku"]:
            QMessageBox.warning(self, "Chybějící údaje", "Název a SKU jsou povinné.")
            return

        self.save_button.setEnabled(False)
        self.save_button.setText("Ukládám...")
        
        if self.is_edit_mode:
            result = self.api_client.update_inventory_item(self.item_data['id'], data)
        else:
            result = self.api_client.create_inventory_item(data)
            if result:
                self.created_item = result
            
        self.save_button.setEnabled(True)
        self.save_button.setText("Uložit položku")

        if result:
            self.accept()
        else:
            QMessageBox.critical(self, "Chyba", "Položku se nepodařilo uložit. Zkontrolujte unikátnost SKU.")