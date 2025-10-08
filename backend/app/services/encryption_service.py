# backend/app/services/encryption_service.py
from cryptography.fernet import Fernet, InvalidToken
from app.core.config import settings

_cipher_suite = Fernet(settings.ENCRYPTION_KEY)

def encrypt_data(data: str) -> str:
    """Zašifruje string a vrátí ho jako string."""
    if not data:
        return ""
    encrypted_bytes = _cipher_suite.encrypt(data.encode('utf-8'))
    return encrypted_bytes.decode('utf-8')

def decrypt_data(encrypted_data: str) -> str:
    """Dešifruje string a vrátí ho jako string."""
    if not encrypted_data:
        return ""
    try:
        decrypted_bytes = _cipher_suite.decrypt(encrypted_data.encode('utf-8'))
        return decrypted_bytes.decode('utf-8')
    except InvalidToken:
        # Může nastat, pokud se změní ENCRYPTION_KEY nebo jsou data poškozená
        return ""