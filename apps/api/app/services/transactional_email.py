"""
Transactional email: the messages the platform sends on its own behalf.

Distinct from campaign mail, which goes out through each workspace\'s own
mailbox so replies reach the customer. These come from the platform, so they
use the platform SMTP settings and say plainly who is writing and why.

If no SMTP host is configured the provider layer records the message instead
of sending it, and `send_*` reports that it was not delivered. The caller must
not claim an email was sent when it was not - a user staring at an inbox that
will never receive anything is worse than being told the address is unset.
"""

import logging
from datetime import datetime, timezone

from app.core.config import Settings
from app.providers.email import get_email_provider, smtp_is_configured

logger = logging.getLogger("leadforge.email.transactional")

PRODUCT_NAME = "LeadForge"


def _app_url(settings: Settings) -> str:
    """Where the links in these emails should point."""
    origins = settings.cors_origins or []
    return (origins[0] if origins else "http://localhost:3000").rstrip("/")


def _html_wrapper(content: str) -> str:
    """Wrap email content in a branded HTML template."""
    return (
        '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1.0"></head>'
        '<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;">'
        '<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:40px 20px;">'
        '<tr><td align="center">'
        '<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">'
        '<tr><td style="padding:0 0 32px 0;text-align:center;">'
        '<span style="font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Lead<span style="color:#a78bfa;">Forge</span></span>'
        '</td></tr>'
        '<tr><td style="background-color:#111111;border:1px solid #1e1e1e;border-radius:12px;padding:32px;">'
        + content +
        '</td></tr>'
        '<tr><td style="padding:24px 0;text-align:center;">'
        '<p style="margin:0;font-size:12px;color:#555555;">LeadForge &mdash; Find businesses that are ready for a better website.</p>'
        '</td></tr>'
        '</table></td></tr></table>'
        '</body></html>'
    )


def _text_footer() -> str:
    return f"\n\n\u2014\n{PRODUCT_NAME}\nFind businesses that are ready for a better website.\n"


def _unsubscribe_footer_html(unsubscribe_url: str) -> str:
    return (
        '<p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #1e1e1e;font-size:11px;color:#555555;">'
        f'<a href="{unsubscribe_url}" style="color:#777777;text-decoration:underline;">Unsubscribe</a>'
        ' from all marketing emails.</p>'
    )


def _unsubscribe_footer_text(unsubscribe_url: str) -> str:
    return f"\n\nUnsubscribe from all marketing emails: {unsubscribe_url}"


# ---------------------------------------------------------------------------
# Password reset
# ---------------------------------------------------------------------------

def send_password_reset_email(settings: Settings, to: str, full_name: str | None, token: str) -> bool:
    link = f"{_app_url(settings)}/reset-password?token={token}"
    greeting = f"Hi {full_name.split()[0]}," if full_name else "Hi,"

    text_body = (
        f"{greeting}\n\n"
        f"We received a request to reset the password for your {PRODUCT_NAME} "
        "account. You can choose a new one here:\n\n"
        f"{link}\n\n"
        "This link expires in one hour and can only be used once.\n\n"
        "If you did not request this, no action is needed \u2014 your password has "
        "not changed, and the link above will expire on its own."
        f"{_text_footer()}"
    )

    html_body = _html_wrapper(
        f'<p style="margin:0 0 20px;color:#cccccc;font-size:15px;">{greeting}</p>'
        f'<p style="margin:0 0 20px;color:#cccccc;font-size:15px;">'
        f'We received a request to reset the password for your <strong style="color:#ffffff;">{PRODUCT_NAME}</strong> account. '
        'Choose a new one here:</p>'
        f'<p style="margin:0 0 20px;"><a href="{link}" style="display:inline-block;background-color:#a78bfa;color:#0a0a0a;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:15px;">Reset password</a></p>'
        '<p style="margin:0 0 12px;color:#888888;font-size:13px;">This link expires in one hour and can only be used once.</p>'
        '<p style="margin:0;color:#888888;font-size:13px;">If you did not request this, no action is needed \u2014 your password has not changed.</p>'
    )

    return _send(settings, to, f"Reset your {PRODUCT_NAME} password", text_body, html=html_body)


# ---------------------------------------------------------------------------
# Password changed notification
# ---------------------------------------------------------------------------

def send_password_changed_email(settings: Settings, to: str, full_name: str | None) -> bool:
    """Tell someone their password changed.

    Sent after the fact and deliberately not suppressible: if the change was
    not theirs, this is the only warning they get.
    """
    greeting = f"Hi {full_name.split()[0]}," if full_name else "Hi,"

    text_body = (
        f"{greeting}\n\n"
        f"The password on your {PRODUCT_NAME} account was just changed.\n\n"
        "If that was you, there is nothing to do.\n\n"
        "If it was not, reset your password immediately at "
        f"{_app_url(settings)}/forgot-password and check who has access to "
        "this mailbox."
        f"{_text_footer()}"
    )

    html_body = _html_wrapper(
        f'<p style="margin:0 0 20px;color:#cccccc;font-size:15px;">{greeting}</p>'
        f'<p style="margin:0 0 20px;color:#cccccc;font-size:15px;">The password on your <strong style="color:#ffffff;">{PRODUCT_NAME}</strong> account was just changed.</p>'
        '<p style="margin:0 0 12px;color:#888888;font-size:13px;">If that was you, there is nothing to do.</p>'
        '<p style="margin:0 0 20px;color:#888888;font-size:13px;">If it was not, reset your password immediately:</p>'
        f'<p style="margin:0;"><a href="{_app_url(settings)}/forgot-password" style="display:inline-block;background-color:#ef4444;color:#ffffff;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:15px;">Reset password</a></p>'
    )

    return _send(settings, to, f"Your {PRODUCT_NAME} password was changed", text_body, html=html_body)


# ---------------------------------------------------------------------------
# Email verification
# ---------------------------------------------------------------------------

def send_verification_email(settings: Settings, to: str, full_name: str | None, token: str) -> bool:
    """Confirm a newly registered address. Returns whether it was delivered."""
    link = f"{_app_url(settings)}/verify-email?token={token}"
    greeting = f"Hi {full_name.split()[0]}," if full_name else "Hi,"

    text_body = (
        f"{greeting}\n\n"
        f"Thanks for creating your {PRODUCT_NAME} workspace. Please confirm this "
        "email address so we know we can reach you:\n\n"
        f"{link}\n\n"
        "The link works for the next three days. If you did not create this "
        "account, you can ignore this message and nothing further will happen."
        f"{_text_footer()}"
    )

    html_body = _html_wrapper(
        f'<p style="margin:0 0 20px;color:#cccccc;font-size:15px;">{greeting}</p>'
        f'<p style="margin:0 0 20px;color:#cccccc;font-size:15px;">'
        f'Thanks for creating your <strong style="color:#ffffff;">{PRODUCT_NAME}</strong> workspace. '
        'Please confirm this email address so we know we can reach you:</p>'
        f'<p style="margin:0 0 20px;"><a href="{link}" style="display:inline-block;background-color:#a78bfa;color:#0a0a0a;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:15px;">Confirm email</a></p>'
        '<p style="margin:0;color:#888888;font-size:13px;">The link works for the next three days. If you did not create this account, you can ignore this message.</p>'
    )

    return _send(settings, to, f"Confirm your {PRODUCT_NAME} email address", text_body, html=html_body)


# ---------------------------------------------------------------------------
# Welcome email (sent after registration)
# ---------------------------------------------------------------------------

def send_welcome_email(settings: Settings, to: str, full_name: str | None) -> bool:
    """Welcome a new user after registration."""
    greeting = f"Hi {full_name.split()[0]}," if full_name else "Hi,"
    dashboard_url = f"{_app_url(settings)}/dashboard"
    finder_url = f"{_app_url(settings)}/lead-finder"
    unsubscribe_url = f"{_app_url(settings)}/settings/email?unsubscribe=marketing"

    text_body = (
        f"{greeting}\n\n"
        f"Welcome to {PRODUCT_NAME}! Your workspace is ready and waiting.\n\n"
        "Here is what you can do next:\n\n"
        "  1. Find leads \u2014 search for businesses that need a better website\n"
        "  2. Reveal contacts \u2014 unlock phone numbers and emails\n"
        "  3. Start a campaign \u2014 reach out with personalized emails\n\n"
        f"Get started: {dashboard_url}\n"
        f"Find leads:  {finder_url}\n\n"
        "If you have any questions, just reply to this email."
        f"{_unsubscribe_footer_text(unsubscribe_url)}"
        f"{_text_footer()}"
    )

    html_body = _html_wrapper(
        f'<p style="margin:0 0 20px;color:#cccccc;font-size:15px;">{greeting}</p>'
        f'<p style="margin:0 0 20px;color:#cccccc;font-size:15px;">Welcome to <strong style="color:#ffffff;">{PRODUCT_NAME}</strong>! Your workspace is ready and waiting.</p>'
        '<p style="margin:0 0 16px;color:#cccccc;font-size:15px;">Here is what you can do next:</p>'
        '<table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:20px;">'
        '<tr><td style="padding:8px 0;color:#cccccc;font-size:15px;"><span style="color:#a78bfa;font-weight:600;">1.</span> Find leads \u2014 search for businesses that need a better website</td></tr>'
        '<tr><td style="padding:8px 0;color:#cccccc;font-size:15px;"><span style="color:#a78bfa;font-weight:600;">2.</span> Reveal contacts \u2014 unlock phone numbers and emails</td></tr>'
        '<tr><td style="padding:8px 0;color:#cccccc;font-size:15px;"><span style="color:#a78bfa;font-weight:600;">3.</span> Start a campaign \u2014 reach out with personalized emails</td></tr>'
        '</table>'
        f'<p style="margin:0 0 10px;"><a href="{dashboard_url}" style="display:inline-block;background-color:#a78bfa;color:#0a0a0a;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:15px;">Open dashboard</a></p>'
        f'<p style="margin:0 0 20px;"><a href="{finder_url}" style="display:inline-block;background-color:#22c55e;color:#0a0a0a;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:15px;">Find leads</a></p>'
        '<p style="margin:0;color:#888888;font-size:13px;">If you have any questions, just reply to this email.</p>'
        + _unsubscribe_footer_html(unsubscribe_url)
    )

    return _send(settings, to, f"Welcome to {PRODUCT_NAME}!", text_body, html=html_body)


# ---------------------------------------------------------------------------
# Login notification
# ---------------------------------------------------------------------------

def send_login_notification(
    settings: Settings,
    to: str,
    full_name: str | None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    login_time: datetime | None = None,
) -> bool:
    """Notify a user about a new login to their account."""
    greeting = f"Hi {full_name.split()[0]}," if full_name else "Hi,"
    when = (login_time or datetime.now(timezone.utc)).strftime("%B %d, %Y at %H:%M UTC")
    device_info = _parse_user_agent(user_agent) if user_agent else None
    ip_display = ip_address or "unknown location"
    security_url = f"{_app_url(settings)}/settings/security"

    details_lines = []
    details_lines.append(f"Time: {when}")
    if ip_display:
        details_lines.append(f"IP address: {ip_display}")
    if device_info:
        details_lines.append(f"Device: {device_info}")
    details_text = "\n  ".join(details_lines)

    details_html = ""
    if ip_display:
        details_html += f'<tr><td style="padding:6px 0;color:#888888;font-size:13px;">IP address:</td><td style="padding:6px 0;color:#cccccc;font-size:13px;">{ip_display}</td></tr>'
    if device_info:
        details_html += f'<tr><td style="padding:6px 0;color:#888888;font-size:13px;">Device:</td><td style="padding:6px 0;color:#cccccc;font-size:13px;">{device_info}</td></tr>'
    details_html += f'<tr><td style="padding:6px 0;color:#888888;font-size:13px;">Time:</td><td style="padding:6px 0;color:#cccccc;font-size:13px;">{when}</td></tr>'

    text_body = (
        f"{greeting}\n\n"
        f"New login to your {PRODUCT_NAME} account.\n\n"
        f"  {details_text}\n\n"
        "If this was you, no further action is needed.\n\n"
        "If you do not recognize this login, change your password immediately:"
        f"\n{_app_url(settings)}/forgot-password"
        f"{_text_footer()}"
    )

    html_body = _html_wrapper(
        f'<p style="margin:0 0 20px;color:#cccccc;font-size:15px;">{greeting}</p>'
        f'<p style="margin:0 0 20px;color:#cccccc;font-size:15px;">New login to your <strong style="color:#ffffff;">{PRODUCT_NAME}</strong> account.</p>'
        '<table cellpadding="0" cellspacing="0" style="width:100%;background-color:#1a1a1a;border-radius:8px;margin-bottom:20px;padding:16px;">'
        + details_html +
        '</table>'
        '<p style="margin:0 0 12px;color:#888888;font-size:13px;">If this was you, no further action is needed.</p>'
        '<p style="margin:0 0 20px;color:#888888;font-size:13px;">If you do not recognize this login, change your password immediately:</p>'
        f'<p style="margin:0;"><a href="{security_url}" style="display:inline-block;background-color:#ef4444;color:#ffffff;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:15px;">Secure my account</a></p>'
    )

    return _send(settings, to, f"New login to your {PRODUCT_NAME} account", text_body, html=html_body)


def _parse_user_agent(user_agent: str | None) -> str | None:
    """Extract a human-readable device/browser string from a User-Agent header."""
    if not user_agent:
        return None
    ua = user_agent.lower()

    if "windows" in ua:
        os_name = "Windows"
    elif "mac os" in ua or "macos" in ua:
        os_name = "macOS"
    elif "linux" in ua:
        os_name = "Linux"
    elif "android" in ua:
        os_name = "Android"
    elif "iphone" in ua or "ipad" in ua:
        os_name = "iOS"
    else:
        os_name = None

    if "edg/" in ua or "edge/" in ua:
        browser = "Edge"
    elif "chrome/" in ua and "safari/" in ua:
        browser = "Chrome"
    elif "firefox/" in ua:
        browser = "Firefox"
    elif "safari/" in ua:
        browser = "Safari"
    else:
        browser = None

    parts = [p for p in (browser, os_name) if p]
    return " ".join(parts) if parts else None


# ---------------------------------------------------------------------------
# Internal send
# ---------------------------------------------------------------------------

def _send(settings: Settings, to: str, subject: str, body: str, html: str | None = None) -> bool:
    provider = get_email_provider(settings)
    provider_name = type(provider).__name__
    logger.info("Transactional email: provider=%s, to=%s, subject=%r", provider_name, to, subject)
    try:
        result = provider.send(to=to, subject=subject, body=body, html=html)
    except Exception as exc:  # noqa: BLE001 - a mail failure must not fail registration
        logger.error("Transactional email to %s FAILED: %s [%s]", to, exc, type(exc).__name__)
        return False

    # `accepted` is what the provider says it did with the message, and the
    # recording provider - the one used when no mailbox is configured - says
    # True. It has accepted the message; it has not sent it. Trusting that
    # alone made every unsent email report as delivered, so the caller told
    # people to check an inbox nothing was going to arrive in.
    #
    # Both conditions are required: a mailbox must be configured, AND the
    # provider must have accepted it.
    configured = smtp_is_configured(settings)
    delivered = configured and bool(getattr(result, "accepted", False))

    if not configured:
        logger.warning(
            "Transactional email to %s was NOT SENT (subject: %r): no mailbox is "
            "configured. Set SMTP_HOST, SMTP_USERNAME and SMTP_PASSWORD.",
            to,
            subject,
        )
    elif not delivered:
        logger.warning(
            "Transactional email to %s was NOT DELIVERED (subject: %r, provider=%s). "
            "Check SMTP_HOST / SMTP_USERNAME / SMTP_PASSWORD / EMAIL_FROM_ADDRESS.",
            to,
            subject,
            provider_name,
        )
    else:
        logger.info("Transactional email to %s delivered OK (subject: %r)", to, subject)
    return delivered
