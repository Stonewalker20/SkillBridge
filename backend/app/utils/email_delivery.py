"""SMTP-backed email delivery helpers for transactional auth emails."""

from __future__ import annotations

from email.message import EmailMessage
import smtplib
import ssl

from app.core.config import settings


def password_reset_email_enabled() -> bool:
    return bool(settings.smtp_host.strip() and settings.smtp_from_email.strip())


def send_password_reset_email(recipient_email: str, reset_url: str, username: str | None = None) -> None:
    if not password_reset_email_enabled():
        return

    sender_display = settings.smtp_from_name.strip() or "SkillBridge"
    sender_email = settings.smtp_from_email.strip()
    smtp_host = settings.smtp_host.strip()
    smtp_port = int(settings.smtp_port or 587)
    recipient_name = str(username or "").strip() or "there"

    message = EmailMessage()
    message["Subject"] = "Reset your SkillBridge password"
    message["From"] = f"{sender_display} <{sender_email}>"
    message["To"] = recipient_email
    if settings.smtp_reply_to.strip():
        message["Reply-To"] = settings.smtp_reply_to.strip()
    message.set_content(
        f"Hi {recipient_name},\n\n"
        "We received a request to reset your SkillBridge password.\n\n"
        f"Use this link to choose a new password:\n{reset_url}\n\n"
        "If you did not request this reset, you can ignore this email.\n"
        "For security, the link expires automatically.\n\n"
        f"{sender_display}"
    )
    message.add_alternative(
        (
            f"<p>Hi {recipient_name},</p>"
            "<p>We received a request to reset your SkillBridge password.</p>"
            f"<p><a href=\"{reset_url}\">Choose a new password</a></p>"
            "<p>If you did not request this reset, you can ignore this email.</p>"
            "<p>For security, the link expires automatically.</p>"
            f"<p>{sender_display}</p>"
        ),
        subtype="html",
    )

    if settings.smtp_use_ssl:
        with smtplib.SMTP_SSL(smtp_host, smtp_port, context=ssl.create_default_context(), timeout=15) as smtp:
            if settings.smtp_username.strip():
                smtp.login(settings.smtp_username.strip(), settings.smtp_password)
            smtp.send_message(message)
        return

    with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as smtp:
        if settings.smtp_use_starttls:
            smtp.starttls(context=ssl.create_default_context())
        if settings.smtp_username.strip():
            smtp.login(settings.smtp_username.strip(), settings.smtp_password)
        smtp.send_message(message)
