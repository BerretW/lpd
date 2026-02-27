from sqlalchemy import Column, Integer, String, Boolean
from app.db.database import Base

class BackupConfig(Base):
    __tablename__ = "plugin_backup_config"
    id = Column(Integer, primary_key=True)
    is_active = Column(Boolean, default=False)
    cron_schedule = Column(String(50), default="0 3 * * *") # Cron formát (např. 3:00 ráno)
    keep_count = Column(Integer, default=7) # Kolik záloh držet
    backup_path = Column(String(255), default="/app/backups")