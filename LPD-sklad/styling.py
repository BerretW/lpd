# styling.py

# =============================================================================
# KOMPLETNĚ PŘEPRACOVANÝ STYLESHEET PRO LEPŠÍ A MODERNĚJŠÍ VZHLED
# Inspirováno barevnou paletou "Nord".
# =============================================================================

MAIN_STYLESHEET = """
/* ---- Globální styl ---- */
QWidget {
    background-color: #2e3440; /* Nord0 */
    color: #d8dee9; /* Nord4 */
    font-family: Segoe UI, Arial, sans-serif;
    font-size: 10pt;
}

/* ---- Tlačítka ---- */
QPushButton {
    background-color: #4c566a; /* Nord3 */
    color: #eceff4; /* Nord6 */
    border: 1px solid #434c5e; /* Nord2 */
    padding: 8px 12px;
    border-radius: 4px;
}
QPushButton:hover {
    background-color: #5e81ac; /* Nord9 */
    border: 1px solid #81a1c1; /* Nord10 */
}
QPushButton:pressed {
    background-color: #81a1c1; /* Nord10 */
}
QPushButton:disabled {
    background-color: #3b4252; /* Nord1 */
    color: #4c566a; /* Nord3 */
}

/* ---- Vstupní pole ---- */
QLineEdit, QSpinBox, QDoubleSpinBox, QComboBox, QTextEdit, QDateEdit {
    background-color: #3b4252; /* Nord1 */
    color: #eceff4; /* Nord6 */
    border: 1px solid #4c566a; /* Nord3 */
    border-radius: 4px;
    padding: 6px;
}
QLineEdit:focus, QSpinBox:focus, QDoubleSpinBox:focus, QComboBox:focus, QTextEdit:focus, QDateEdit:focus {
    border: 1px solid #88c0d0; /* Nord8 */
}
QComboBox::drop-down {
    border: none;
}
QComboBox::down-arrow {
    image: url(down_arrow.png); /* Pro lepší vzhled by to chtělo ikonu, ale i bez ní to funguje */
}

/* ---- Tabulka ---- */
QTableWidget {
    background-color: #3b4252; /* Nord1 */
    border: 1px solid #434c5e; /* Nord2 */
    gridline-color: #434c5e; /* Nord2 */
    alternate-background-color: #434c5e; /* Nord2 */
}
QHeaderView::section {
    background-color: #4c566a; /* Nord3 */
    color: #eceff4; /* Nord6 */
    padding: 8px; /* Zvětšený padding */
    border: 1px solid #2e3440; /* Nord0 */
    font-weight: bold;
}
QTableWidget::item {
    padding: 8px; /* Zvětšený padding */
    border-bottom: 1px solid #434c5e;
}
QTableWidget::item:selected {
    background-color: #5e81ac; /* Nord9 */
    color: #eceff4; /* Nord6 */
}

/* ---- GroupBox ---- */
QGroupBox {
    font-weight: bold;
    color: #88c0d0; /* Nord8 */
    border: 1px solid #434c5e; /* Nord2 */
    border-radius: 5px;
    margin-top: 10px;
    padding-top: 10px; 
}
QGroupBox::title {
    subcontrol-origin: margin;
    subcontrol-position: top left;
    padding: 0 5px;
    left: 10px; 
    background-color: #2e3440; 
}

/* ---- Záložky (Tabs) ---- */
QTabWidget::pane {
    border: 1px solid #434c5e;
    border-radius: 4px;
    padding: 10px;
}
QTabBar::tab {
    background: #3b4252;
    border: 1px solid #434c5e;
    border-bottom-color: #434c5e; 
    border-top-left-radius: 4px;
    border-top-right-radius: 4px;
    min-width: 8ex;
    padding: 8px 12px;
    margin-right: 2px;
}
QTabBar::tab:selected, QTabBar::tab:hover {
    background: #4c566a;
}
QTabBar::tab:selected {
    border-color: #434c5e;
    border-bottom-color: #4c566a; 
}
QTabBar::tab:!selected {
    margin-top: 2px;
}

/* ---- ToolBar ---- */
QToolBar {
    background: #2e3440;
    border: none;
    padding: 5px;
}
QToolButton {
    background-color: transparent;
    color: #eceff4;
    border: 1px solid transparent;
    padding: 6px;
    border-radius: 4px;
    margin: 2px;
}
QToolButton:hover {
    background-color: #434c5e;
    border: 1px solid #4c566a;
}
QToolButton:pressed {
    background-color: #5e81ac;
}

/* ---- Status Bar ---- */
QStatusBar {
    background-color: #4c566a;
    color: #eceff4;
    font-weight: bold;
}
QStatusBar::item {
    border: none;
}

/* ---- Ostatní ---- */
QMessageBox, QDialog {
    background-color: #2e3440;
}
QLabel {
    background-color: transparent;
}
QSplitter::handle {
    background: #434c5e;
}
QSplitter::handle:hover {
    background: #5e81ac;
}
QTreeWidget {
    background-color: #3b4252;
    alternate-background-color: #434c5e;
    border: 1px solid #434c5e;
}
"""