"""
Transactional email: the messages the platform sends on its own behalf.

Distinct from campaign mail, which goes out through each workspace's own
mailbox so replies reach the customer. These come from the platform, so they
use the platform SMTP settings and say plainly who is writing and why.

If no SMTP host is configured the provider layer records the message instead
of sending it, and `send_*` reports that it was not delivered. The caller must
not claim an email was sent when it was not - a user staring at an inbox that
will never receive anything is worse than being told the address is unset.
"""

import logging

from app.core.config import Settings
from app.providers.email import get_email_provider, smtp_is_configured

logger = logging.getLogger("leadforge.email.transactional")

PRODUCT_NAME = "LeadForge"


def _app_url(settings: Settings) -> str:
    """Where the links in these emails should point.

    The first CORS origin is the deployed frontend, which is the same place a
    user clicking a link needs to land.
    """
    origins = settings.cors_origins or []
    return (origins[0] if origins else "http://localhost:3000").rstrip("/")


def _signature() -> str:
    return (
        f"\n\n—\n{PRODUCT_NAME}\n"
        "Find businesses that are ready for a better website.\n"
    )


def send_verification_email(settings: Settings, to: str, full_name: str | None, token: str) -> bool:
    """Confirm a newly registered address. Returns whether it was delivered."""
    link = f"{_app_url(settings)}/verify-email?token={token}"
    greeting = f"Hi {full_name.split()[0]}," if full_name else "Hi,"

    body = (
        f"{greeting}\n\n"
        f"Thanks for creating your {PRODUCT_NAME} workspace. Please confirm this "
        "email address so we know we can reach you:\n\n"
        f"{link}\n\n"
        "The link works for the next three days. If you did not create this "
        "account, you can ignore this message and nothing further will happen."
        f"{_signature()}"
    )
    return _send(settings, to, f"Confirm your {PRODUCT_NAME} email address", body)


def send_password_reset_email(settings: Settings, to: str, full_name: str | None, token: str) -> bool:
    link = f"{_app_url(settings)}/reset-password?token={token}"
    greeting = f"Hi {full_name.split()[0]}," if full_name else "Hi,"

    body = (
        f"{greeting}\n\n"
        f"We received a request to reset the password for your {PRODUCT_NAME} "
        "account. You can choose a new one here:\n\n"
        f"{link}\n\n"
        "This link expires in one hour and can only be used once.\n\n"
        "If you did not request this, no action is needed — your password has "
        "not changed, and the link above will expire on its own."
        f"{_signature()}"
    )
    return _send(settings, to, f"Reset your {PRODUCT_NAME} password", body)


def send_password_changed_email(settings: Settings, to: str, full_name: str | None) -> bool:
    """Tell someone their password changed.

    Sent after the fact and deliberately not suppressible: if the change was
    not theirs, this is the only warning they get.
    """
    greeting = f"Hi {full_name.split()[0]}," if full_name else "Hi,"
    body = (
        f"{greeting}\n\n"
        f"The password on your {PRODUCT_NAME} account was just changed.\n\n"
        "If that was you, there is nothing to do.\n\n"
        "If it was not, reset your password immediately at "
        f"{_app_url(settings)}/forgot-password and check who has access to "
        "this mailbox."
        f"{_signature()}"
    )
    return _send(settings, to, f"Your {PRODUCT_NAME} password was changed", body)


def _send(settings: Settings, to: str, subject: str, body: str) -> bool:
    provider = get_email_provider(settings)
    try:
        result = provider.send(to=to, subject=subject, body=body)
    except Exception as exc:  # noqa: BLE001 - a mail failure must not fail registration
        logger.warning("Transactional email to %s failed: %s", to, exc)
        return False

    # The recording provider accepts everything - that is how it exercises the
    # pipeline without sending. Accepted therefore means "handled", not
    # "delivered", and only a configured SMTP host makes it the latter.
    delivered = bool(getattr(result, "accepted", False)) and smtp_is_configured(settings)
    if not delivered:
        # Loud, because the usual cause is that SMTP was never configured and
        # every verification and reset link is silently going nowhere.
        logger.warning(
            "Transactional email to %s was not delivered (subject: %r). "
            "Check SMTP_HOST / SMTP_USERNAME / SMTP_PASSWORD.",
            to,
            subject,
        )
    return delivered
