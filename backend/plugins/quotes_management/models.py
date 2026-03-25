from datetime import datetime, timezone
from sqlalchemy import Integer, String, ForeignKey, Boolean, JSON, Float, Text, DateTime
from sqlalchemy.orm import relationship, Mapped, mapped_column
from typing import Optional

from app.db.database import Base


def now_utc():
    return datetime.now(timezone.utc)


class Quote(Base):
    __tablename__ = "plugin_quotes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    site_id: Mapped[Optional[int]] = mapped_column(ForeignKey("plugin_obj_sites.id", ondelete="SET NULL"), index=True)
    parent_quote_id: Mapped[Optional[int]] = mapped_column(ForeignKey("plugin_quotes.id", ondelete="SET NULL"), index=True)

    name: Mapped[str] = mapped_column(String(300))
    status: Mapped[str] = mapped_column(String(30), default="draft")  # draft, sent, accepted, rejected
    customer_id: Mapped[Optional[int]] = mapped_column(ForeignKey("clients.id", ondelete="SET NULL"))

    # Global settings (Cenotvorba)
    prepared_by: Mapped[Optional[str]] = mapped_column(String(200))
    prepared_by_phone: Mapped[Optional[str]] = mapped_column(String(50))
    validity_days: Mapped[int] = mapped_column(Integer, default=14)
    currency: Mapped[str] = mapped_column(String(10), default="CZK")
    vat_rate: Mapped[float] = mapped_column(Float, default=21.0)
    global_discount: Mapped[float] = mapped_column(Float, default=0.0)
    global_discount_type: Mapped[str] = mapped_column(String(10), default="percent")  # percent | amount
    global_hourly_rate: Mapped[float] = mapped_column(Float, default=0.0)
    notes: Mapped[Optional[str]] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    sections: Mapped[list["QuoteSection"]] = relationship(
        back_populates="quote",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="QuoteSection.sort_order",
    )
    category_assemblies: Mapped[list["QuoteCategoryAssembly"]] = relationship(
        back_populates="quote",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    sub_quotes: Mapped[list["Quote"]] = relationship(
        foreign_keys=[parent_quote_id],
        lazy="noload",
        cascade="all, delete-orphan",
    )


class QuoteSection(Base):
    __tablename__ = "plugin_quote_sections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    quote_id: Mapped[int] = mapped_column(ForeignKey("plugin_quotes.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    prefix: Mapped[Optional[str]] = mapped_column(String(20))  # e.g. "EL", "CCTV"
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_extras: Mapped[bool] = mapped_column(Boolean, default=False)  # Vícepráce

    quote: Mapped["Quote"] = relationship(back_populates="sections")
    items: Mapped[list["QuoteItem"]] = relationship(
        back_populates="section",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="QuoteItem.sort_order",
    )


class QuoteItem(Base):
    __tablename__ = "plugin_quote_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    section_id: Mapped[int] = mapped_column(ForeignKey("plugin_quote_sections.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(500))
    unit: Mapped[str] = mapped_column(String(20), default="ks")
    quantity: Mapped[float] = mapped_column(Float, default=1.0)
    material_price: Mapped[float] = mapped_column(Float, default=0.0)   # per unit
    assembly_price: Mapped[float] = mapped_column(Float, default=0.0)   # per unit
    inventory_item_id: Mapped[Optional[int]] = mapped_column(ForeignKey("inventory_items.id", ondelete="SET NULL"))
    inventory_category_name: Mapped[Optional[str]] = mapped_column(String(200))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_reduced_work: Mapped[bool] = mapped_column(Boolean, default=False)  # Méněpráce

    section: Mapped["QuoteSection"] = relationship(back_populates="items")


class QuoteCategoryAssembly(Base):
    """Per-category assembly price – auto-populated from items' categories."""
    __tablename__ = "plugin_quote_category_assemblies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    quote_id: Mapped[int] = mapped_column(ForeignKey("plugin_quotes.id", ondelete="CASCADE"), index=True)
    category_name: Mapped[str] = mapped_column(String(200))
    assembly_price_per_unit: Mapped[float] = mapped_column(Float, default=0.0)

    quote: Mapped["Quote"] = relationship(back_populates="category_assemblies")
