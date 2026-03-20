from sqlalchemy import Integer, String, ForeignKey, Boolean, JSON
from sqlalchemy.orm import relationship, Mapped, mapped_column
from typing import Optional

from app.db.database import Base


class ObjTechType(Base):
    __tablename__ = "plugin_obj_tech_types"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    color: Mapped[str] = mapped_column(String(50), default="bg-blue-600")

    fields: Mapped[list["ObjTechField"]] = relationship(
        back_populates="tech_type",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="ObjTechField.sort_order",
    )
    accessory_types: Mapped[list["ObjAccessoryType"]] = relationship(
        back_populates="tech_type",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class ObjTechField(Base):
    __tablename__ = "plugin_obj_tech_fields"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tech_type_id: Mapped[int] = mapped_column(
        ForeignKey("plugin_obj_tech_types.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(100))
    type: Mapped[str] = mapped_column(String(20))  # text, number, date, select
    show_in_overview: Mapped[bool] = mapped_column(Boolean, default=False)
    is_main: Mapped[bool] = mapped_column(Boolean, default=False)
    options: Mapped[Optional[list]] = mapped_column(JSON)
    inventory_param: Mapped[Optional[str]] = mapped_column(String(50))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    tech_type: Mapped["ObjTechType"] = relationship(back_populates="fields")


class ObjAccessoryType(Base):
    __tablename__ = "plugin_obj_accessory_types"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tech_type_id: Mapped[int] = mapped_column(
        ForeignKey("plugin_obj_tech_types.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(100))
    unit: Mapped[str] = mapped_column(String(20), default="ks")

    tech_type: Mapped["ObjTechType"] = relationship(back_populates="accessory_types")


class ObjSite(Base):
    __tablename__ = "plugin_obj_sites"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    address: Mapped[Optional[str]] = mapped_column(String(200))
    city: Mapped[Optional[str]] = mapped_column(String(100))
    zip: Mapped[Optional[str]] = mapped_column(String(20))
    phone: Mapped[Optional[str]] = mapped_column(String(50))
    customer_id: Mapped[Optional[int]] = mapped_column(ForeignKey("clients.id", ondelete="SET NULL"))
    contact_person: Mapped[Optional[str]] = mapped_column(String(100))
    contact_email: Mapped[Optional[str]] = mapped_column(String(200))

    technologies: Mapped[list["ObjTechInstance"]] = relationship(
        back_populates="site",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class ObjTechInstance(Base):
    __tablename__ = "plugin_obj_tech_instances"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("plugin_obj_sites.id", ondelete="CASCADE"), index=True)
    tech_type_id: Mapped[int] = mapped_column(ForeignKey("plugin_obj_tech_types.id", ondelete="RESTRICT"))

    site: Mapped["ObjSite"] = relationship(back_populates="technologies")
    tech_type: Mapped["ObjTechType"] = relationship(lazy="selectin")
    elements: Mapped[list["ObjTechElement"]] = relationship(
        back_populates="instance",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class ObjTechElement(Base):
    __tablename__ = "plugin_obj_tech_elements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    instance_id: Mapped[int] = mapped_column(
        ForeignKey("plugin_obj_tech_instances.id", ondelete="CASCADE"), index=True
    )
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    fields: Mapped[Optional[dict]] = mapped_column(JSON)
    accessories: Mapped[Optional[list]] = mapped_column(JSON)
    inventory_item_id: Mapped[Optional[int]] = mapped_column(ForeignKey("inventory_items.id", ondelete="SET NULL"))
    inventory_item_name: Mapped[Optional[str]] = mapped_column(String(255))
    inventory_item_sku: Mapped[Optional[str]] = mapped_column(String(100))
    inventory_item_manufacturer: Mapped[Optional[str]] = mapped_column(String(100))
    is_main: Mapped[bool] = mapped_column(Boolean, default=False)

    instance: Mapped["ObjTechInstance"] = relationship(back_populates="elements")
