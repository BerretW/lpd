from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, extract
from app.db.database import get_db
from app.db.models import WorkOrder
from app.core.dependencies import require_company_access
from datetime import datetime, timedelta

router = APIRouter(prefix="/plugins/customer-stats", tags=["plugin-customer-stats"])

@router.get("/{client_id}/frequency")
async def get_client_trip_frequency(
    company_id: int, 
    client_id: int, 
    months: int = 12,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access)
):
    """
    Vrátí počet zakázek (výjezdů) pro klienta za posledních X měsíců.
    """
    since_date = datetime.now() - timedelta(days=30 * months)
    
    # Seskupení podle roku a měsíce
    stmt = (
        select(
            func.year(WorkOrder.created_at).label('year'),
            func.month(WorkOrder.created_at).label('month'),
            func.count(WorkOrder.id).label('count')
        )
        .where(
            WorkOrder.company_id == company_id,
            WorkOrder.client_id == client_id,
            WorkOrder.created_at >= since_date
        )
        .group_by('year', 'month')
        .order_by('year', 'month')
    )
    
    result = await db.execute(stmt)
    data = result.all()
    
    # Formátování pro frontend
    return [
        {"date": f"{row.month}/{row.year}", "count": row.count} 
        for row in data
    ]