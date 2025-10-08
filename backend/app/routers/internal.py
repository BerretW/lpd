# backend/app/routers/internal.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import get_db
from app.services.trigger_service import check_all_triggers
from app.core.dependencies import require_admin_access # Zajistíme, že to může spustit jen admin

router = APIRouter(prefix="/internal", tags=["internal"], include_in_schema=False)

@router.post("/run-triggers", summary="Manuální spuštění kontroly notifikačních triggerů")
async def run_triggers_manually(
    company_id: int,
    db: AsyncSession = Depends(get_db),
    _ = Depends(require_admin_access)
):
    """
    Tento endpoint je určen primárně pro testovací účely.
    Spustí okamžitou kontrolu všech aktivních triggerů pro danou firmu.
    V reálném provozu se tato logika spouští automaticky na pozadí.
    """
    try:
        # V reálné aplikaci by `check_all_triggers` mohlo přijímat `company_id`
        # pro zúžení kontroly, zde pro jednoduchost kontroluje vše.
        await check_all_triggers(db)
        return {"status": "ok", "message": "Trigger check completed."}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred during trigger check: {str(e)}"
        )