import os

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_leadforge.db")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.session import Base, get_db
from app.main import app
from app.models.workspace import User, Workspace, WorkspaceMember, WorkspaceRole

TEST_DATABASE_URL = "sqlite:///:memory:"


@pytest.fixture()
def db_session():
    # StaticPool keeps a single shared connection alive for the whole test:
    # FastAPI runs sync route handlers in a worker thread, and a plain
    # sqlite:///:memory: engine hands each new thread its own empty
    # in-memory database otherwise, causing spurious "no such table" errors.
    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    # SQLite ignores foreign keys unless asked not to, while production runs
    # Postgres, which enforces them. Without this the suite cannot catch a
    # delete that leaves rows pointing at something gone - it passes locally
    # and raises an IntegrityError in front of a customer.
    @event.listens_for(engine, "connect")
    def _enforce_foreign_keys(dbapi_connection, _record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def _clear_rate_limit_buckets():
    """Reset the in-memory rate limiter between tests so they don't interfere."""
    from app.services.rate_limit import _buckets
    _buckets.clear()
    yield
    _buckets.clear()


@pytest.fixture()
def demo_workspace(db_session):
    user = User(email="demo@leadforge.dev", full_name="Demo User")
    db_session.add(user)
    db_session.flush()

    workspace = Workspace(name="Demo Workspace", slug="demo")
    db_session.add(workspace)
    db_session.flush()

    db_session.add(WorkspaceMember(workspace_id=workspace.id, user_id=user.id, role=WorkspaceRole.OWNER))
    db_session.commit()
    return workspace


@pytest.fixture()
def auth_headers(demo_workspace):
    return {"X-User-Email": "demo@leadforge.dev", "X-Workspace-Id": demo_workspace.id}


@pytest.fixture()
def app_with_stripe():
    """Run a test as though Stripe credentials are configured.

    get_settings is lru_cached and read at request time, so the override goes
    through the dependency rather than the environment.
    """
    from app.core.config import Settings, get_settings
    from app.main import app

    def _configured() -> Settings:
        return Settings(
            _env_file=None,
            stripe_secret_key="rk_test_example",
            stripe_webhook_secret="whsec_test_secret_value",
            stripe_price_starter="price_starter",
            stripe_price_pro="price_pro",
            stripe_price_agency="price_agency",
        )

    app.dependency_overrides[get_settings] = _configured
    yield
    app.dependency_overrides.pop(get_settings, None)


@pytest.fixture()
def app_no_stripe():
    """The default state of this installation: billing not yet configured."""
    from app.core.config import Settings, get_settings
    from app.main import app

    app.dependency_overrides[get_settings] = lambda: Settings(_env_file=None)
    yield
    app.dependency_overrides.pop(get_settings, None)
