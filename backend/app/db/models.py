from datetime import datetime
from enum import Enum
from sqlalchemy import String, Integer, ForeignKey, DateTime, Boolean, UniqueConstraint, Enum as SAEnum, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.database import Base
from sqlalchemy import Float # <-- Přidat import

class RoleEnum(str, Enum):
    owner = "owner"
    admin = "admin"
    member = "member"

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    memberships: Mapped[list["Membership"]] = relationship(back_populates="user", cascade="all, delete-orphan")

class Company(Base):
    __tablename__ = "companies"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    logo_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    members: Mapped[list["Membership"]] = relationship(back_populates="company", cascade="all, delete-orphan")

class Membership(Base):
    __tablename__ = "memberships"
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), primary_key=True)
    role: Mapped[RoleEnum] = mapped_column(SAEnum(RoleEnum), default=RoleEnum.member)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="memberships")
    company: Mapped["Company"] = relationship(back_populates="members")

class Invite(Base):
    __tablename__ = "invites"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    email: Mapped[str] = mapped_column(String(255), index=True)
    role: Mapped[RoleEnum] = mapped_column(SAEnum(RoleEnum), default=RoleEnum.member)
    token: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (UniqueConstraint("company_id", "email", name="uq_invite_company_email"),)

class InventoryCategory(Base):
    __tablename__ = "inventory_categories"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("inventory_categories.id"), nullable=True)
    
    parent: Mapped["InventoryCategory"] = relationship(remote_side=[id], back_populates="children")
    children: Mapped[list["InventoryCategory"]] = relationship(back_populates="parent", cascade="all, delete-orphan")
    
    __table_args__ = (UniqueConstraint("company_id", "name", "parent_id", name="uq_category_company_name_parent"),)

class InventoryItem(Base):
    __tablename__ = "inventory_items"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    category_id: Mapped[int | None] = mapped_column(ForeignKey("inventory_categories.id", ondelete="SET NULL"), nullable=True, index=True)
        # --- NOVÉ SLOUPCE ---
    ean: Mapped[str | None] = mapped_column(String(13), nullable=True, index=True)
    image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    price: Mapped[float | None] = mapped_column(Float, nullable=True)
    vat_rate: Mapped[float | None] = mapped_column(Float, nullable=True, comment="Sazba DPH v procentech, např. 21.0")
    # --- KONEC NOVÝCH SLOUPCŮ ---
    name: Mapped[str] = mapped_column(String(255))
    sku: Mapped[str] = mapped_column(String(100), index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    category: Mapped["InventoryCategory"] = relationship()
    
    __table_args__ = (UniqueConstraint("company_id", "sku", name="uq_inventory_item_company_sku"),)


class Client(Base):
    """Reprezentuje klienta/zákazníka patřícího jedné firmě."""
    __tablename__ = "clients"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    
    name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (UniqueConstraint("company_id", "name", name="uq_client_company_name"),)

class AuditLogAction(str, Enum):
    created = "created"
    updated = "updated"
    deleted = "deleted"
    quantity_adjusted = "quantity_adjusted"

class InventoryAuditLog(Base):
    __tablename__ = "inventory_audit_logs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    item_id: Mapped[int | None] = mapped_column(ForeignKey("inventory_items.id", ondelete="SET NULL"), nullable=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    
    action: Mapped[AuditLogAction] = mapped_column(SAEnum(AuditLogAction))
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

class WorkType(Base):
    """Definuje druh práce a jeho sazbu pro danou společnost."""
    __tablename__ = "work_types"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    rate: Mapped[float] = mapped_column(Float, comment="Sazba za hodinu")
    
    __table_args__ = (UniqueConstraint("company_id", "name", name="uq_work_type_company_name"),)

class WorkOrder(Base):
    """Reprezentuje zakázku nebo projekt."""
    __tablename__ = "work_orders"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    
    # --- NOVÝ SLOUPEC ---
    client_id: Mapped[int | None] = mapped_column(ForeignKey("clients.id", ondelete="SET NULL"), nullable=True, index=True)
    
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50), default="new", index=True) # např. new, in_progress, completed, billed
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    tasks: Mapped[list["Task"]] = relationship(back_populates="work_order", cascade="all, delete-orphan")
    
    # --- NOVÝ VZTAH ---
    client: Mapped["Client"] = relationship()

class Task(Base):
    """Reprezentuje konkrétní úkol v rámci zakázky."""
    __tablename__ = "tasks"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    work_order_id: Mapped[int] = mapped_column(ForeignKey("work_orders.id", ondelete="CASCADE"), index=True)
    assignee_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True) # Kdo na úkolu pracuje
    
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50), default="todo", index=True) # např. todo, in_progress, done, approved
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    work_order: Mapped["WorkOrder"] = relationship(back_populates="tasks")
    assignee: Mapped["User"] = relationship()
    time_logs: Mapped[list["TimeLog"]] = relationship(cascade="all, delete-orphan")
    used_items: Mapped[list["UsedInventoryItem"]] = relationship(cascade="all, delete-orphan")

class TimeLog(Base):
    """Záznam odpracovaného času na úkolu."""
    __tablename__ = "time_logs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True) # Kdo práci vykonal
    work_type_id: Mapped[int] = mapped_column(ForeignKey("work_types.id"))
    
    hours: Mapped[float] = mapped_column(Float)
    log_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    user: Mapped["User"] = relationship()
    work_type: Mapped["WorkType"] = relationship()

class UsedInventoryItem(Base):
    """Záznam o materiálu použitém na úkolu."""
    __tablename__ = "used_inventory_items"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), index=True)
    inventory_item_id: Mapped[int] = mapped_column(ForeignKey("inventory_items.id"), index=True)
    
    quantity: Mapped[int] = mapped_column(Integer)
    log_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    inventory_item: Mapped["InventoryItem"] = relationship()