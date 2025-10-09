# LPD-sklad/windows/import_dialog.py
import pandas as pd
from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QPushButton, QLineEdit, QLabel,
    QFileDialog, QMessageBox, QComboBox, QGroupBox, QFormLayout, QProgressBar,
    QTextEdit
)
from PyQt6.QtCore import Qt, QThread, pyqtSignal

# Worker thread pro import, aby se nezamrazilo GUI
class ImportWorker(QThread):
    progress = pyqtSignal(int)
    log_message = pyqtSignal(str)
    finished = pyqtSignal(dict)

    def __init__(self, api_client, df, column_map):
        super().__init__()
        self.api_client = api_client
        self.df = df
        self.column_map = column_map
        self.is_cancelled = False

    def run(self):
        stats = {'created': 0, 'updated': 0, 'skipped': 0, 'failed': 0}
        total_rows = len(self.df)

        self.log_message.emit("Načítám existující položky pro porovnání...")
        existing_items = self.api_client.get_inventory_items()
        if existing_items is None:
            self.log_message.emit("CHYBA: Nepodařilo se načíst existující položky z API. Import byl zrušen.")
            self.finished.emit(stats)
            return
            
        sku_map = {item['sku']: item for item in existing_items}
        self.log_message.emit(f"Nalezeno {len(sku_map)} existujících položek.")

        for index, row in self.df.iterrows():
            if self.is_cancelled:
                break
                
            progress_percent = int(((index + 1) / total_rows) * 100)
            self.progress.emit(progress_percent)

            # Získání dat pomocí mapování
            sku = str(row.get(self.column_map['sku'], '')).strip()
            name = str(row.get(self.column_map['name'], '')).strip()

            if not sku or not name:
                self.log_message.emit(f"Řádek {index + 2}: přeskočen (chybí SKU nebo Název).")
                stats['skipped'] += 1
                continue

            # Sestavení dat pro API
            payload = {
                "sku": sku,
                "name": name,
            }
            if 'ean' in self.column_map and self.column_map['ean'] in row:
                payload['ean'] = str(row[self.column_map['ean']]).strip() or None
            if 'price' in self.column_map and self.column_map['price'] in row:
                try:
                    payload['price'] = float(row[self.column_map['price']])
                except (ValueError, TypeError):
                    self.log_message.emit(f"Řádek {index + 2} (SKU: {sku}): neplatná cena, bude ignorována.")
            if 'description' in self.column_map and self.column_map['description'] in row:
                payload['description'] = str(row[self.column_map['description']]).strip() or None

            # --- Volání API ---
            try:
                if sku in sku_map:
                    # Aktualizace
                    item_id = sku_map[sku]['id']
                    result = self.api_client.update_inventory_item(item_id, payload)
                    if result:
                        self.log_message.emit(f"Řádek {index + 2}: položka s SKU '{sku}' aktualizována.")
                        stats['updated'] += 1
                    else:
                        raise Exception("API volání pro update selhalo")
                else:
                    # Vytvoření
                    result = self.api_client.create_inventory_item(payload)
                    if result:
                        self.log_message.emit(f"Řádek {index + 2}: položka s SKU '{sku}' vytvořena.")
                        stats['created'] += 1
                    else:
                        raise Exception("API volání pro vytvoření selhalo")
            except Exception as e:
                self.log_message.emit(f"CHYBA na řádku {index + 2} (SKU: {sku}): {e}")
                stats['failed'] += 1
        
        if self.is_cancelled:
             self.log_message.emit("\nImport byl zrušen uživatelem.")
        else:
            self.log_message.emit("\nImport dokončen.")

        self.finished.emit(stats)

    def cancel(self):
        self.is_cancelled = True


class ImportDialog(QDialog):
    def __init__(self, api_client, parent=None):
        super().__init__(parent)
        self.api_client = api_client
        self.df = None
        self.xls_columns = ["--- Ignorovat ---"]
        self.worker = None

        self.setWindowTitle("Importovat položky z XLS/XLSX souboru")
        self.setMinimumSize(600, 500)
        self.layout = QVBoxLayout(self)

        # 1. Výběr souboru
        file_group = QGroupBox("Krok 1: Vyberte soubor")
        file_layout = QHBoxLayout()
        self.file_path_input = QLineEdit()
        self.file_path_input.setReadOnly(True)
        self.select_file_button = QPushButton("Procházet...")
        file_layout.addWidget(self.file_path_input)
        file_layout.addWidget(self.select_file_button)
        file_group.setLayout(file_layout)
        self.layout.addWidget(file_group)

        # 2. Mapování sloupců
        self.mapping_group = QGroupBox("Krok 2: Namapujte sloupce")
        mapping_layout = QFormLayout()
        self.map_name = QComboBox()
        self.map_sku = QComboBox()
        self.map_ean = QComboBox()
        self.map_price = QComboBox()
        self.map_description = QComboBox()
        mapping_layout.addRow("Název položky*:", self.map_name)
        mapping_layout.addRow("SKU*:", self.map_sku)
        mapping_layout.addRow("EAN:", self.map_ean)
        mapping_layout.addRow("Cena:", self.map_price)
        mapping_layout.addRow("Popis:", self.map_description)
        self.mapping_group.setLayout(mapping_layout)
        self.layout.addWidget(self.mapping_group)

        # 3. Průběh importu
        progress_group = QGroupBox("Krok 3: Spustit import")
        progress_layout = QVBoxLayout()
        self.progress_bar = QProgressBar()
        self.log_output = QTextEdit()
        self.log_output.setReadOnly(True)
        self.log_output.setStyleSheet("font-family: Consolas, monospaced;")
        progress_layout.addWidget(self.progress_bar)
        progress_layout.addWidget(self.log_output)
        progress_group.setLayout(progress_layout)
        self.layout.addWidget(progress_group)

        # Tlačítka
        button_layout = QHBoxLayout()
        self.start_button = QPushButton("Spustit import")
        self.cancel_button = QPushButton("Zrušit")
        self.close_button = QPushButton("Zavřít")
        button_layout.addStretch()
        button_layout.addWidget(self.start_button)
        button_layout.addWidget(self.cancel_button)
        button_layout.addWidget(self.close_button)
        self.layout.addLayout(button_layout)
        
        # Počáteční stav
        self.mapping_group.setEnabled(False)
        self.start_button.setEnabled(False)
        self.cancel_button.setVisible(False)
        self.close_button.setVisible(False)

        # Propojení signálů
        self.select_file_button.clicked.connect(self.select_file)
        self.start_button.clicked.connect(self.start_import)
        self.cancel_button.clicked.connect(self.cancel_import)
        self.close_button.clicked.connect(self.accept) 

    def select_file(self):
        path, _ = QFileDialog.getOpenFileName(self, "Vyberte XLS soubor", "", "Excel soubory (*.xlsx *.xls)")
        if path:
            self.file_path_input.setText(path)
            self.load_file(path)

    def load_file(self, path):
        try:
            self.df = pd.read_excel(path, dtype=str).fillna('')
            self.xls_columns = ["--- Ignorovat ---"] + list(self.df.columns)
            self.populate_mapping_combos()
            self.mapping_group.setEnabled(True)
            self.start_button.setEnabled(True)
            self.log_output.setText(f"Soubor '{path}' úspěšně načten.\nNalezeno {len(self.df)} řádků k importu.\n\nProsím, namapujte sloupce a spusťte import.")
        except Exception as e:
            QMessageBox.critical(self, "Chyba při čtení souboru", f"Nepodařilo se načíst soubor:\n{e}")
            self.mapping_group.setEnabled(False)
            self.start_button.setEnabled(False)

    def populate_mapping_combos(self):
        combos = [self.map_name, self.map_sku, self.map_ean, self.map_price, self.map_description]
        for combo in combos:
            combo.clear()
            combo.addItems(self.xls_columns)
        
        # Automatická detekce sloupců
        for i, col in enumerate(self.xls_columns):
            col_lower = col.lower()
            if "název" in col_lower or "name" in col_lower: self.map_name.setCurrentIndex(i)
            if "sku" in col_lower: self.map_sku.setCurrentIndex(i)
            if "ean" in col_lower: self.map_ean.setCurrentIndex(i)
            if "cena" in col_lower or "price" in col_lower: self.map_price.setCurrentIndex(i)
            if "popis" in col_lower or "description" in col_lower: self.map_description.setCurrentIndex(i)

    def start_import(self):
        column_map = {}
        # Povinná pole
        if self.map_name.currentIndex() > 0:
            column_map['name'] = self.map_name.currentText()
        else:
            QMessageBox.warning(self, "Chybějící mapování", "Musíte namapovat sloupec pro 'Název položky'.")
            return
            
        if self.map_sku.currentIndex() > 0:
            column_map['sku'] = self.map_sku.currentText()
        else:
            QMessageBox.warning(self, "Chybějící mapování", "Musíte namapovat sloupec pro 'SKU'.")
            return
            
        # Volitelná pole
        if self.map_ean.currentIndex() > 0: column_map['ean'] = self.map_ean.currentText()
        if self.map_price.currentIndex() > 0: column_map['price'] = self.map_price.currentText()
        if self.map_description.currentIndex() > 0: column_map['description'] = self.map_description.currentText()
        
        self.set_ui_for_import(True)
        
        self.worker = ImportWorker(self.api_client, self.df, column_map)
        self.worker.progress.connect(self.progress_bar.setValue)
        self.worker.log_message.connect(self.append_log)
        self.worker.finished.connect(self.import_finished)
        self.worker.start()

    def set_ui_for_import(self, importing: bool):
        self.select_file_button.setEnabled(not importing)
        self.mapping_group.setEnabled(not importing)
        self.start_button.setVisible(not importing)
        self.cancel_button.setVisible(importing)
        
        if importing:
            self.log_output.clear()
            self.progress_bar.setValue(0)
        
    def append_log(self, message):
        self.log_output.append(message)

    def import_finished(self, stats):
        self.progress_bar.setValue(100)
        summary = (f"\n--- Souhrn ---\n"
                   f"Vytvořeno: {stats['created']}\n"
                   f"Aktualizováno: {stats['updated']}\n"
                   f"Přeskočeno: {stats['skipped']}\n"
                   f"Selhalo: {stats['failed']}")
        self.append_log(summary)
        
        self.cancel_button.setVisible(False)
        self.close_button.setVisible(True)
        
        QMessageBox.information(self, "Import dokončen", "Proces importu byl dokončen. Zkontrolujte log pro detaily.")
    
    def cancel_import(self):
        if self.worker:
            self.worker.cancel()
            self.cancel_button.setEnabled(False)
            self.cancel_button.setText("Rušení...")
    
    def closeEvent(self, event):
        if self.worker and self.worker.isRunning():
            reply = QMessageBox.question(self, "Zavřít?", "Import stále běží. Opravdu ho chcete zrušit a zavřít okno?",
                                         QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                                         QMessageBox.StandardButton.No)
            if reply == QMessageBox.StandardButton.Yes:
                self.cancel_import()
                event.accept()
            else:
                event.ignore()
        else:
            event.accept()