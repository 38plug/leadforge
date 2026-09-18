"""A production deployment on development defaults must not start."""

import pytest

from app.core.config import Settings
from app.core.startup_checks import InsecureProductionConfigError, verify_production_safety

REAL_SECRET = "0f5c1a" * 10
REAL_DB = "postgresql://user:pw@db.example.com/leadforge"


def settings(**overrides) -> Settings:
    # _env_file=None so the developer's own .env cannot satisfy the checks.
    return Settings(_env_file=None, **overrides)


def test_production_with_the_default_signing_key_is_refused():
    """The default is published in this repo, so tokens signed with it are
    forgeable by anyone who can read the source."""
    with pytest.raises(InsecureProductionConfigError, match="JWT_SECRET"):
        verify_production_safety(settings(environment="production", database_url=REAL_DB))


def test_production_on_sqlite_is_refused():
    """Managed hosts have ephemeral filesystems — this silently discarded every
    account on the real deployment that prompted this check."""
    with pytest.raises(InsecureProductionConfigError, match="DATABASE_URL"):
        verify_production_safety(
            settings(environment="production", jwt_secret=REAL_SECRET, database_url="sqlite:///./leadforge.db")
        )


def test_both_problems_are_reported_together():
    """One restart-and-retry cycle per problem is how a deploy loop wastes an
    afternoon, so every problem is listed at once."""
    with pytest.raises(InsecureProductionConfigError) as excinfo:
        verify_production_safety(settings(environment="production"))
    message = str(excinfo.value)
    assert "JWT_SECRET" in message and "DATABASE_URL" in message


def test_properly_configured_production_starts():
    verify_production_safety(
        settings(environment="production", jwt_secret=REAL_SECRET, database_url=REAL_DB)
    )


@pytest.mark.parametrize("environment", ["development", "test", "staging"])
def test_non_production_keeps_the_zero_setup_defaults(environment):
    """Local development must stay runnable with no configuration at all."""
    verify_production_safety(settings(environment=environment))


def test_the_check_is_case_insensitive_about_the_environment_name():
    with pytest.raises(InsecureProductionConfigError):
        verify_production_safety(settings(environment="PRODUCTION"))
