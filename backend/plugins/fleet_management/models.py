from sqlalchemy import Column, Integer, String, Date, ForeignKey, Float, DateTime
from sqlalchemy.orm import relationship, Mapped, mapped_column
from datetime import datetime
from app.db.database import Base

class Vehicle(Base):
    __tablename__ = "plugin_fleet_vehicles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    
    license_plate: Mapped[str] = mapped_column(String(20), index=True)
    brand: Mapped[str] = mapped_column(String(50))
    model: Mapped[str] = mapped_column(String(50))
    vin: Mapped[str | None] = mapped_column(String(50))
    
    current_km: Mapped[float] = mapped_column(Float, default=0.0)
    
    last_service_date: Mapped[datetime | None] = mapped_column(Date)
    next_service_km: Mapped[float | None] = mapped_column(Float)
    next_stk_date: Mapped[datetime | None] = mapped_column(Date)
    
    assigned_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class VehicleLog(Base):
    __tablename__ = "plugin_fleet_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("plugin_fleet_vehicles.id", ondelete="CASCADE"), index=True)
    
    # --- ZDE BYLA CHYBA: Změněno z Mapped[int] na Mapped[int | None] ---
    driver_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    
    travel_date: Mapped[datetime] = mapped_column(Date, default=datetime.utcnow)
    start_location: Mapped[str] = mapped_column(String(100))
    end_location: Mapped[str] = mapped_column(String(100))
    
    start_km: Mapped[float] = mapped_column(Float)
    end_km: Mapped[float] = mapped_column(Float)
    
    notes: Mapped[str | None] = mapped_column(String(255))