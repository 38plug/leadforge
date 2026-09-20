"""
EmailProvider abstraction.

Handles outreach sending. Every implementation must respect the
compliance primitives enforced by the campaign service: suppression
list checks, unsubscribe links, and sending limits happen BEFORE this
provider is ever called, not inside it — so a provider implementation
should stay a thin transport layer.
"""

import json
import logging
import re
import smtplib
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass
from email.message import EmailMessage
from urllib.request import Request, urlopen

from app.core.config import Settings
from app.providers.errors import ProviderError

logger = logging.getLogger("leadforge.email")

# Deliberately permissive: this is a typo guard, not an RFC 5322 validator.
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$")


@dataclass
class EmailSendResult:
    provider_message_id: str
    accepted: bool


class EmailProvider(ABC):
    @abstractmethod
    def send(self, to: str, subject: str, body: str, reply_to: str | None = None, html: str | None = None) -> EmailSendResult:
        ...

    @abstractmethod
    def verify_email(self, email: str) -> bool:
        ...


class SMTPEmailProvider(EmailProvider):
    """Sends real mail over SMTP.

    Works with any provider that speaks SMTP — Gmail with an app password,
    Zoho, Fastmail, a VPS — so outreach does not depend on a paid API.
    """

    def __init__(
        self,
        host: str,
        port: int,
        username: str,
        password: str,
        from_address: str,
        use_tls: bool = True,
        timeout_seconds: float = 30.0,
    ):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.from_address = from_address
        self.use_tls = use_tls
        self.timeout_seconds = timeout_seconds

    def send(self, to: str, subject: str, body: str, reply_to: str | None = None, html: str | None = None) -> EmailSendResult:
        message = EmailMessage()
        message["From"] = self.from_address
        message["To"] = to
        message["Subject"] = subject
        if reply_to:
            message["Reply-To"] = reply_to
        message_id = f"<{uuid.uuid4()}@leadforge>"
        message["Message-ID"] = message_id
        message.set_content(body)
        if html:
            message.add_alternative(html, subtype="html")

        try:
            if self.port == 465:
                server = smtplib.SMTP_SSL(self.host, self.port, timeout=self.timeout_seconds)
            else:
                server = smtplib.SMTP(self.host, self.port, timeout=self.timeout_seconds)
            with server:
                if self.use_tls and self.port != 465:
                    server.starttls()
                server.login(self.username, self.password)
                server.send_message(message)
        except smtplib.SMTPAuthenticationError as exc:
            # Note the absence of the password in this message — credentials
            # must never reach logs or API responses.
            raise ProviderError(
                "SMTP_AUTH_FAILED",
                "The mail server rejected the configured SMTP credentials.",
            ) from exc
        except smtplib.SMTPRecipientsRefused as exc:
            raise ProviderError("SMTP_RECIPIENT_REFUSED", f"The mail server refused {to}.") from exc
        except (smtplib.SMTPException, OSError) as exc:
            raise ProviderError(
                "SMTP_UNAVAILABLE",
                f"Could not reach the mail server at {self.host}:{self.port}.",
                retryable=True,
            ) from exc

        return EmailSendResult(provider_message_id=message_id, accepted=True)

    def verify_email(self, email: str) -> bool:
        return bool(_EMAIL_RE.match(email))


class ResendEmailProvider(EmailProvider):
    """Sends email via Resend's HTTP API — no SMTP needed.

    Works on platforms that block outbound SMTP (Render free tier, etc).
    Requires an API key from https://resend.com and a verified sender domain,
    or use their default onboarding@resend.dev for testing.
    """

    API_URL = "https://api.resend.com/emails"

    def __init__(self, api_key: str, from_address: str, timeout_seconds: float = 30.0):
        self.api_key = api_key
        self.from_address = from_address
        self.timeout_seconds = timeout_seconds

    def send(self, to: str, subject: str, body: str, reply_to: str | None = None, html: str | None = None) -> EmailSendResult:
        payload: dict = {
            "from": self.from_address,
            "to": [to],
            "subject": subject,
        }
        if html:
            payload["html"] = html
        else:
            payload["text"] = body

        if reply_to:
            payload["reply_to"] = reply_to

        data = json.dumps(payload).encode()
        req = Request(
            self.API_URL,
            data=data,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        try:
            with urlopen(req, timeout=self.timeout_seconds) as resp:
                body_bytes = resp.read()
                result = json.loads(body_bytes)
                message_id = result.get("id", f"resend-{uuid.uuid4()}")
                return EmailSendResult(provider_message_id=message_id, accepted=True)
        except Exception as exc:
            raise ProviderError(
                "RESEND_API_FAILED",
                f"Resend API rejected the request: {exc}",
                retryable=True,
            ) from exc

    def verify_email(self, email: str) -> bool:
        return bool(_EMAIL_RE.match(email))


class RecordingEmailProvider(EmailProvider):
    """Records outbound mail without sending it, for when SMTP is unconfigured.

    Campaign rows still move to SENT so the pipeline is exercised end to end,
    but nothing leaves the machine. The Data Sources page says so plainly
    rather than implying mail is going out.
    """

    def send(self, to: str, subject: str, body: str, reply_to: str | None = None, html: str | None = None) -> EmailSendResult:
        # Subject and recipient only — never the body, which can carry
        # personal details, and never credentials.
        print(f"[email:not-sent] to={to} subject={subject!r} (configure SMTP_HOST to send for real)")
        return EmailSendResult(provider_message_id=f"unsent-{uuid.uuid4()}", accepted=True)

    def verify_email(self, email: str) -> bool:
        return bool(_EMAIL_RE.match(email))


def _resend_is_configured(settings: Settings) -> bool:
    return bool(settings.smtp_password and settings.smtp_password.startswith("re_"))


def smtp_is_configured(settings: Settings) -> bool:
    return bool(settings.smtp_host and settings.smtp_username and settings.smtp_password)


def get_workspace_email_provider(db, workspace_id: str, settings: Settings) -> EmailProvider:
    """Resolve the mailbox a given workspace sends from.

    A workspace's own configuration always wins. The server-wide SMTP_* env
    vars are only a fallback for single-tenant self-hosting — in a real
    multi-tenant deployment every workspace connects its own mailbox, so
    replies go back to whoever sent the outreach.
    """
    # Imported here: app.models imports settings indirectly, and this module
    # is imported during provider setup.
    from app.core.crypto import SecretDecryptionError, decrypt_secret
    from app.models.workspace import WorkspaceEmailSettings

    row = (
        db.query(WorkspaceEmailSettings)
        .filter(WorkspaceEmailSettings.workspace_id == workspace_id)
        .first()
    )
    if row is None:
        return get_email_provider(settings)

    try:
        password = decrypt_secret(row.smtp_password_encrypted, settings)
    except SecretDecryptionError as exc:
        raise ProviderError("SMTP_CREDENTIAL_UNREADABLE", str(exc)) from exc

    from_address = f"{row.from_name} <{row.from_address}>" if row.from_name else row.from_address
    return SMTPEmailProvider(
        host=row.smtp_host,
        port=row.smtp_port,
        username=row.smtp_username,
        password=password,
        from_address=from_address,
        use_tls=row.smtp_use_tls,
    )


def get_email_provider(settings: Settings) -> EmailProvider:
    provider = settings.email_provider.lower()

    if provider == "resend" or (provider == "auto" and _resend_is_configured(settings)):
        if not _resend_is_configured(settings):
            raise ProviderError(
                "RESEND_NOT_CONFIGURED",
                "EMAIL_PROVIDER=resend requires SMTP_PASSWORD to start with 're_' (your Resend API key).",
            )
        return ResendEmailProvider(
            api_key=settings.smtp_password,
            from_address=settings.email_from_address,
        )

    if provider == "smtp" or (provider == "auto" and smtp_is_configured(settings)):
        if not smtp_is_configured(settings):
            raise ProviderError(
                "SMTP_NOT_CONFIGURED",
                "EMAIL_PROVIDER=smtp requires SMTP_HOST, SMTP_USERNAME and SMTP_PASSWORD.",
            )
        return SMTPEmailProvider(
            host=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_username,
            password=settings.smtp_password,
            from_address=settings.email_from_address,
            use_tls=settings.smtp_use_tls,
        )

    if provider in ("auto", "mock", "recording"):
        return RecordingEmailProvider()

    raise NotImplementedError(
        f"Email provider '{settings.email_provider}' is not implemented. "
        "Supported: 'smtp', 'resend', or 'auto'."
    )
