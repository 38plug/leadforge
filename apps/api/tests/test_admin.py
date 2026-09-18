"""
Platform administration, and the boundary around it.

The tests that matter most here are the negative ones: an ordinary account
must not reach any of this. Hiding the menu is not access control, so every
endpoint is exercised directly.
"""

import pytest

from app.core.security import create_access_token, hash_password
from app.models.workspace import User, Workspace, WorkspaceMember, WorkspaceRole


@pytest.fixture()
def ordinary_user(db_session):
    user = User(
        email="member@example.com",
        full_name="Ordinary Member",
        hashed_password=hash_password("MemberPass123"),
    )
    db_session.add(user)
    db_session.flush()
    workspace = Workspace(name="Member Workspace", slug="member-ws")
    db_session.add(workspace)
    db_session.flush()
    db_session.add(
        WorkspaceMember(workspace_id=workspace.id, user_id=user.id, role=WorkspaceRole.OWNER)
    )
    db_session.commit()
    return user


@pytest.fixture()
def superuser(db_session):
    user = User(
        email="platform-admin@example.com",
        full_name="Platform Admin",
        hashed_password=hash_password("AdminPass123"),
        is_superuser=True,
    )
    db_session.add(user)
    db_session.flush()
    workspace = Workspace(name="Admin Workspace", slug="admin-ws")
    db_session.add(workspace)
    db_session.flush()
    db_session.add(
        WorkspaceMember(workspace_id=workspace.id, user_id=user.id, role=WorkspaceRole.OWNER)
    )
    db_session.commit()
    return user


def bearer(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


# ----------------------------------------------------------- the boundary

ADMIN_READS = ["/api/admin/overview", "/api/admin/users", "/api/admin/workspaces", "/api/admin/coupons"]


@pytest.mark.parametrize("path", ADMIN_READS)
def test_an_ordinary_account_cannot_read_platform_data(client, ordinary_user, path):
    assert client.get(path, headers=bearer(ordinary_user)).status_code == 403


@pytest.mark.parametrize("path", ADMIN_READS)
def test_platform_data_needs_authentication(client, path):
    """No token at all must not fall through to anything."""
    assert client.get(path, headers={"Authorization": "Bearer nonsense"}).status_code == 401


def test_an_ordinary_account_cannot_delete_another_account(client, ordinary_user, superuser):
    response = client.delete(f"/api/admin/users/{superuser.id}", headers=bearer(ordinary_user))
    assert response.status_code == 403


def test_an_ordinary_account_cannot_promote_itself(client, ordinary_user):
    """The obvious attack: grant yourself the flag that guards everything."""
    response = client.patch(
        f"/api/admin/users/{ordinary_user.id}",
        json={"is_superuser": True},
        headers=bearer(ordinary_user),
    )
    assert response.status_code == 403


def test_registration_cannot_create_a_superuser(client):
    """is_superuser must not be settable from an unauthenticated endpoint,
    whatever extra fields are posted."""
    response = client.post(
        "/api/auth/register",
        json={
            "email": "sneaky@example.com",
            "password": "SneakyPass123",
            "full_name": "Sneaky",
            "workspace_name": "Sneaky WS",
            "is_superuser": True,
        },
    )
    assert response.status_code == 201
    token = response.json()["access_token"]
    assert client.get("/api/admin/users", headers={"Authorization": f"Bearer {token}"}).status_code == 403


# ------------------------------------------------------------ the happy path


def test_an_administrator_sees_every_account(client, superuser, ordinary_user):
    response = client.get("/api/admin/users", headers=bearer(superuser))
    assert response.status_code == 200
    emails = {row["email"] for row in response.json()}
    assert {"platform-admin@example.com", "member@example.com"} <= emails


def test_an_administrator_can_deactivate_an_account(client, superuser, ordinary_user, db_session):
    response = client.patch(
        f"/api/admin/users/{ordinary_user.id}",
        json={"is_active": False},
        headers=bearer(superuser),
    )
    assert response.status_code == 200
    assert response.json()["is_active"] is False

    # A deactivated account must actually lose access, not merely display as off.
    assert client.get("/api/leads", headers=bearer(ordinary_user)).status_code == 401


def test_an_administrator_cannot_lock_themselves_out(client, superuser):
    """Removing the last administrator's own access is unrecoverable in-product."""
    for payload in ({"is_superuser": False}, {"is_active": False}):
        response = client.patch(
            f"/api/admin/users/{superuser.id}", json=payload, headers=bearer(superuser)
        )
        assert response.status_code == 400

    response = client.delete(f"/api/admin/users/{superuser.id}", headers=bearer(superuser))
    assert response.status_code == 400


def test_deleting_an_account_removes_the_workspace_it_solely_owned(
    client, superuser, ordinary_user, db_session
):
    workspace_id = ordinary_user.memberships[0].workspace_id

    assert client.delete(f"/api/admin/users/{ordinary_user.id}", headers=bearer(superuser)).status_code == 204

    assert db_session.query(User).filter(User.id == ordinary_user.id).first() is None
    assert db_session.query(Workspace).filter(Workspace.id == workspace_id).first() is None


def test_a_shared_workspace_survives_one_member_being_deleted(
    client, superuser, ordinary_user, db_session
):
    """Removing other people's data because one owner left would be wrong."""
    workspace_id = ordinary_user.memberships[0].workspace_id
    colleague = User(email="colleague@example.com", hashed_password=hash_password("Pass12345"))
    db_session.add(colleague)
    db_session.flush()
    db_session.add(
        WorkspaceMember(workspace_id=workspace_id, user_id=colleague.id, role=WorkspaceRole.MEMBER)
    )
    db_session.commit()

    assert client.delete(f"/api/admin/users/{ordinary_user.id}", headers=bearer(superuser)).status_code == 204
    assert db_session.query(Workspace).filter(Workspace.id == workspace_id).first() is not None


def test_an_administrator_can_change_a_workspace_plan(client, superuser, ordinary_user, db_session):
    workspace_id = ordinary_user.memberships[0].workspace_id
    response = client.patch(
        f"/api/admin/workspaces/{workspace_id}", json={"plan": "PRO"}, headers=bearer(superuser)
    )
    assert response.status_code == 200
    assert response.json()["plan"] == "PRO"


def test_an_unknown_plan_is_refused(client, superuser, ordinary_user):
    workspace_id = ordinary_user.memberships[0].workspace_id
    response = client.patch(
        f"/api/admin/workspaces/{workspace_id}", json={"plan": "PLATINUM"}, headers=bearer(superuser)
    )
    assert response.status_code == 400


# ---------------------------------------------------------------- coupons


def test_a_coupon_can_be_created_and_listed(client, superuser):
    created = client.post(
        "/api/admin/coupons",
        json={"code": "partner25", "description": "Partnership", "percent_off": 25},
        headers=bearer(superuser),
    )
    assert created.status_code == 201
    assert created.json()["code"] == "PARTNER25", "codes are normalised so case cannot duplicate one"

    listed = client.get("/api/admin/coupons", headers=bearer(superuser))
    assert [row["code"] for row in listed.json()] == ["PARTNER25"]


def test_a_duplicate_coupon_code_is_refused(client, superuser):
    body = {"code": "LAUNCH", "percent_off": 10}
    assert client.post("/api/admin/coupons", json=body, headers=bearer(superuser)).status_code == 201
    assert client.post("/api/admin/coupons", json=body, headers=bearer(superuser)).status_code == 409


def test_a_coupon_needs_exactly_one_kind_of_discount(client, superuser):
    both = client.post(
        "/api/admin/coupons",
        json={"code": "BOTH", "percent_off": 10, "amount_off_cents": 500},
        headers=bearer(superuser),
    )
    neither = client.post("/api/admin/coupons", json={"code": "NEITHER"}, headers=bearer(superuser))
    assert both.status_code == 422 and neither.status_code == 422


def test_revoking_a_coupon_keeps_the_record(client, superuser):
    coupon_id = client.post(
        "/api/admin/coupons", json={"code": "TEMP", "percent_off": 5}, headers=bearer(superuser)
    ).json()["id"]

    assert client.delete(f"/api/admin/coupons/{coupon_id}", headers=bearer(superuser)).status_code == 204

    remaining = client.get("/api/admin/coupons", headers=bearer(superuser)).json()
    assert remaining[0]["is_active"] is False, "an issued code keeps its history"


def test_the_overview_reports_that_no_payment_provider_is_connected(client, superuser):
    """The admin screen needs to distinguish 'no revenue' from 'not wired up'."""
    body = client.get("/api/admin/overview", headers=bearer(superuser)).json()
    assert body["payment_provider_connected"] is False
    assert body["paying_subscriptions"] == 0
