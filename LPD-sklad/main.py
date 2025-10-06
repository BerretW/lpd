# main.py
import sys
from PyQt6.QtWidgets import QApplication
from api_client import ApiClient
from windows.login_window import LoginWindow
from windows.main_window import MainWindow

if __name__ == '__main__':
    app = QApplication(sys.argv)
    
    api = ApiClient()
    
    login_win = LoginWindow(api)
    
    # Zobrazíme přihlašovací okno. Program zde počká, dokud se nezavře.
    # Pokud se zavře přes `accept()`, vrátí True.
    if login_win.exec():
        main_win = MainWindow(api)
        main_win.show()
        sys.exit(app.exec())
    else:
        # Uživatel zavřel přihlašovací okno bez úspěšného přihlášení
        sys.exit(0)