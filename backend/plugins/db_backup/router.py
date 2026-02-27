from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import get_db
from app.core.dependencies import require_admin_access
from .models import BackupConfig
from .service import perform_backup, restore_backup, BACKUP_DIR
import os
from pydantic import BaseModel
from fastapi.responses import FileResponse

router = APIRouter(prefix="/plugins/backup", tags=["plugin-backup"])

class BackupConfigIn(BaseModel):
    is_active: bool
    keep_count: int

class BackupFileOut(BaseModel):
    filename: str
    size_mb: float
    created: str

@router.get("/config")
async def get_config(db: AsyncSession = Depends(get_db), _=Depends(require_admin_access)):
    conf = (await db.execute(select(BackupConfig))).scalar_one_or_none()
    if not conf:
        conf = BackupConfig(is_active=False, keep_count=7)
        db.add(conf)
        await db.commit()
    return conf

@router.post("/config")
async def update_config(payload: BackupConfigIn, db: AsyncSession = Depends(get_db), _=Depends(require_admin_access)):
    conf = (await db.execute(select(BackupConfig))).scalar_one_or_none()
    if not conf:
        conf = BackupConfig()
        db.add(conf)
    
    conf.is_active = payload.is_active
    conf.keep_count = payload.keep_count
    await db.commit()
    return conf

@router.post("/run")
async def run_manual_backup(_=Depends(require_admin_access)):
    try:
        filename = await perform_backup()
        return {"status": "ok", "file": os.path.basename(filename)}
    except Exception as e:
        raise HTTPException(500, str(e))

@router.get("/files", response_model=list[BackupFileOut])
async def list_backups(_=Depends(require_admin_access)):
    if not os.path.exists(BACKUP_DIR):
        return []
    files = []
    for f in os.listdir(BACKUP_DIR):
        if f.endswith(".sql"):
            path = os.path.join(BACKUP_DIR, f)
            stat = os.stat(path)
            files.append({
                "filename": f,
                "size_mb": round(stat.st_size / (1024 * 1024), 2),
                "created": datetime.fromtimestamp(stat.st_mtime).isoformat()
            })
    return sorted(files, key=lambda x: x['created'], reverse=True)

@router.get("/download/{filename}")
async def download_backup(filename: str, _=Depends(require_admin_access)):
    path = os.path.join(BACKUP_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(404, "File not found")
    return FileResponse(path, filename=filename)

@router.post("/restore/{filename}")
async def restore_db(filename: str, _=Depends(require_admin_access)):
    try:
        await restore_backup(filename)
        return {"status": "restored"}
    except Exception as e:
        raise HTTPException(500, str(e))