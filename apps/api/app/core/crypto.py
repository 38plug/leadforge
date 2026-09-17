"""Symmetric encryption for per-tenant secrets stored in the database.

Workspace SMTP passwords are credentials belonging to the customer, not to
the application, so they cannot live in environment variables — every
workspace has its own. They are encrypted at rest with a key that does live
in the environment, so a database dump alone never yields usable passwords.

Set SECRET_ENCRYPTION_KEY in production (generate one with
`python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`).
Outside production, a key is derived from JWT_SECRET so local development
needs no extra setup.
"""

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import Settings


class SecretDecryptionError(RuntimeError):
    """Raised when stored ciphertext cannot be read with the current key."""


def _fernet(settings: Settings) -> Fernet:
    configured = settings.secret_encryption_key
    if configured:
        try:
            return Fernet(configured.encode())
        except (ValueError, TypeError) as exc:
            raise RuntimeError(
                "SECRET_ENCRYPTION_KEY is not a valid Fernet key. Generate one with "
                "Fernet.generate_key()."
            ) from exc

    if settings.environment.lower() == "production":
        raise RuntimeError(
            "SECRET_ENCRYPTION_KEY must be set in production so stored SMTP "
            "passwords are not protected by the JWT secret."
        )

    # Development convenience only: deterministic so restarts can still read
    # previously stored values.
    derived = hashlib.sha256(settings.jwt_secret.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(derived))


def encrypt_secret(value: str, settings: Settings) -> str:
    return _fernet(settings).encrypt(value.encode()).decode()


def decrypt_secret(token: str, settings: Settings) -> str:
    try:
        return _fernet(settings).decrypt(token.encode()).decode()
    except InvalidToken as exc:
        # Usually means the encryption key changed since the value was saved.
        raise SecretDecryptionError(
            "Stored credential could not be decrypted. Re-enter it in Settings."
        ) from exc
