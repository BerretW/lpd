from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import date

# --- Vehicle Schemas ---
class VehicleBase(BaseModel):
    license_plate: str
    brand: str
    model: str
    vin: Optional[str] = None
    current_km: float = 0
    next_service_km: Optional[float] = None
    next_stk_date: Optional[date] = None
    assigned_user_id: Optional[int] = None

class VehicleUpdate(BaseModel):
    license_plate: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    vin: Optional[str] = None
    current_km: Optional[float] = None
    next_service_km: Optional[float] = None
    next_stk_date: Optional[date] = None
    assigned_user_id: Optional[int] = None
class VehicleCreate(VehicleBase):
    pass

class VehicleLogUpdate(BaseModel):
    travel_date: Optional[date] = None
    start_location: Optional[str] = None
    end_location: Optional[str] = None
    start_km: Optional[float] = None
    end_km: Optional[float] = None
    notes: Optional[str] = None
    vehicle_id: Optional[int] = None 
    driver_id: Optional[int] = None

class VehicleOut(VehicleBase):
    id: int
    company_id: int
    model_config = ConfigDict(from_attributes=True)

class VehicleAlertOut(VehicleOut):
    alert_type: str # 'STK' nebo 'SERVICE'
    days_remaining: Optional[int] = None
    km_overdue: Optional[float] = None

# --- Log Schemas ---
class VehicleLogBase(BaseModel):
    vehicle_id: int
    travel_date: date
    start_location: str
    end_location: str
    start_km: float
    end_km: float
    notes: Optional[str] = None

class VehicleLogCreate(VehicleLogBase):
    pass

class VehicleLogOut(VehicleLogBase):
    id: int
    driver_id: Optional[int]
    model_config = ConfigDict(from_attributes=True)