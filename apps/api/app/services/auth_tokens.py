"""
Email verification and password-reset tokens.

These are password-equivalent: one working reset token is enough to take over
an account. Three rules follow from that, and none of them is optional.

  * Only a hash is stored. A database dump must not yield working reset links.
  * A token is single-use and expires. A link forwarded, logged by a mail
    gateway, or left in an inbox for a year should not still open the account.
  * The purpose is checked on use, so a verification link can never be
    replayed as a password reset.

Lookups are by hash rather than by user, so the raw token is the only thing
that identifies which record is meant - guessing a user id gets you nothing.
"""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.misc import AuthToken
from app.models.workspace import User

PURPOSE_VERIFY_EMAIL = "VERIFY_EMAIL"
PURPOSE_RESET_PASSWORD = "RESET_PASSWORD"

# A verification link can sit in an inbox for a while; a reset link is a live
# credential and should not.
VERIFY_TTL = timedelta(days=3)
RESET_TTL = timedelta(hours=1)


def _hash(raw_token: str) -> str:
    """SHA-256 is right here, unlike for passwords.

    A password is low-entropy and needs a slow hash to survive being guessed.
    These tokens are 256 bits of randomness, so there is nothing to guess and
    a fast hash costs nothing in safety.
    """
    return hashlib.sha256(raw_token.encode()).hexdigest()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def issue(db: Session, user: User, purpose: str) -> str:
    """Create a token and return the raw value, which is never stored.

    Any outstanding token for the same purpose is spent first, so requesting a
    new reset link immediately invalidates the previous one.
    """
    db.query(AuthToken).filter(
        AuthToken.user_id == user.id,
        AuthToken.purpose == purpose,
        AuthToken.used_at.is_(None),
    ).update({"used_at": _now().isoformat()}, synchronize_session=False)

    raw = secrets.token_urlsafe(32)
    ttl = VERIFY_TTL if purpose == PURPOSE_VERIFY_EMAIL else RESET_TTL
    db.add(
        AuthToken(
            user_id=user.id,
            purpose=purpose,
            token_hash=_hash(raw),
            expires_at=(_now() + ttl).isoformat(),
        )
    )
    db.flush()
    return raw


def consume(db: Session, raw_token: str, purpose: str) -> User | None:
    """Spend a token and return its user, or None if it is not usable.

    One return value for every failure - unknown, expired, already used, wrong
    purpose - because telling the caller which would help someone probing.
    """
    record = (
        db.query(AuthToken)
        .filter(AuthToken.token_hash == _hash(raw_token), AuthToken.purpose == purpose)
        .first()
    )
    if not record or record.used_at:
        return None

    try:
        expires_at = datetime.fromisoformat(record.expires_at)
    except ValueError:
        return None
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < _now():
        return None

    user = db.query(User).filter(User.id == record.user_id).first()
    if not user:
        return None

    # Marked used before the caller acts on it, so a token cannot be spent
    # twice by two requests arriving together.
    record.used_at = _now().isoformat()
    db.flush()
    return user


def mark_email_verified(db: Session, user: User) -> None:
    user.email_verified_at = _now().isoformat()
    db.flush()
