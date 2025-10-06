# styling.py

MAIN_STYLESHEET = """
/* ---- Globální styl ---- */
QWidget {
    background-color: #2e3440; /* Tmavě šedá/modrá */
    color: #d8dee9; /* Světle šedá pro text */
    font-family: Segoe UI, Arial, sans-serif;
    font-size: 10pt;
}

/* ---- Tlačítka ---- */
QPushButton {
    background-color: #4c566a; /* Tmavší šedá */
    color: #eceff4; /* Bílá */
    border: 1px solid #434c5e;
    padding: 8px 12px;
    border-radius: 4px;
}
QPushButton:hover {
    background-color: #5e81ac; /* Světlejší modrá při najetí */
    border: 1px solid #81a1c1;
}
QPushButton:pressed {
    background-color: #81a1c1; /* Výrazná modrá při stisknutí */
}
QPushButton:disabled {
    background-color: #3b4252;
    color: #4c566a;
}

/* ---- Vstupní pole ---- */
QLineEdit, QSpinBox, QDoubleSpinBox, QComboBox {
    background-color: #3b4252; /* Tmavá barva pozadí */
    color: #eceff4;
    border: 1px solid #4c566a;
    border-radius: 4px;
    padding: 6px;
}
QLineEdit:focus, QSpinBox:focus, QDoubleSpinBox:focus, QComboBox:focus {
    border: 1px solid #88c0d0; /* Světle modrá při fokusu */
}

/* ---- Tabulka ---- */
QTableWidget {
    background-color: #3b4252;
    border: 1px solid #434c5e;
    gridline-color: #434c5e;
    alternate-background-color: #434c5e; /* Střídání barev řádků */
}
QHeaderView::section {
    background-color: #4c566a;
    color: #eceff4;
    padding: 6px;
    border: 1px solid #2e3440;
    font-weight: bold;
}
QTableWidget::item {
    padding: 5px;
}
QTableWidget::item:selected {
    background-color: #5e81ac;
    color: #eceff4;
}

/* ---- Strom (pro kategorie) ---- */
QTreeWidget {
    background-color: #3b4252;
    alternate-background-color: #434c5e;
    border: 1px solid #434c5e;
}

/* ---- Ostatní ---- */
QMessageBox {
    background-color: #3b4252;
}
QDialog {
    background-color: #2e3440;
}
QLabel {
    background-color: transparent;
}
QGroupBox {
    font-weight: bold;
    color: #88c0d0;
    border: 1px solid #4c566a;
    border-radius: 5px;
    margin-top: 10px;
}
QGroupBox::title {
    subcontrol-origin: margin;
    subcontrol-position: top left;
    padding: 0 5px;
}
QStatusBar {
    font-weight: bold;
}
"""