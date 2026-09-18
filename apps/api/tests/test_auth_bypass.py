"""
Regression guard for an authentication bypass that reached production.

`X-User-Email` selects an account without a password. It shipped enabled in
production on the reasoning that it was harmless without a matching database
row - but every real customer has a matching row, and an email address is not
a secret. Anyone who could guess a customer's address had full read and write
access to their workspace, and it was confirmed against the live API.
"""

import pytest
from fastapi import HTTPException

from app.core.config import Settings
from app.core.deps import get_current_user


@pytest.fixture()
def existing_user(db_session, demo_workspace):
    """A real, registered account - the case the bypass exposed."""
    from app.models.workspace import User

    return db_session.query(User).filter(User.email == "demo@leadforge.dev").first()


def _settings(environment: str) -> Settings:
    return Settings(_env_file=None, environment=environment)


def test_email_header_is_refused_in_production(db_session, existing_user):
    """The bypass itself: no token, just an email, in production."""
    with pytest.raises(HTTPException) as excinfo:
        get_current_user(
            authorization=None,
            x_user_email=existing_user.email,
            db=db_session,
            settings=_settings("production"),
        )
    assert excinfo.value.status_code == 401


def test_a_missing_token_is_refused_in_production(db_session):
    with pytest.raises(HTTPException) as excinfo:
        get_current_user(
            authorization=None,
            x_user_email=None,
            db=db_session,
            settings=_settings("production"),
        )
    assert excinfo.value.status_code == 401


def test_email_header_still_works_in_development(db_session, existing_user):
    """Local development and the test suite rely on it; only production changes."""
    user = get_current_user(
        authorization=None,
        x_user_email=existing_user.email,
        db=db_session,
        settings=_settings("development"),
    )
    assert user.id == existing_user.id


def test_a_valid_token_still_works_in_production(db_session, existing_user):
    from app.core.security import create_access_token

    user = get_current_user(
        authorization=f"Bearer {create_access_token(existing_user.id)}",
        x_user_email=None,
        db=db_session,
        settings=_settings("production"),
    )
    assert user.id == existing_user.id


def test_a_forged_token_is_refused(db_session, existing_user):
    with pytest.raises(HTTPException) as excinfo:
        get_current_user(
            authorization="Bearer not.a.real.token",
            x_user_email=existing_user.email,
            db=db_session,
            settings=_settings("production"),
        )
    assert excinfo.value.status_code == 401
