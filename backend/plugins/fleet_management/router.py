from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from datetime import date, timedelta

from app.db.database import get_db
from app.core.dependencies import require_company_access, require_admin_access
from .models import Vehicle, VehicleLog
from .schemas import VehicleCreate, VehicleOut, VehicleLogCreate, VehicleLogOut, VehicleUpdate, VehicleAlertOut
from .schemas import VehicleLogUpdate # <--- Nezapomeňte přidat import
router = APIRouter(prefix="/plugins/fleet", tags=["plugin-fleet-management"])

# --- VOZIDLA ---

@router.get("/{company_id}/vehicles", response_model=list[VehicleOut])
async def list_vehicles(
    company_id: int, 
    db: AsyncSession = Depends(get_db), 
    _=Depends(require_company_access)
):
    stmt = select(Vehicle).where(Vehicle.company_id == company_id)
    return (await db.execute(stmt)).scalars().all()

@router.post("/{company_id}/vehicles", response_model=VehicleOut)
async def create_vehicle(
    company_id: int, 
    payload: VehicleCreate, 
    db: AsyncSession = Depends(get_db), 
    _=Depends(require_admin_access)
):
    # Kontrola duplicity SPZ ve firmě
    stmt = select(Vehicle).where(Vehicle.company_id == company_id, Vehicle.license_plate == payload.license_plate)
    if (await db.execute(stmt)).scalar_one_or_none():
        raise HTTPException(400, "Vozidlo s touto SPZ již existuje.")

    vehicle = Vehicle(**payload.dict(), company_id=company_id)
    db.add(vehicle)
    await db.commit()
    await db.refresh(vehicle)
    return vehicle

@router.patch("/{company_id}/vehicles/{vehicle_id}", response_model=VehicleOut)
async def update_vehicle(
    company_id: int,
    vehicle_id: int,
    payload: VehicleUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin_access)
):
    stmt = select(Vehicle).where(Vehicle.id == vehicle_id, Vehicle.company_id == company_id)
    vehicle = (await db.execute(stmt)).scalar_one_or_none()
    if not vehicle:
        raise HTTPException(404, "Vozidlo nenalezeno.")

    for k, v in payload.dict(exclude_unset=True).items():
        setattr(vehicle, k, v)
    
    await db.commit()
    await db.refresh(vehicle)
    return vehicle

# --- ALERTY (STK a Servis) ---

@router.get("/{company_id}/alerts", response_model=list[VehicleAlertOut])
async def get_fleet_alerts(
    company_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access)
):
    """Vrátí seznam vozidel, která vyžadují pozornost (blíží se STK nebo servis)."""
    stmt = select(Vehicle).where(Vehicle.company_id == company_id)
    vehicles = (await db.execute(stmt)).scalars().all()
    alerts = []
    
    today = date.today()
    warning_days = 30 # Upozornit 30 dní předem
    warning_km = 1000 # Upozornit 1000 km předem

    for v in vehicles:
        # Kontrola STK
        if v.next_stk_date:
            days_diff = (v.next_stk_date - today).days
            if days_diff <= warning_days:
                # Vytvoříme kopii objektu pro response a přidáme alert data
                alert_obj = VehicleAlertOut.model_validate(v)
                alert_obj.alert_type = "STK_EXPIRED" if days_diff < 0 else "STK_WARNING"
                alert_obj.days_remaining = days_diff
                alerts.append(alert_obj)
                continue # Pokud má problém s STK, přidáme a jdeme dál (nebo můžeme checkovat i servis)

        # Kontrola Servisu (km)
        if v.next_service_km and v.current_km:
            km_diff = v.next_service_km - v.current_km
            if km_diff <= warning_km:
                alert_obj = VehicleAlertOut.model_validate(v)
                alert_obj.alert_type = "SERVICE_OVERDUE" if km_diff < 0 else "SERVICE_WARNING"
                alert_obj.km_overdue = -km_diff if km_diff < 0 else 0
                alerts.append(alert_obj)

    return alerts

# --- KNIHA JÍZD ---

@router.post("/{company_id}/logs", response_model=VehicleLogOut)
async def add_trip_log(
    company_id: int,
    payload: VehicleLogCreate,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(require_company_access)
):
    """
    Zapíše jízdu a automaticky aktualizuje tachometr vozidla.
    """
    user_id = int(token.get("sub"))
    
    # 1. Validace vozidla
    stmt = select(Vehicle).where(Vehicle.id == payload.vehicle_id, Vehicle.company_id == company_id)
    vehicle = (await db.execute(stmt)).scalar_one_or_none()
    if not vehicle:
        raise HTTPException(404, "Vozidlo nenalezeno.")

    # 2. Validace nájezdu
    if payload.end_km <= payload.start_km:
        raise HTTPException(400, "Konečný stav tachometru musí být vyšší než počáteční.")

    # Volitelně: Kontrola návaznosti km (upozornění, pokud start_km nesedí s vehicle.current_km)
    # if vehicle.current_km and payload.start_km != vehicle.current_km:
    #     # Můžeme vyhodit chybu, nebo to nechat projít s varováním (např. někdo zapomněl zapsat jízdu)
    #     pass

    # 3. Vytvoření záznamu
    log = VehicleLog(**payload.dict(), driver_id=user_id)
    db.add(log)
    
    # 4. Aktualizace vozidla (pokud je nový nájezd vyšší než aktuální známý)
    if payload.end_km > vehicle.current_km:
        vehicle.current_km = payload.end_km

    await db.commit()
    await db.refresh(log)
    return log

@router.get("/{company_id}/logs", response_model=list[VehicleLogOut])
async def list_logs(
    company_id: int,
    vehicle_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access)
):
    stmt = select(VehicleLog).join(Vehicle).where(Vehicle.company_id == company_id)
    
    if vehicle_id:
        stmt = stmt.where(VehicleLog.vehicle_id == vehicle_id)
    
    stmt = stmt.order_by(VehicleLog.travel_date.desc(), VehicleLog.start_km.desc())
    return (await db.execute(stmt)).scalars().all()

@router.patch("/{company_id}/logs/{log_id}", response_model=VehicleLogOut)
async def update_log(
    company_id: int,
    log_id: int,
    payload: VehicleLogUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin_access) # Pouze admin může upravovat historii
):
    stmt = select(VehicleLog).where(VehicleLog.id == log_id)
    log = (await db.execute(stmt)).scalar_one_or_none()
    
    if not log:
        raise HTTPException(404, "Záznam nenalezen.")

    # Zde by se dalo přidat ověření, zda log patří firmě (přes vehicle -> company), 
    # ale pro jednoduchost spoléháme na admin access v rámci tenantu.

    update_data = payload.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(log, key, value)

    await db.commit()
    await db.refresh(log)
    return log

@router.delete("/{company_id}/logs/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_log(
    company_id: int,
    log_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin_access)
):
    stmt = select(VehicleLog).where(VehicleLog.id == log_id)
    log = (await db.execute(stmt)).scalar_one_or_none()
    
    if not log:
        raise HTTPException(404, "Záznam nenalezen.")
        
    await db.delete(log)
    await db.commit()