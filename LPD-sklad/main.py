# main.py
import sys
from PyQt6.QtWidgets import QApplication
from PyQt6.QtCore import QSettings # ZMĚNA: Import QSettings

from api_client import ApiClient
from windows.login_window import LoginWindow
from windows.main_window import MainWindow

if __name__ == '__main__':
    app = QApplication(sys.argv)
    
    # ZMĚNA: Nastavíme unikátní jméno pro QSettings, aby se ukládaly na správné místo
    app.setOrganizationName("LPD")
    app.setApplicationName("SkladnikPlus")
    
    api = ApiClient()
    
    # ZMĚNA: Blok pro pokus o automatické přihlášení
    settings = QSettings() 
    token = settings.value("user/token", None)
    
    auto_login_successful = False
    if token:
        if api.try_login_with_token(token):
            auto_login_successful = True
        else:
            # Token byl neplatný (např. expirovaný), tak ho smažeme
            settings.remove("user/token")

    # ZMĚNA: Logika spuštění aplikace
    if auto_login_successful:
        # Pokud automatické přihlášení uspělo, rovnou zobrazíme hlavní okno
        main_win = MainWindow(api)
        main_win.show()
        sys.exit(app.exec())
    else:
        # Pokud ne, zobrazíme klasické přihlašovací okno
        login_win = LoginWindow(api)
        if login_win.exec():
            main_win = MainWindow(api)
            main_win.show()
            sys.exit(app.exec())
        else:
            # Uživatel zavřel přihlašovací okno bez úspěšného přihlášení
            sys.exit(0)