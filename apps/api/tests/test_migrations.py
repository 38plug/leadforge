"""
Guards against schema drift between the SQLAlchemy models and Alembic.

Local development runs on SQLite with `create_all()`, which builds the schema
straight from the models — so a table added to the models but never given a
migration works perfectly in dev and is simply absent in production, where the
schema comes from `alembic upgrade head`. That is exactly how
`workspace_email_settings` came to be missing: every test passed, and the
Settings -> Email feature would have failed only once deployed.
"""

import sqlite3

from alembic import command
from alembic.config import Config

from app.core.config import get_settings
from app.models.base import Base
import app.models  # noqa: F401 — registers every model on Base.metadata


def _migrated_tables(db_path, monkeypatch) -> set[str]:
    # alembic/env.py takes its URL from the app settings rather than from the
    # Config object, so the temp database has to be injected there — and the
    # settings are lru_cached, so the cache is cleared either side of the run.
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path}")
    get_settings.cache_clear()
    try:
        command.upgrade(Config("alembic.ini"), "head")
    finally:
        get_settings.cache_clear()

    con = sqlite3.connect(db_path)
    try:
        return {
            name
            for (name,) in con.execute("select name from sqlite_master where type='table'")
            if name != "alembic_version"
        }
    finally:
        con.close()


def test_migrations_create_every_table_the_models_define(tmp_path, monkeypatch):
    migrated = _migrated_tables(tmp_path / "migrations.db", monkeypatch)
    defined = set(Base.metadata.tables)

    assert not defined - migrated, (
        "model tables with no migration — these exist in dev (create_all) but "
        "would be missing in production: " + ", ".join(sorted(defined - migrated))
    )
    assert not migrated - defined, (
        "migration creates tables no model defines: " + ", ".join(sorted(migrated - defined))
    )
