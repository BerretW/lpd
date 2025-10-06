# windows/login_window.py
from PyQt6.QtWidgets import QDialog, QLineEdit, QPushButton, QVBoxLayout, QMessageBox, QLabel, QFrame
from PyQt6.QtGui import QIcon
from PyQt6.QtCore import Qt
import qtawesome as qta

# Předpokládáme, že soubor styling.py je ve stejném adresáři jako main.py
from styling import MAIN_STYLESHEET

class LoginWindow(QDialog):
    def __init__(self, api_client):
        super().__init__()
        self.api_client = api_client
        self.setWindowTitle("Přihlášení - Skladník Plus")
        self.setWindowIcon(qta.icon('fa5s.warehouse'))
        self.setMinimumWidth(350)
        self.setStyleSheet(MAIN_STYLESHEET) # Aplikace stylu

        layout = QVBoxLayout(self)
        layout.setContentsMargins(20, 20, 20, 20)
        
        title = QLabel("Skladník Plus")
        title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        title.setStyleSheet("font-size: 20pt; font-weight: bold; color: #88c0d0;")
        layout.addWidget(title)
        
        layout.addSpacing(20)

        self.email_input = QLineEdit()
        self.email_input.setPlaceholderText("firemni.email@example.com")
        self.password_input = QLineEdit()
        self.password_input.setPlaceholderText("●●●●●●●●●●")
        self.password_input.setEchoMode(QLineEdit.EchoMode.Password)
        
        self.login_button = QPushButton(qta.icon('fa5s.sign-in-alt'), " Přihlásit")

        layout.addWidget(QLabel("E-mail:"))
        layout.addWidget(self.email_input)
        layout.addWidget(QLabel("Heslo:"))
        layout.addWidget(self.password_input)
        layout.addSpacing(15)
        layout.addWidget(self.login_button)
        
        # Testovací data
        self.email_input.setText("admin@mojefirma.cz")
        self.password_input.setText("SuperSilneHeslo123")
        
        self.login_button.clicked.connect(self.handle_login)
        self.password_input.returnPressed.connect(self.handle_login)

    def handle_login(self):
        email = self.email_input.text()
        password = self.password_input.text()
        
        if not email or not password:
            QMessageBox.warning(self, "Chyba", "Vyplňte prosím e-mail i heslo.")
            return

        self.login_button.setEnabled(False)
        self.login_button.setText(" Přihlašuji se...")
        
        success = self.api_client.login(email, password)
        
        self.login_button.setEnabled(True)
        self.login_button.setText(" Přihlásit")
        
        if success:
            self.accept()
        else:
            QMessageBox.critical(self, "Přihlášení selhalo", "Zkontrolujte zadané údaje a připojení k síti.")