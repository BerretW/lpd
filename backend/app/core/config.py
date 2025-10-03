import os

class Settings:
    PROJECT_NAME: str = "HoursService"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "mysql+asyncmy://root:password@db:3306/appdb")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "dev-secret-change-me")
    JWT_ALG: str = "HS256"
    JWT_EXPIRE_MINUTES: int = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))

settings = Settings()