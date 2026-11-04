"""Outgoing email. Every message is written to the email_outbox table; the 'console' backend also logs it
(development), the 'smtp' backend delivers it."""
import logging
import smtplib
from email.message import EmailMessage

from sqlalchemy.orm import Session

from .config import get_settings
from .models import EmailOutbox
from .security import utcnow

log = logging.getLogger("dr.email")


def send_email(db: Session, to: str, subject: str, body: str) -> EmailOutbox:
    s = get_settings()
    msg = EmailOutbox(to_address=to, subject=subject, body=body)
    db.add(msg)
    if s.email_backend == "smtp" and s.smtp_host:
        try:
            em = EmailMessage()
            em["From"], em["To"], em["Subject"] = s.smtp_from, to, subject
            em.set_content(body)
            with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=10) as smtp:
                smtp.starttls()
                if s.smtp_user:
                    smtp.login(s.smtp_user, s.smtp_password or "")
                smtp.send_message(em)
            msg.sent_at = utcnow()
        except Exception as exc:  # noqa: BLE001
            msg.error = str(exc)[:500]
            log.error("SMTP delivery failed: %s", exc)
    else:
        log.warning("EMAIL (console backend) to=%s subject=%s\n%s", to, subject, body)
    db.commit()
    return msg
