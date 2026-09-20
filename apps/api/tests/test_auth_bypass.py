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
from starlette.testclient import TestClient

from app.core.config import Settings
from app.core.deps import get_current_user
from app.main import app


@pytest.fixture()
def existing_user(db_session, demo_workspace):
    """A real, registered account - the case the bypass exposed."""
    from app.models.workspace import User

    return db_session.query(User).filter(User.email == "demo@leadforge.dev").first()


def _settings(environment: str) -> Settings:
    return Settings(_env_file=None, environment=environment)


def _fake_request():
    """Minimal request-like object so get_current_user can resolve the IP."""
    with TestClient(app) as c:
        req = c.build_request(method="GET", url="/")
        yield req


def test_email_header_is_refused_in_production(db_session, existing_user):
    """The bypass itself: no token, just an email, in production."""
    from starlette.testclient import TestClient

    with TestClient(app) as c:
        req = c.build_request(method="GET", url="/")
        with pytest.raises(HTTPException) as excinfo:
            get_current_user(
                request=req,
                authorization=None,
                lf_token=None,
                x_user_email=existing_user.email,
                db=db_session,
                settings=_settings("production"),
            )
        assert excinfo.value.status_code == 401


def test_a_missing_token_is_refused_in_production(db_session):
    from starlette.testclient import TestClient

    with TestClient(app) as c:
        req = c.build_request(method="GET", url="/")
        with pytest.raises(HTTPException) as excinfo:
            get_current_user(
                request=req,
                authorization=None,
                lf_token=None,
                x_user_email=None,
                db=db_session,
                settings=_settings("production"),
            )
        assert excinfo.value.status_code == 401


def test_email_header_still_works_in_development(db_session, existing_user):
    """Local development and the test suite rely on it; only production changes."""
    from starlette.testclient import TestClient

    with TestClient(app) as c:
        req = c.build_request(method="GET", url="/")
        user = get_current_user(
            request=req,
            authorization=None,
            lf_token=None,
            x_user_email=existing_user.email,
            db=db_session,
            settings=_settings("development"),
        )
        assert user.id == existing_user.id


def test_a_valid_token_still_works_in_production(db_session, existing_user):
    from app.core.security import create_access_token
    from starlette.testclient import TestClient

    with TestClient(app) as c:
        req = c.build_request(method="GET", url="/")
        user = get_current_user(
            request=req,
            authorization=f"Bearer {create_access_token(existing_user.id)}",
            lf_token=None,
            x_user_email=None,
            db=db_session,
            settings=_settings("production"),
        )
        assert user.id == existing_user.id


def test_a_forged_token_is_refused(db_session, existing_user):
    from starlette.testclient import TestClient

    with TestClient(app) as c:
        req = c.build_request(method="GET", url="/")
        with pytest.raises(HTTPException) as excinfo:
            get_current_user(
                request=req,
                authorization="Bearer not.a.real.token",
                lf_token=None,
                x_user_email=existing_user.email,
                db=db_session,
                settings=_settings("production"),
            )
        assert excinfo.value.status_code == 401
