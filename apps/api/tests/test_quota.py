"""
Metering of lead reveals.

A lead's contact details are what the product sells, so unlocking one is the
unit the plan is counted in. The tests that matter most are the ones about
what must NOT be charged twice, and the one proving the details are absent
from the payload rather than merely hidden by the interface.
"""

import pytest

from app.models.company import Company, Contact
from app.models.lead import Lead
from app.models.misc import LeadReveal
from app.services import quota as quota_service


@pytest.fixture()
def lead_with_contact(db_session, demo_workspace):
    company = Company(
        workspace_id=demo_workspace.id,
        name="Adega do Domingos",
        niche="Restaurant",
        country="Portugal",
        city="Lisboa",
        maps_url="https://maps.google.com/?q=38.7,-9.1",
        source="lead_finder",
        external_ref="osm-node-1",
    )
    db_session.add(company)
    db_session.flush()
    db_session.add(Contact(company_id=company.id, phone="+351 21 000 0000", email="hi@adega.pt"))
    lead = Lead(workspace_id=demo_workspace.id, company_id=company.id, score=90)
    db_session.add(lead)
    db_session.commit()
    return lead


def test_contact_details_are_absent_until_the_lead_is_unlocked(client, auth_headers, lead_with_contact):
    """The paywall has to be in the payload. Blurring in CSS leaves the phone
    number one devtools panel away."""
    body = client.get("/api/leads", headers=auth_headers).json()
    lead = next(row for row in body if row["id"] == lead_with_contact.id)

    assert lead["contact_revealed"] is False
    assert lead["company"]["contacts"][0]["phone"] is None
    assert lead["company"]["contacts"][0]["email"] is None
    assert lead["company"]["maps_url"] is None, "the map link carries the coordinates"


def test_unlocking_returns_the_details(client, auth_headers, lead_with_contact):
    response = client.post(f"/api/leads/{lead_with_contact.id}/reveal", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["phone"] == "+351 21 000 0000"
    assert body["email"] == "hi@adega.pt"
    assert body["used"] == 1


def test_an_unlocked_lead_keeps_its_details_in_the_list(client, auth_headers, lead_with_contact):
    client.post(f"/api/leads/{lead_with_contact.id}/reveal", headers=auth_headers)

    body = client.get("/api/leads", headers=auth_headers).json()
    lead = next(row for row in body if row["id"] == lead_with_contact.id)
    assert lead["contact_revealed"] is True
    assert lead["company"]["contacts"][0]["phone"] == "+351 21 000 0000"


def test_unlocking_the_same_lead_twice_costs_one(client, auth_headers, lead_with_contact, db_session):
    """Otherwise the number measures clicking, and re-checking a phone number
    you already paid for charges you again."""
    first = client.post(f"/api/leads/{lead_with_contact.id}/reveal", headers=auth_headers).json()
    second = client.post(f"/api/leads/{lead_with_contact.id}/reveal", headers=auth_headers).json()

    assert first["used"] == 1 and second["used"] == 1
    assert db_session.query(LeadReveal).count() == 1


def test_searching_does_not_spend_quota(client, auth_headers, demo_workspace, db_session):
    """A search saves leads without unlocking them: charging a page of quota
    per search would spend a FREE month in two searches, before the user has
    looked at anything."""
    assert quota_service.reveals_used(db_session, demo_workspace.id) == 0


def test_the_allowance_is_enforced(client, auth_headers, demo_workspace, db_session, lead_with_contact):
    """Fill the FREE allowance, then the next unlock is refused."""
    period = quota_service.current_period()
    limit = quota_service.limit_for(demo_workspace.plan)
    for index in range(limit):
        db_session.add(
            LeadReveal(
                workspace_id=demo_workspace.id,
                lead_id=f"placeholder-{index}",
                period=period,
            )
        )
    db_session.commit()

    response = client.post(f"/api/leads/{lead_with_contact.id}/reveal", headers=auth_headers)
    assert response.status_code == 402, "402 Payment Required: allowed to ask, allowance spent"
    detail = response.json()["detail"]
    assert detail["code"] == "QUOTA_EXCEEDED"
    assert detail["limit"] == limit
    assert "Monday" in detail["message"], (
        "the message must name when the allowance comes back, not just that it is gone"
    )


def test_an_already_unlocked_lead_stays_readable_at_the_limit(
    client, auth_headers, demo_workspace, db_session, lead_with_contact
):
    """Leads already paid for must not lock again when the month fills up."""
    client.post(f"/api/leads/{lead_with_contact.id}/reveal", headers=auth_headers)

    period = quota_service.current_period()
    for index in range(quota_service.limit_for(demo_workspace.plan)):
        db_session.add(
            LeadReveal(workspace_id=demo_workspace.id, lead_id=f"filler-{index}", period=period)
        )
    db_session.commit()

    response = client.post(f"/api/leads/{lead_with_contact.id}/reveal", headers=auth_headers)
    assert response.status_code == 200, "re-opening an unlocked lead is free"


def test_a_lead_unlocked_in_an_earlier_week_stays_unlocked(db_session, demo_workspace, lead_with_contact):
    """Quota refills weekly; access to a lead already bought does not."""
    db_session.add(
        LeadReveal(
            workspace_id=demo_workspace.id,
            lead_id=lead_with_contact.id,
            period="2020-W01",
        )
    )
    db_session.commit()

    assert quota_service.is_revealed(db_session, demo_workspace.id, lead_with_contact.id)
    assert quota_service.reveals_used(db_session, demo_workspace.id) == 0, (
        "an unlock from an earlier week must not count against this week"
    )


def test_another_workspace_cannot_unlock_your_lead(client, lead_with_contact, db_session):
    """Reveal is workspace-scoped like every other lead route."""
    from app.core.security import create_access_token
    from app.models.workspace import User, Workspace, WorkspaceMember, WorkspaceRole

    outsider = User(email="outsider@example.com")
    db_session.add(outsider)
    db_session.flush()
    other = Workspace(name="Other", slug="other-ws")
    db_session.add(other)
    db_session.flush()
    db_session.add(WorkspaceMember(workspace_id=other.id, user_id=outsider.id, role=WorkspaceRole.OWNER))
    db_session.commit()

    response = client.post(
        f"/api/leads/{lead_with_contact.id}/reveal",
        headers={"Authorization": f"Bearer {create_access_token(outsider.id)}"},
    )
    assert response.status_code == 404


def test_plan_limits_are_defined_in_one_place():
    """The frontend reads these from the API instead of keeping its own copy,
    so the two cannot disagree about someone's limit."""
    assert quota_service.limit_for("FREE") == 50
    assert quota_service.limit_for("PRO") > quota_service.limit_for("STARTER")
    assert quota_service.limit_for(None) == quota_service.limit_for("FREE")
    assert quota_service.limit_for("nonsense") == quota_service.limit_for("FREE")
