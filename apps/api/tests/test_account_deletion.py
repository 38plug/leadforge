"""
Deleting an account, and the workspace it leaves behind.

Fifteen tables point at a workspace and eleven at a user, and none of that is
visible from the call site. The version this replaced handled two of them, so
deleting any account that had actually used the product raised an
IntegrityError - and the suite missed it because SQLite was ignoring foreign
keys at the time.

The realistic fixture below is the point of this file: an account with a
verification token, an analysed lead, an unlock and a bought pack is an
ordinary customer, not an edge case.
"""

import pytest

from app.core.security import create_access_token, hash_password
from app.models.campaign import Campaign, CampaignRecipient
from app.models.company import Company
from app.models.lead import Lead
from app.models.misc import AIAnalysis, AuthToken, CreditPurchase, LeadReveal
from app.models.workspace import User, Workspace, WorkspaceMember, WorkspaceRole
from app.services import quota as quota_service


@pytest.fixture()
def platform_admin(db_session):
    admin = User(
        email="deletion-admin@example.com",
        hashed_password=hash_password("AdminPass123"),
        is_superuser=True,
    )
    db_session.add(admin)
    db_session.flush()
    workspace = Workspace(name="Admin", slug="deletion-admin-ws")
    db_session.add(workspace)
    db_session.flush()
    db_session.add(
        WorkspaceMember(workspace_id=workspace.id, user_id=admin.id, role=WorkspaceRole.OWNER)
    )
    db_session.commit()
    return admin


@pytest.fixture()
def busy_account(client, db_session):
    """An account that has used the product, which is what broke deletion."""
    response = client.post(
        "/api/auth/register",
        json={
            "email": "busy@example.com",
            "password": "GoodPassword123",
            "full_name": "Busy Person",
            "workspace_name": "Busy Studio",
        },
        headers={"X-Forwarded-For": "203.0.113.42"},
    )
    assert response.status_code == 201
    user = db_session.query(User).filter(User.email == "busy@example.com").first()
    workspace_id = user.memberships[0].workspace_id

    company = Company(
        workspace_id=workspace_id,
        name="Adega",
        niche="Restaurant",
        country="Portugal",
        city="Lisboa",
        source="lead_finder",
        external_ref="osm-busy-1",
    )
    db_session.add(company)
    db_session.flush()
    lead = Lead(workspace_id=workspace_id, company_id=company.id, score=80, owner_id=user.id)
    db_session.add(lead)
    db_session.flush()

    campaign = Campaign(
        workspace_id=workspace_id, name="Outreach", sender="hi@busy.example", subject="Hello"
    )
    db_session.add(campaign)
    db_session.flush()
    db_session.add(
        CampaignRecipient(campaign_id=campaign.id, lead_id=lead.id, email="adega@example.com")
    )
    db_session.add(AIAnalysis(lead_id=lead.id, provider="groq", model="m", result={}))
    db_session.add(
        LeadReveal(
            workspace_id=workspace_id, lead_id=lead.id, user_id=user.id, period="2026-W38"
        )
    )
    db_session.add(
        CreditPurchase(
            workspace_id=workspace_id,
            credits=50,
            amount_cents=1000,
            stripe_session_id="cs_busy",
            purchased_by_user_id=user.id,
        )
    )
    db_session.commit()
    return user


def _as_admin(admin):
    return {"Authorization": f"Bearer {create_access_token(admin.id)}"}


def test_an_admin_can_delete_an_account_that_has_used_the_product(
    client, db_session, platform_admin, busy_account
):
    """The reported shape of the bug: everything in the fixture holds a
    foreign key that nothing cascades."""
    user_id = busy_account.id

    response = client.delete(f"/api/admin/users/{user_id}", headers=_as_admin(platform_admin))

    assert response.status_code == 204, response.text[:400]
    assert db_session.query(User).filter(User.id == user_id).first() is None


def test_deleting_an_account_clears_its_verification_token(
    client, db_session, platform_admin, busy_account
):
    """Registration always issues one, so this alone broke every delete."""
    user_id = busy_account.id
    assert db_session.query(AuthToken).filter(AuthToken.user_id == user_id).count() >= 1

    client.delete(f"/api/admin/users/{user_id}", headers=_as_admin(platform_admin))

    assert db_session.query(AuthToken).filter(AuthToken.user_id == user_id).count() == 0


def test_deleting_an_account_takes_its_sole_workspace_and_leads(
    client, db_session, platform_admin, busy_account
):
    workspace_id = busy_account.memberships[0].workspace_id

    client.delete(f"/api/admin/users/{busy_account.id}", headers=_as_admin(platform_admin))

    assert db_session.query(Workspace).filter(Workspace.id == workspace_id).first() is None
    assert db_session.query(Lead).filter(Lead.workspace_id == workspace_id).count() == 0
    assert db_session.query(Company).filter(Company.workspace_id == workspace_id).count() == 0
    assert (
        db_session.query(CreditPurchase)
        .filter(CreditPurchase.workspace_id == workspace_id)
        .count()
        == 0
    )


def test_a_shared_workspace_survives_and_keeps_its_usage(
    client, db_session, platform_admin, busy_account
):
    """Only the membership goes. The colleague's workspace, its leads and the
    unlocks already spent in it are not theirs to lose."""
    workspace_id = busy_account.memberships[0].workspace_id
    colleague = User(email="colleague@example.com", hashed_password=hash_password("Pass123456"))
    db_session.add(colleague)
    db_session.flush()
    db_session.add(
        WorkspaceMember(workspace_id=workspace_id, user_id=colleague.id, role=WorkspaceRole.MEMBER)
    )
    db_session.commit()

    client.delete(f"/api/admin/users/{busy_account.id}", headers=_as_admin(platform_admin))

    assert db_session.query(Workspace).filter(Workspace.id == workspace_id).first() is not None
    assert db_session.query(Lead).filter(Lead.workspace_id == workspace_id).count() == 1
    assert quota_service.reveals_used(db_session, workspace_id, "2026-W38") == 1, (
        "one member leaving must not hand the team's allowance back"
    )


def test_the_unlock_keeps_its_record_when_the_person_who_made_it_goes(
    client, db_session, platform_admin, busy_account
):
    """The unlock was paid for by the workspace. Losing the name is right;
    losing the row would refund it."""
    workspace_id = busy_account.memberships[0].workspace_id
    colleague = User(email="stays@example.com", hashed_password=hash_password("Pass123456"))
    db_session.add(colleague)
    db_session.flush()
    db_session.add(
        WorkspaceMember(workspace_id=workspace_id, user_id=colleague.id, role=WorkspaceRole.MEMBER)
    )
    db_session.commit()

    client.delete(f"/api/admin/users/{busy_account.id}", headers=_as_admin(platform_admin))

    reveal = db_session.query(LeadReveal).filter(LeadReveal.workspace_id == workspace_id).first()
    assert reveal is not None
    assert reveal.user_id is None


def test_someone_can_delete_their_own_account(client, db_session, busy_account):
    """Self-service deletion goes through the same code, so it cannot drift
    into being the broken one."""
    user_id = busy_account.id

    response = client.request(
        "DELETE",
        "/api/account",
        json={"password": "GoodPassword123"},
        headers={"Authorization": f"Bearer {create_access_token(user_id)}"},
    )

    assert response.status_code in (200, 204), response.text[:400]
    assert db_session.query(User).filter(User.id == user_id).first() is None
