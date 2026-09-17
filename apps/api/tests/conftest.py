import os

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_leadforge.db")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
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
