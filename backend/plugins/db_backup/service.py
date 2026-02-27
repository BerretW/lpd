import os
import subprocess
import glob
from datetime import datetime
from urllib.parse import urlparse, unquote
from sqlalchemy import select
from app.db.database import async_session_factory
from app.core.config import settings
from .models import BackupConfig
import logging

logger = logging.getLogger(__name__)

BACKUP_DIR = "/app/backups"

def get_db_credentials():
    """
    Načte údaje dynamicky z Connection Stringu aplikace (settings.DATABASE_URL).
    """
    url = settings.DATABASE_URL
    # Ošetření prefixů jako mysql+asyncmy://
    if "://" not in url:
        raise ValueError("Invalid DATABASE_URL format")
        
    parsed = urlparse(url)
    
    return {
        "host": parsed.hostname,
        "port": str(parsed.port) if parsed.port else "3306",
        "user": parsed.username,
        "password": unquote(parsed.password) if parsed.password else "",
        "db": parsed.path.lstrip('/')
    }

async def perform_backup():
    """Fyzicky provede zálohu pomocí mysqldump"""
    ensure_backup_dir()
    
    try:
        creds = get_db_credentials()
    except Exception as e:
        logger.error(f"Failed to parse DB credentials: {e}")
        raise e

    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    filename = f"{BACKUP_DIR}/backup_{timestamp}.sql"
    
    # Nastavení hesla přes ENV proměnnou (bezpečnější než v příkazu)
    env = os.environ.copy()
    env["MYSQL_PWD"] = creds["password"]
    
    cmd = [
        "mysqldump",
        "-h", creds["host"],
        "-P", creds["port"],
        "-u", creds["user"],
        # Parametr pro kompatibilitu s MySQL 8 (pokud server používá nové statistiky)
        # Pokud by to házelo chybu "unknown variable column-statistics", tento řádek smažte.
        "--column-statistics=0", 
        creds["db"],
        f"--result-file={filename}"
    ]
    
    try:
        # capture_output=True nám umožní přečíst chybovou hlášku
        result = subprocess.run(cmd, env=env, check=True, capture_output=True, text=True)
        logger.info(f"Backup created: {filename}")
        await cleanup_old_backups()
        return filename
    except subprocess.CalledProcessError as e:
        # Tady vypíšeme skutečnou chybu z databáze
        error_msg = e.stderr or str(e)
        logger.error(f"Backup failed. Error details: {error_msg}")
        
        # Pokud selže --column-statistics=0 (např. starší klient), zkusíme to bez něj
        if "unknown variable" in error_msg.lower() or "column-statistics" in error_msg.lower():
            logger.warning("Retrying backup without --column-statistics=0")
            cmd.remove("--column-statistics=0")
            try:
                subprocess.run(cmd, env=env, check=True, capture_output=True, text=True)
                logger.info(f"Backup created (retry): {filename}")
                await cleanup_old_backups()
                return filename
            except subprocess.CalledProcessError as e2:
                logger.error(f"Retry failed: {e2.stderr}")
                raise ValueError(f"Záloha selhala: {e2.stderr}")
        
        raise ValueError(f"Záloha selhala: {error_msg}")

async def restore_backup(filename: str):
    """Obnoví DB ze souboru"""
    filepath = os.path.join(BACKUP_DIR, filename)
    if not os.path.exists(filepath):
        raise FileNotFoundError("Backup file not found")
        
    creds = get_db_credentials()
    env = os.environ.copy()
    env["MYSQL_PWD"] = creds["password"]
    
    cmd = ["mysql", "-h", creds["host"], "-P", creds["port"], "-u", creds["user"], creds["db"]]
    
    with open(filepath, "r") as f:
        try:
            subprocess.run(cmd, env=env, stdin=f, check=True, capture_output=True, text=True)
            logger.info(f"Database restored from {filename}")
        except subprocess.CalledProcessError as e:
            logger.error(f"Restore failed: {e.stderr}")
            raise ValueError(f"Obnova selhala: {e.stderr}")

def ensure_backup_dir():
    if not os.path.exists(BACKUP_DIR):
        os.makedirs(BACKUP_DIR)

async def cleanup_old_backups():
    """Smaže staré zálohy podle nastavení"""
    async with async_session_factory() as session:
        config = (await session.execute(select(BackupConfig))).scalar_one_or_none()
        limit = config.keep_count if config else 7
        
    files = sorted(glob.glob(os.path.join(BACKUP_DIR, "*.sql")), key=os.path.getmtime, reverse=True)
    for file in files[limit:]:
        os.remove(file)
        logger.info(f"Deleted old backup: {file}")

# --- SCHEDULER LOGIC ---

def init_scheduler(scheduler):
    """Načte konfiguraci a nastaví cron job"""
    async def job_wrapper():
        async with async_session_factory() as session:
            config = (await session.execute(select(BackupConfig))).scalar_one_or_none()
            if config and config.is_active:
                await perform_backup()
    
    # Backup každý den v 03:00
    if not scheduler.get_job("db_backup_daily"):
        scheduler.add_job(job_wrapper, 'cron', hour=3, minute=0, id="db_backup_daily")