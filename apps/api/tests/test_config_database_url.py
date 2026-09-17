"""The database URL is pasted by hand at deploy time, so its scheme is normalised."""

import pytest

from app.core.config import Settings


@pytest.mark.parametrize(
    "given, expected",
    [
        # Heroku/Render-style URLs — SQLAlchemy has no "postgres" dialect and
        # raises on this scheme, so it is rewritten rather than left to fail
        # on the first request after a deploy.
        ("postgres://u:p@host:5432/db", "postgresql://u:p@host:5432/db"),
        # Neon and Supabase already hand out the scheme SQLAlchemy wants.
        ("postgresql://u:p@host/db?sslmode=require", "postgresql://u:p@host/db?sslmode=require"),
        # An explicit driver must survive untouched.
        ("postgresql+psycopg2://u:p@host/db", "postgresql+psycopg2://u:p@host/db"),
        ("sqlite:///./leadforge.db", "sqlite:///./leadforge.db"),
    ],
)
def test_database_url_scheme_is_normalised(given, expected):
    assert Settings(database_url=given).database_url == expected


def test_password_containing_the_scheme_text_is_not_mangled():
    url = "postgresql://user:postgres://weird@host/db"
    assert Settings(database_url=url).database_url == url
