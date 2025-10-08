# backend/app/services/email_service.py
import aiosmtplib
from email.message import EmailMessage
from sqlalchemy.ext.asyncio import AsyncSession
import logging

from app.db.models import CompanySmtpSettings, SecurityProtocolEnum
from app.services.encryption_service import decrypt_data

logger = logging.getLogger(__name__)

async def send_email_async(
    db: AsyncSession,
    company_id: int,
    recipient: str,
    subject: str,
    body: str,
):
    """
    Nízkoúrovňová funkce pro odeslání e-mailu pomocí nastavení dané firmy.
    """
    settings = await db.get(CompanySmtpSettings, company_id)
    if not settings or not settings.is_enabled:
        logger.warning(f"Attempted to send email for company {company_id}, but SMTP is disabled or not configured.")
        return

    password = decrypt_data(settings.encrypted_password)
    if not password:
        logger.error(f"SMTP password for company {company_id} could not be decrypted.")
        raise ValueError("SMTP password decryption failed.")

    message = EmailMessage()
    message["From"] = settings.sender_email
    message["To"] = recipient
    message["Subject"] = subject
    message.set_content(body)

    # --- OPRAVENÁ LOGIKA ---
    # use_tls se použije pro implicitní SSL (typicky port 465)
    use_tls = settings.security_protocol == SecurityProtocolEnum.SSL
    # start_tls se použije pro explicitní STARTTLS (typicky port 587)
    start_tls = settings.security_protocol == SecurityProtocolEnum.TLS
    
    # Protokol "none" nebude mít ani jedno nastaveno na True
    
    await aiosmtplib.send(
        message,
        hostname=settings.smtp_host,
        port=settings.smtp_port,
        username=settings.smtp_user,
        password=password,
        use_tls=use_tls,
        start_tls=start_tls
    )
    # --- KONEC OPRAVENÉ LOGIKY ---

async def send_transactional_email(
    db: AsyncSession,
    company_id: int,
    notification_type: str, # např. "on_invite_created"
    recipient: str,
    subject: str,
    body: str,
):
    """
    Vysokoúrovňová funkce, která nejprve ověří, zda má firma daný typ notifikace povolený.
    """
    settings = await db.get(CompanySmtpSettings, company_id)
    if not settings or not settings.is_enabled:
        return # SMTP je vypnuto, nic neodesíláme

    if settings.notification_settings.get(notification_type, False):
        try:
            await send_email_async(db, company_id, recipient, subject, body)
            logger.info(f"Email '{notification_type}' sent to {recipient} for company {company_id}.")
        except Exception as e:
            logger.error(f"Failed to send email '{notification_type}' for company {company_id}: {e}")
    else:
        logger.info(f"Skipping email '{notification_type}' for company {company_id} as it is disabled in settings.")