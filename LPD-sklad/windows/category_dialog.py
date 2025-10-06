# windows/category_dialog.py
from PyQt6.QtWidgets import (QDialog, QVBoxLayout, QPushButton, QMessageBox, 
                             QTreeWidget, QTreeWidgetItem, QLineEdit, QHBoxLayout, QLabel)

class CategoryDialog(QDialog):
    def __init__(self, api_client, parent=None):
        super().__init__(parent)
        self.api_client = api_client
        self.setWindowTitle("Správa kategorií")
        self.setMinimumSize(400, 500)

        self.layout = QVBoxLayout(self)
        
        self.tree = QTreeWidget()
        self.tree.setHeaderLabel("Kategorie")
        self.layout.addWidget(self.tree)

        # Formulář pro přidání nové kategorie
        add_layout = QHBoxLayout()
        self.new_category_name = QLineEdit()
        self.new_category_name.setPlaceholderText("Název nové kategorie...")
        self.add_button = QPushButton("Přidat")
        
        add_layout.addWidget(QLabel("Nová:"))
        add_layout.addWidget(self.new_category_name)
        add_layout.addWidget(self.add_button)
        self.layout.addLayout(add_layout)

        self.add_button.clicked.connect(self.add_category)

        self.load_categories()

    def load_categories(self):
        self.tree.clear()
        categories = self.api_client.get_categories()
        if categories is not None:
            self._populate_tree(categories, self.tree)
        else:
            QMessageBox.critical(self, "Chyba", "Nepodařilo se načíst kategorie.")

    def _populate_tree(self, categories, parent_item):
        for category in categories:
            tree_item = QTreeWidgetItem(parent_item, [category['name']])
            tree_item.setData(0, 1, category['id'])  # Uložíme si ID kategorie
            if category.get('children'):
                self._populate_tree(category['children'], tree_item)

    def add_category(self):
        name = self.new_category_name.text().strip()
        if not name:
            QMessageBox.warning(self, "Chyba", "Název kategorie nemůže být prázdný.")
            return

        selected_item = self.tree.currentItem()
        parent_id = None
        if selected_item:
            parent_id = selected_item.data(0, 1)

        result = self.api_client.create_category(name, parent_id)
        if result:
            self.new_category_name.clear()
            QMessageBox.information(self, "Úspěch", f"Kategorie '{name}' byla vytvořena.")
            self.load_categories() # Znovu načteme strom
        else:
            QMessageBox.critical(self, "Chyba", "Nepodařilo se vytvořit kategorii.")