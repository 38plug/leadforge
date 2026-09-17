"""
EmailProvider abstraction.

Handles outreach sending. Every implementation must respect the
compliance primitives enforced by the campaign service: suppression
list checks, unsubscribe links, and sending limits happen BEFORE this
provider is ever called, not inside it — so a provider implementation
should stay a thin transport layer.
"""

import re
import smtplib
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass
from email.message import EmailMessage

from app.core.config import Settings
from app.providers.errors import ProviderError

# Deliberately permissive: this is a typo guard, not an RFC 5322 validator.
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$")


@dataclass
class EmailSendResult:
    provider_message_id: str
    accepted: bool


class EmailProvider(ABC):
    @abstractmethod
    def send(self, to: str, subject: str, body: str, reply_to: str | None = None) -> EmailSendResult:
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

    def send(self, to: str, subject: str, body: str, reply_to: str | None = None) -> EmailSendResult:
        message = EmailMessage()
        message["From"] = self.from_address
        message["To"] = to
        message["Subject"] = subject
        if reply_to:
            message["Reply-To"] = reply_to
        message_id = f"<{uuid.uuid4()}@leadforge>"
        message["Message-ID"] = message_id
        message.set_content(body)

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


class RecordingEmailProvider(EmailProvider):
    """Records outbound mail without sending it, for when SMTP is unconfigured.

    Campaign rows still move to SENT so the pipeline is exercised end to end,
    but nothing leaves the machine. The Data Sources page says so plainly
    rather than implying mail is going out.
    """

    def send(self, to: str, subject: str, body: str, reply_to: str | None = None) -> EmailSendResult:
        # Subject and recipient only — never the body, which can carry
        # personal details, and never credentials.
        print(f"[email:not-sent] to={to} subject={subject!r} (configure SMTP_HOST to send for real)")
        return EmailSendResult(provider_message_id=f"unsent-{uuid.uuid4()}", accepted=True)

    def verify_email(self, email: str) -> bool:
        return bool(_EMAIL_RE.match(email))


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
        "Supported: 'smtp' (works with any mail host) or 'auto'."
    )
