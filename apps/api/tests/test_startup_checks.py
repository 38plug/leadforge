import pathlib
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


def test_failure_message_says_where_configuration_was_looked_for():
    """"But I did set that" is the next question after a refused deploy, so the
    error names every place the value could have come from."""
    with pytest.raises(InsecureProductionConfigError) as excinfo:
        verify_production_safety(settings(environment="production"))
    message = str(excinfo.value)
    assert "Where configuration was looked for" in message
    assert "/etc/secrets" in message


def test_diagnostics_never_print_secret_values(tmp_path, monkeypatch):
    """The message goes into deploy logs, so it lists key names only."""
    from app.core import startup_checks

    env_file = tmp_path / ".env"
    env_file.write_text("JWT_SECRET=super-secret-value\n", encoding="utf-8")
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:hunter2@host/db")

    report = startup_checks.describe_config_sources()

    assert "JWT_SECRET" in report, "key names are useful and expected"
    assert "super-secret-value" not in report
    assert "hunter2" not in report


def test_secret_files_are_read_whatever_they_are_named(tmp_path, monkeypatch):
    """Render mounts Secret Files under the name the user chose. A real deploy
    failed five times because the app only looked for '.env' while the mounted
    file was called 'LeadForgeEnv'."""
    from app.core import config as config_module

    secrets_dir = tmp_path / "secrets"
    secrets_dir.mkdir()
    (secrets_dir / "LeadForgeEnv").write_text(
        "JWT_SECRET=" + REAL_SECRET + "\nDATABASE_URL=" + REAL_DB + "\n", encoding="utf-8"
    )
    # Kubernetes' atomic-writer artifacts, present in the real mount.
    (secrets_dir / "..data").write_text("not config", encoding="utf-8")
    (secrets_dir / "..2026_09_18_09_03_45.2190926750").write_text("not config", encoding="utf-8")

    monkeypatch.setattr(config_module, "RENDER_SECRETS_DIR", secrets_dir)
    # conftest exports DATABASE_URL for the test database, and a real
    # environment variable outranks any env file — which is the correct
    # precedence, just not what this test is about.
    monkeypatch.delenv("DATABASE_URL", raising=False)

    discovered = config_module._secret_env_files()
    assert [pathlib.Path(p).name for p in discovered] == ["LeadForgeEnv"], (
        "only real secret files are config; the '..' entries are mount internals"
    )

    loaded = Settings(_env_file=discovered)
    assert loaded.jwt_secret == REAL_SECRET
    assert loaded.database_url == REAL_DB
    verify_production_safety(
        Settings(_env_file=discovered, environment="production")
    )


def test_missing_secrets_directory_is_not_an_error(tmp_path, monkeypatch):
    """Locally /etc/secrets does not exist, and that must not break startup."""
    from app.core import config as config_module

    monkeypatch.setattr(config_module, "RENDER_SECRETS_DIR", tmp_path / "nope")
    assert config_module._secret_env_files() == ()
