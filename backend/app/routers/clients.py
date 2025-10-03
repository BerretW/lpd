from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import get_db
from app.db.models import Client, WorkOrder
from app.schemas.client import ClientCreateIn, ClientOut, ClientUpdateIn
from app.routers.companies import require_company_access

router = APIRouter(prefix="/companies/{company_id}/clients", tags=["clients"])

# V reálné aplikaci by zde byla implementace ověření role admina/ownera
def require_admin_access(payload: dict = Depends(require_company_access)):
    return payload

async def get_client_or_404(company_id: int, client_id: int, db: AsyncSession) -> Client:
    """Pomocná funkce pro načtení klienta nebo vrácení 404."""
    stmt = select(Client).where(Client.id == client_id, Client.company_id == company_id)
    client = (await db.execute(stmt)).scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    return client

@router.post("", response_model=ClientOut, status_code=status.HTTP_201_CREATED)
async def create_client(company_id: int, payload: ClientCreateIn, db: AsyncSession = Depends(get_db), _=Depends(require_admin_access)):
    client = Client(**payload.dict(), company_id=company_id)
    db.add(client)
    await db.commit()
    await db.refresh(client)
    return client

@router.get("", response_model=List[ClientOut])
async def list_clients(company_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_company_access)):
    stmt = select(Client).where(Client.company_id == company_id)
    return (await db.execute(stmt)).scalars().all()

@router.get("/{client_id}", response_model=ClientOut)
async def get_client(company_id: int, client_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_company_access)):
    return await get_client_or_404(company_id, client_id, db)

@router.patch("/{client_id}", response_model=ClientOut)
async def update_client(company_id: int, client_id: int, payload: ClientUpdateIn, db: AsyncSession = Depends(get_db), _=Depends(require_admin_access)):
    client = await get_client_or_404(company_id, client_id, db)
    update_data = payload.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(client, key, value)
    await db.commit()
    await db.refresh(client)
    return client

@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Smazání klienta")
async def delete_client(company_id: int, client_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_admin_access)):
    """
    Smaže klienta. Všechny zakázky, které byly na tohoto klienta navázány,
    zůstanou v systému, ale budou od něj odpojeny (budou mít client_id = NULL).
    """
    client = await get_client_or_404(company_id, client_id, db)
    await db.delete(client)
    await db.commit()
    # Není třeba nic vracet, FastAPI se postará o status 204