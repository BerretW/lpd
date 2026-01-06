import os
from cryptography.fernet import Fernet

class Settings:
    PROJECT_NAME: str = "Appartus Company Management"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "mysql+asyncmy://root:password@db:3306/appdb")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "dev-secret-change-me")
    JWT_ALG: str = "HS256"
    JWT_EXPIRE_MINUTES: int = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))
    DEFAULT_USER_EMAIL: str = os.getenv("DEFAULT_USER_EMAIL", "admin@local")
    DEFAULT_USER_PASSWORD: str = os.getenv("DEFAULT_USER_PASSWORD", "admin123")
    # --- OPRAVENÝ ŘÁDEK ---
    # Klíč nyní pouze čteme z prostředí. Pokud není nastaven, os.getenv vrátí None.
    _encryption_key_str = os.getenv("ENCRYPTION_KEY")
    if not _encryption_key_str:
        raise ValueError("ENCRYPTION_KEY environment variable not set. Please generate one and add it to your .env file.")
    ENCRYPTION_KEY: bytes = _encryption_key_str.encode('utf-8')
settings = Settings()