from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.database import get_db
from app.db.models import ServiceReport, WorkOrder, Task
from app.schemas.service_report import ServiceReportCreateIn, ServiceReportOut
from app.core.dependencies import require_company_access

router = APIRouter(prefix="/companies/{company_id}/service-reports", tags=["service-reports"])


def _enrich(sr: ServiceReport) -> ServiceReportOut:
    out = ServiceReportOut.model_validate(sr)
    out.task_name = sr.task.name if sr.task else None
    out.work_order_name = sr.work_order.name if sr.work_order else None
    return out


@router.post("", response_model=ServiceReportOut, status_code=status.HTTP_201_CREATED)
async def create_service_report(
    company_id: int,
    payload: ServiceReportCreateIn,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access),
):
    # Ověření, že work_order patří do firmy
    wo = await db.get(WorkOrder, payload.work_order_id)
    if not wo or wo.company_id != company_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Work order not found in this company.")

    # Ověření, že task patří do work_order
    task = await db.get(Task, payload.task_id)
    if not task or task.work_order_id != payload.work_order_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found in this work order.")

    sr = ServiceReport(
        company_id=company_id,
        work_order_id=payload.work_order_id,
        task_id=payload.task_id,
        date=payload.date,
        technicians=payload.technicians,
        arrival_time=payload.arrival_time,
        work_hours=payload.work_hours,
        km_driven=payload.km_driven,
        work_description=payload.work_description,
        is_warranty_repair=payload.is_warranty_repair,
        materials_used=payload.materials_used,
        notes=payload.notes,
        work_type=payload.work_type,
        photos=payload.photos,
        technician_signature=payload.technician_signature,
        customer_signature=payload.customer_signature,
    )
    db.add(sr)
    await db.commit()
    await db.refresh(sr)

    stmt = (
        select(ServiceReport)
        .where(ServiceReport.id == sr.id)
        .options(selectinload(ServiceReport.task), selectinload(ServiceReport.work_order))
    )
    sr = (await db.execute(stmt)).scalar_one()
    return _enrich(sr)


@router.get("", response_model=List[ServiceReportOut])
async def list_service_reports(
    company_id: int,
    task_id: Optional[int] = None,
    work_order_id: Optional[int] = None,
    object_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access),
):
    stmt = (
        select(ServiceReport)
        .where(ServiceReport.company_id == company_id)
        .options(selectinload(ServiceReport.task), selectinload(ServiceReport.work_order))
        .order_by(ServiceReport.date.desc(), ServiceReport.created_at.desc())
    )

    if task_id is not None:
        stmt = stmt.where(ServiceReport.task_id == task_id)
    if work_order_id is not None:
        stmt = stmt.where(ServiceReport.work_order_id == work_order_id)
    if object_id is not None:
        stmt = stmt.join(WorkOrder, ServiceReport.work_order_id == WorkOrder.id).where(
            WorkOrder.object_id == object_id
        )

    results = (await db.execute(stmt)).scalars().all()
    return [_enrich(sr) for sr in results]


@router.get("/{report_id}", response_model=ServiceReportOut)
async def get_service_report(
    company_id: int,
    report_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access),
):
    stmt = (
        select(ServiceReport)
        .where(ServiceReport.id == report_id, ServiceReport.company_id == company_id)
        .options(selectinload(ServiceReport.task), selectinload(ServiceReport.work_order))
    )
    sr = (await db.execute(stmt)).scalar_one_or_none()
    if not sr:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Service report not found.")
    return _enrich(sr)


@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_service_report(
    company_id: int,
    report_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_company_access),
):
    sr = await db.get(ServiceReport, report_id)
    if not sr or sr.company_id != company_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Service report not found.")
    await db.delete(sr)
    await db.commit()
