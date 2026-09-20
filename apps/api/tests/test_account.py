"""Self-service password change and account deletion."""

import pytest

from app.core.security import create_access_token, hash_password, verify_password
from app.models.workspace import User, Workspace, WorkspaceMember, WorkspaceRole


@pytest.fixture()
def account(db_session):
    user = User(email="owner@example.com", hashed_password=hash_password("OriginalPass1"))
    db_session.add(user)
    db_session.flush()
    workspace = Workspace(name="Owner WS", slug="owner-ws")
    db_session.add(workspace)
    db_session.flush()
    db_session.add(WorkspaceMember(workspace_id=workspace.id, user_id=user.id, role=WorkspaceRole.OWNER))
    db_session.commit()
    return user


def bearer(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


def test_password_can_be_changed(client, account, db_session):
    response = client.post(
        "/api/account/change-password",
        json={"current_password": "OriginalPass1", "new_password": "BrandNewPass2"},
        headers=bearer(account),
    )
    assert response.status_code == 204
    db_session.refresh(account)
    assert verify_password("BrandNewPass2", account.hashed_password)


def test_the_current_password_must_be_right(client, account):
    """Otherwise a session left open on a shared machine is enough to take
    the account over."""
    response = client.post(
        "/api/account/change-password",
        json={"current_password": "WrongPass999", "new_password": "BrandNewPass2"},
        headers=bearer(account),
    )
    assert response.status_code == 400


def test_a_short_password_is_refused(client, account):
    response = client.post(
        "/api/account/change-password",
        json={"current_password": "OriginalPass1", "new_password": "short"},
        headers=bearer(account),
    )
    assert response.status_code == 422


def test_changing_a_password_requires_authentication(client, account):
    response = client.post(
        "/api/account/change-password",
        json={"current_password": "OriginalPass1", "new_password": "BrandNewPass2"},
    )
    assert response.status_code == 401


def test_an_account_can_be_deleted_with_its_password(client, account, db_session):
    # Both ids are captured first: reading them off the ORM objects after the
    # rows are gone raises, which is the test tripping over itself rather than
    # a real failure.
    user_id = account.id
    workspace_id = account.memberships[0].workspace_id
    response = client.request(
        "DELETE", "/api/account", json={"password": "OriginalPass1"}, headers=bearer(account)
    )
    assert response.status_code == 204
    assert db_session.query(User).filter(User.id == user_id).first() is None
    assert db_session.query(Workspace).filter(Workspace.id == workspace_id).first() is None


def test_deletion_is_refused_without_the_password(client, account, db_session):
    response = client.request(
        "DELETE", "/api/account", json={"password": "NotThePassword"}, headers=bearer(account)
    )
    assert response.status_code == 400
    assert db_session.query(User).filter(User.id == account.id).first() is not None
