# backend/app/routers/smtp.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models import CompanySmtpSettings
from app.schemas.smtp import SmtpSettingsIn, SmtpSettingsOut, SmtpTestIn
from app.core.dependencies import require_admin_access
from app.services.encryption_service import encrypt_data
from app.services.email_service import send_email_async
from typing import Dict, Any

router = APIRouter(prefix="/companies/{company_id}/smtp-settings", tags=["smtp"])

async def get_settings_or_none(db: AsyncSession, company_id: int) -> CompanySmtpSettings | None:
    return await db.get(CompanySmtpSettings, company_id)

@router.get("", response_model=SmtpSettingsOut)
async def get_smtp_settings(
    company_id: int,
    db: AsyncSession = Depends(get_db),
    _ = Depends(require_admin_access)
):
    settings = await get_settings_or_none(db, company_id)
    if not settings:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SMTP settings not found.")
    
    return SmtpSettingsOut(
        **settings.__dict__,
        password_is_set=bool(settings.encrypted_password)
    )

@router.put("", response_model=SmtpSettingsOut)
async def create_or_update_smtp_settings(
    company_id: int,
    payload: SmtpSettingsIn,
    db: AsyncSession = Depends(get_db),
    _ = Depends(require_admin_access)
):
    settings = await get_settings_or_none(db, company_id)
    
    update_data = payload.dict(exclude={"smtp_password"})
    
    if not settings:
        if not payload.smtp_password:
             raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password is required for initial setup.")
        settings = CompanySmtpSettings(company_id=company_id, **update_data)
        db.add(settings)
    else:
        for key, value in update_data.items():
            setattr(settings, key, value)
            
    if payload.smtp_password:
        settings.encrypted_password = encrypt_data(payload.smtp_password.get_secret_value())

    await db.commit()
    await db.refresh(settings)

    return SmtpSettingsOut(
        **settings.__dict__,
        password_is_set=bool(settings.encrypted_password)
    )

@router.post("/test", summary="Odeslání testovacího e-mailu")
async def send_test_email(
    company_id: int,
    payload: SmtpTestIn,
    db: AsyncSession = Depends(get_db),
    token: Dict[str, Any] = Depends(require_admin_access)
):
    settings = await get_settings_or_none(db, company_id)
    if not settings or not settings.is_enabled:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="SMTP is not configured or enabled.")

    recipient = payload.recipient_email
    if not recipient:
        user_id = int(token.get("sub"))
        from app.db.models import User
        user = await db.get(User, user_id)
        if not user: raise HTTPException(404, "User not found")
        recipient = user.email

    subject = "Testovací e-mail z Appartus"
    body = f"Toto je testovací e-mail odeslaný z vaší aplikace.\n\nVaše SMTP nastavení pro hosta {settings.smtp_host} funguje správně."

    try:
        await send_email_async(
            db, company_id,
            recipient=recipient,
            subject=subject,
            body=body
        )
        return {"message": f"Test email successfully sent to {recipient}"}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to send email: {e}")