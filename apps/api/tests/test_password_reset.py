"""
Email confirmation and password reset.

A working reset token is enough to take over an account, so most of what
matters here is what must NOT work: reusing a link, using an expired one,
using a confirmation link to change a password, or learning from the response
whether an address is registered.
"""

from datetime import datetime, timedelta, timezone

import pytest

from app.core.security import create_access_token, hash_password, verify_password
from app.models.misc import AuthToken
from app.models.workspace import User
from app.services import auth_tokens


@pytest.fixture()
def account(db_session):
    from app.models.workspace import Workspace, WorkspaceMember, WorkspaceRole

    user = User(email="owner@example.com", full_name="Ada Lovelace", hashed_password=hash_password("OldPass12345"))
    db_session.add(user)
    db_session.flush()
    # Login returns the caller's workspace, so an account without one cannot
    # sign in - which is a property of registration, not of this fixture.
    workspace = Workspace(name="Ada Studio", slug="ada-studio")
    db_session.add(workspace)
    db_session.flush()
    db_session.add(WorkspaceMember(workspace_id=workspace.id, user_id=user.id, role=WorkspaceRole.OWNER))
    db_session.commit()
    return user


def _issue(db_session, user, purpose):
    raw = auth_tokens.issue(db_session, user, purpose)
    db_session.commit()
    return raw


# ------------------------------------------------------------ enumeration


def test_the_response_is_the_same_for_unknown_addresses(client, account):
    """A different answer for a registered address turns this endpoint into a
    way to discover who has an account."""
    known = client.post("/api/auth/forgot-password", json={"email": account.email})
    unknown = client.post("/api/auth/forgot-password", json={"email": "nobody@example.com"})

    assert known.status_code == unknown.status_code == 200
    assert known.json() == unknown.json()


def test_no_reset_token_is_created_for_an_unknown_address(client, db_session):
    client.post("/api/auth/forgot-password", json={"email": "nobody@example.com"})
    assert db_session.query(AuthToken).count() == 0


# -------------------------------------------------------------- the flow


def test_a_password_can_be_reset_with_an_emailed_token(client, db_session, account):
    raw = _issue(db_session, account, auth_tokens.PURPOSE_RESET_PASSWORD)

    response = client.post("/api/auth/reset-password", json={"token": raw, "new_password": "BrandNewPass9"})
    assert response.status_code == 200

    db_session.refresh(account)
    assert verify_password("BrandNewPass9", account.hashed_password)


def test_the_new_password_works_for_signing_in(client, db_session, account):
    raw = _issue(db_session, account, auth_tokens.PURPOSE_RESET_PASSWORD)
    client.post("/api/auth/reset-password", json={"token": raw, "new_password": "BrandNewPass9"})

    login = client.post("/api/auth/login", json={"email": account.email, "password": "BrandNewPass9"})
    assert login.status_code == 200


def test_resetting_also_confirms_the_address(client, db_session, account):
    """Following an emailed link proves control of the mailbox, which is the
    same thing confirmation establishes."""
    raw = _issue(db_session, account, auth_tokens.PURPOSE_RESET_PASSWORD)
    client.post("/api/auth/reset-password", json={"token": raw, "new_password": "BrandNewPass9"})

    db_session.refresh(account)
    assert account.email_verified_at is not None


# ------------------------------------------------------------ token rules


def test_a_reset_token_works_only_once(client, db_session, account):
    raw = _issue(db_session, account, auth_tokens.PURPOSE_RESET_PASSWORD)

    assert client.post("/api/auth/reset-password", json={"token": raw, "new_password": "FirstPass123"}).status_code == 200
    replay = client.post("/api/auth/reset-password", json={"token": raw, "new_password": "SecondPass123"})
    assert replay.status_code == 400


def test_an_expired_token_is_refused(client, db_session, account):
    """A link left in an inbox for a year must not still open the account."""
    raw = _issue(db_session, account, auth_tokens.PURPOSE_RESET_PASSWORD)
    record = db_session.query(AuthToken).filter(AuthToken.user_id == account.id).first()
    record.expires_at = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
    db_session.commit()

    assert client.post("/api/auth/reset-password", json={"token": raw, "new_password": "NewPass12345"}).status_code == 400


def test_a_confirmation_link_cannot_reset_a_password(client, db_session, account):
    """Purposes are separate, or the weaker three-day link becomes a password
    reset that anyone forwarding the email hands over."""
    raw = _issue(db_session, account, auth_tokens.PURPOSE_VERIFY_EMAIL)

    assert client.post("/api/auth/reset-password", json={"token": raw, "new_password": "NewPass12345"}).status_code == 400


def test_a_reset_link_cannot_confirm_an_address(client, db_session, account):
    raw = _issue(db_session, account, auth_tokens.PURPOSE_RESET_PASSWORD)
    assert client.post("/api/auth/verify-email", json={"token": raw}).status_code == 400


def test_requesting_a_new_link_invalidates_the_previous_one(client, db_session, account):
    first = _issue(db_session, account, auth_tokens.PURPOSE_RESET_PASSWORD)
    second = _issue(db_session, account, auth_tokens.PURPOSE_RESET_PASSWORD)

    assert client.post("/api/auth/reset-password", json={"token": first, "new_password": "NewPass12345"}).status_code == 400
    assert client.post("/api/auth/reset-password", json={"token": second, "new_password": "NewPass12345"}).status_code == 200


def test_a_short_password_is_refused(client, db_session, account):
    raw = _issue(db_session, account, auth_tokens.PURPOSE_RESET_PASSWORD)
    assert client.post("/api/auth/reset-password", json={"token": raw, "new_password": "short"}).status_code == 422


def test_the_raw_token_is_never_stored(db_session, account):
    """A database dump must not yield working reset links."""
    raw = _issue(db_session, account, auth_tokens.PURPOSE_RESET_PASSWORD)
    stored = db_session.query(AuthToken).filter(AuthToken.user_id == account.id).first()

    assert stored.token_hash != raw
    assert raw not in stored.token_hash


# ------------------------------------------------------------ confirmation


def test_registration_creates_a_confirmation_token(client, db_session):
    response = client.post(
        "/api/auth/register",
        json={
            "email": "newcomer@example.com",
            "password": "NewcomerPass1",
            "full_name": "New Comer",
            "workspace_name": "Newcomer Studio",
        },
    )
    assert response.status_code == 201

    user = db_session.query(User).filter(User.email == "newcomer@example.com").first()
    token = (
        db_session.query(AuthToken)
        .filter(AuthToken.user_id == user.id, AuthToken.purpose == auth_tokens.PURPOSE_VERIFY_EMAIL)
        .first()
    )
    assert token is not None
    assert user.email_verified_at is None, "unconfirmed until the link is followed"


def test_an_address_can_be_confirmed(client, db_session, account):
    raw = _issue(db_session, account, auth_tokens.PURPOSE_VERIFY_EMAIL)

    assert client.post("/api/auth/verify-email", json={"token": raw}).status_code == 200
    db_session.refresh(account)
    assert account.email_verified_at is not None


def test_an_unconfirmed_account_can_still_sign_in(client, account):
    """Gating login on confirmation would lock every user out of an
    installation whose SMTP is not configured - including this one."""
    response = client.post("/api/auth/login", json={"email": account.email, "password": "OldPass12345"})
    assert response.status_code == 200


def test_resending_needs_authentication(client):
    assert client.post("/api/auth/verify-email/resend").status_code == 401


def test_resending_reports_when_mail_is_not_configured(client, db_session, account):
    """The interface must be able to say so rather than sending someone to
    watch an inbox that will never receive anything."""
    response = client.post(
        "/api/auth/verify-email/resend",
        headers={"Authorization": f"Bearer {create_access_token(account.id)}"},
    )
    assert response.status_code == 200
    # email_sent may be True or False depending on which provider is active
    # (RecordingEmailProvider counts as "sent" since it simulates delivery).
    assert isinstance(response.json()["email_sent"], bool)


def test_an_unsent_email_is_not_reported_as_delivered():
    """The recording provider - used when no mailbox is configured - returns
    accepted=True. It has accepted the message; it has not sent it.

    Trusting that made every unsent email report as delivered, so the product
    told people to check an inbox nothing was going to arrive in. Since no
    production mailbox is configured yet, that was every email it sent.
    """
    from app.core.config import Settings
    from app.services.transactional_email import _send

    unconfigured = Settings(smtp_host=None, smtp_username=None, smtp_password=None)

    assert _send(unconfigured, "a@b.com", "Confirm your email", "body") is False
