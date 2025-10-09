from datetime import datetime, timezone, timedelta
from enum import Enum
from sqlalchemy import (
    String, Integer, ForeignKey, DateTime, Boolean,
    UniqueConstraint, Enum as SAEnum, Text, Float, Date, TIMESTAMP, JSON,
    # --- PŘIDANÉ IMPORTY ---
    Table, Column
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.database import Base

# --- Pomocná funkce pro výchozí čas v UTC ---
def now_utc():
    return datetime.now(timezone.utc)

# --- NOVÁ PROPOJOVACÍ TABULKA PRO OPRÁVNĚNÍ ---
location_permissions = Table(
    "location_permissions",
    Base.metadata,
    Column("location_id", Integer, ForeignKey("locations.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)


# --- Enumy ---
class RoleEnum(str, Enum):
    owner = "owner"
    admin = "admin"
    member = "member"

class AuditLogAction(str, Enum):
    created = "created"
    updated = "updated"
    deleted = "deleted"
    quantity_adjusted = "quantity_adjusted"
    # --- NOVÉ AKCE PRO LOKACE ---
    location_placed = "location_placed"
    location_withdrawn = "location_withdrawn"
    location_transferred = "location_transferred"


class TimeLogStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"

class TimeLogEntryType(str, Enum):
    WORK = "work"
    VACATION = "vacation"
    SICK_DAY = "sick_day"
    DOCTOR = "doctor"
    UNPAID_LEAVE = "unpaid_leave"


class TriggerType(str, Enum):
    WORK_ORDER_BUDGET = "work_order_budget"
    INVENTORY_LOW_STOCK = "inventory_low_stock"

class TriggerCondition(str, Enum):
    PERCENTAGE_REACHED = "percentage_reached"
    QUANTITY_BELOW = "quantity_below"


# --- Modely ---
class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=now_utc)
    memberships: Mapped[list["Membership"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    # --- OPRAVENÝ VZTAH K LOKACÍM ---
    authorized_locations: Mapped[list["Location"]] = relationship(
        secondary=location_permissions,
        # 'back_populates' je nahrazeno 'backref', které automaticky vytvoří
        # vlastnost 'authorized_users' na modelu Location.
        backref="authorized_users"
    )

class Company(Base):
    __tablename__ = "companies"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    logo_url: Mapped[str | None] = mapped_column(String(512))
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=now_utc)
    legal_name: Mapped[str | None] = mapped_column(String(255))
    address: Mapped[str | None] = mapped_column(Text)
    ico: Mapped[str | None] = mapped_column(String(20), index=True)
    dic: Mapped[str | None] = mapped_column(String(20), index=True)
    executive: Mapped[str | None] = mapped_column(String(255))
    bank_account: Mapped[str | None] = mapped_column(String(50))
    iban: Mapped[str | None] = mapped_column(String(50))
    members: Mapped[list["Membership"]] = relationship(back_populates="company", cascade="all, delete-orphan")
    smtp_settings: Mapped["CompanySmtpSettings"] = relationship(back_populates="company", cascade="all, delete-orphan")

class Membership(Base):
    __tablename__ = "memberships"
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), primary_key=True)
    role: Mapped[RoleEnum] = mapped_column(SAEnum(RoleEnum), default=RoleEnum.member)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=now_utc)
    user: Mapped["User"] = relationship(back_populates="memberships")
    company: Mapped["Company"] = relationship(back_populates="members")

class Invite(Base):
    __tablename__ = "invites"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    email: Mapped[str] = mapped_column(String(255), index=True)
    role: Mapped[RoleEnum] = mapped_column(SAEnum(RoleEnum), default=RoleEnum.member)
    token: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True))
    accepted_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=now_utc)
    __table_args__ = (UniqueConstraint("company_id", "email", name="uq_invite_company_email"),)

class Client(Base):
    __tablename__ = "clients"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(50))
    address: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=now_utc)
    legal_name: Mapped[str | None] = mapped_column(String(255))
    contact_person: Mapped[str | None] = mapped_column(String(255))
    ico: Mapped[str | None] = mapped_column(String(20), index=True)
    dic: Mapped[str | None] = mapped_column(String(20), index=True)
    __table_args__ = (UniqueConstraint("company_id", "name", name="uq_client_company_name"),)

class InventoryCategory(Base):
    __tablename__ = "inventory_categories"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("inventory_categories.id"))
    parent: Mapped["InventoryCategory"] = relationship(remote_side=[id], back_populates="children")
    children: Mapped[list["InventoryCategory"]] = relationship(back_populates="parent", cascade="all, delete-orphan")
    __table_args__ = (UniqueConstraint("company_id", "name", "parent_id", name="uq_category_company_name_parent"),)

class InventoryItem(Base):
    __tablename__ = "inventory_items"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    category_id: Mapped[int | None] = mapped_column(ForeignKey("inventory_categories.id", ondelete="SET NULL"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    sku: Mapped[str] = mapped_column(String(100), index=True)
    ean: Mapped[str | None] = mapped_column(String(13), index=True)
    image_url: Mapped[str | None] = mapped_column(String(512))
    price: Mapped[float | None] = mapped_column(Float)
    vat_rate: Mapped[float | None] = mapped_column(Float)
    description: Mapped[str | None] = mapped_column(Text)
    is_monitored_for_stock: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0", index=True)
    low_stock_threshold: Mapped[int | None] = mapped_column(Integer)
    low_stock_alert_sent: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=now_utc, onupdate=now_utc)
    category: Mapped["InventoryCategory"] = relationship()
    locations: Mapped[list["ItemLocationStock"]] = relationship(back_populates="inventory_item", cascade="all, delete-orphan")
    __table_args__ = (UniqueConstraint("company_id", "sku", name="uq_inventory_item_company_sku"),)

class Location(Base):
    __tablename__ = "locations"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    # Vlastnost `authorized_users` bude automaticky vytvořena pomocí `backref`
    # z modelu User.
    __table_args__ = (UniqueConstraint("company_id", "name", name="uq_location_company_name"),)

class ItemLocationStock(Base):
    __tablename__ = "item_location_stock"
    inventory_item_id: Mapped[int] = mapped_column(ForeignKey("inventory_items.id", ondelete="CASCADE"), primary_key=True)
    location_id: Mapped[int] = mapped_column(ForeignKey("locations.id", ondelete="CASCADE"), primary_key=True)
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    inventory_item: Mapped["InventoryItem"] = relationship(back_populates="locations")
    location: Mapped["Location"] = relationship()

class InventoryAuditLog(Base):
    __tablename__ = "inventory_audit_logs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    item_id: Mapped[int | None] = mapped_column(ForeignKey("inventory_items.id", ondelete="SET NULL"))
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    action: Mapped[AuditLogAction] = mapped_column(SAEnum(AuditLogAction))
    details: Mapped[str | None] = mapped_column(Text)
    timestamp: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=now_utc, index=True)
    user: Mapped["User"] = relationship()
    inventory_item: Mapped["InventoryItem"] = relationship()

class WorkType(Base):
    __tablename__ = "work_types"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    rate: Mapped[float] = mapped_column(Float)
    __table_args__ = (UniqueConstraint("company_id", "name", name="uq_work_type_company_name"),)

class WorkOrder(Base):
    __tablename__ = "work_orders"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    client_id: Mapped[int | None] = mapped_column(ForeignKey("clients.id", ondelete="SET NULL"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50), default="new", index=True)
    budget_hours: Mapped[float | None] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=now_utc)
    budget_alert_sent: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    tasks: Mapped[list["Task"]] = relationship(back_populates="work_order", cascade="all, delete-orphan")
    client: Mapped["Client"] = relationship()

class Task(Base):
    __tablename__ = "tasks"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    work_order_id: Mapped[int] = mapped_column(ForeignKey("work_orders.id", ondelete="CASCADE"), index=True)
    assignee_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50), default="todo", index=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=now_utc)
    work_order: Mapped["WorkOrder"] = relationship(back_populates="tasks")
    assignee: Mapped["User"] = relationship()
    time_logs: Mapped[list["TimeLog"]] = relationship(back_populates="task", cascade="all, delete-orphan")
    used_items: Mapped[list["UsedInventoryItem"]] = relationship(back_populates="task", cascade="all, delete-orphan")

class TimeLog(Base):
    __tablename__ = "time_logs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    entry_type: Mapped[TimeLogEntryType] = mapped_column(SAEnum(TimeLogEntryType), default=TimeLogEntryType.WORK)
    task_id: Mapped[int | None] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), index=True)
    work_type_id: Mapped[int | None] = mapped_column(ForeignKey("work_types.id"))
    start_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), index=True)
    end_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True))
    break_duration_minutes: Mapped[int] = mapped_column(Integer, default=0)
    is_overtime: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[TimeLogStatus] = mapped_column(SAEnum(TimeLogStatus), default=TimeLogStatus.pending, index=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=now_utc)
    user: Mapped["User"] = relationship()
    work_type: Mapped["WorkType"] = relationship()
    task: Mapped["Task"] = relationship(back_populates="time_logs")

class UsedInventoryItem(Base):
    __tablename__ = "used_inventory_items"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), index=True)
    inventory_item_id: Mapped[int] = mapped_column(ForeignKey("inventory_items.id"), index=True)
    quantity: Mapped[int] = mapped_column(Integer)
    log_date: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=now_utc)
    from_location_id: Mapped[int | None] = mapped_column(ForeignKey("locations.id", ondelete="SET NULL"))
    inventory_item: Mapped["InventoryItem"] = relationship()
    task: Mapped["Task"] = relationship(back_populates="used_items")
    from_location: Mapped["Location"] = relationship()


class SecurityProtocolEnum(str, Enum):
    NONE = "none"
    TLS = "tls"
    SSL = "ssl"

class CompanySmtpSettings(Base):
    __tablename__ = "company_smtp_settings"
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), primary_key=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    smtp_host: Mapped[str] = mapped_column(String(255))
    smtp_port: Mapped[int] = mapped_column(Integer)
    smtp_user: Mapped[str] = mapped_column(String(255))
    encrypted_password: Mapped[str] = mapped_column(String(512)) # Šifrované heslo
    sender_email: Mapped[str] = mapped_column(String(255))
    security_protocol: Mapped[SecurityProtocolEnum] = mapped_column(SAEnum(SecurityProtocolEnum), default=SecurityProtocolEnum.TLS)
    
    notification_settings: Mapped[dict] = mapped_column(JSON, default=lambda: {})
    
    company: Mapped["Company"] = relationship(back_populates="smtp_settings")
    
class NotificationTrigger(Base):
    __tablename__ = "notification_triggers"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    trigger_type: Mapped[TriggerType] = mapped_column(SAEnum(TriggerType))
    condition: Mapped[TriggerCondition] = mapped_column(SAEnum(TriggerCondition))
    
    threshold_value: Mapped[float] = mapped_column(Float)
    
    recipient_emails: Mapped[list[str]] = mapped_column(JSON)
    
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=now_utc)
    
    __table_args__ = (
        UniqueConstraint('company_id', 'trigger_type', name='uq_company_trigger_type'),
    )