"""
Deleting leads.

The interesting cases are the ones where something else points at the lead.
Before this existed, `db.delete(lead)` raised an IntegrityError for any lead
that had been analysed, mailed or unlocked, because none of those references
cascade - so the delete button would have failed on exactly the leads a user
had done the most work on.
"""

import pytest

from app.models.campaign import Campaign, CampaignRecipient
from app.models.company import Company, Contact
from app.models.lead import Lead, LeadActivity, Note
from app.models.misc import AIAnalysis, LeadReveal
from app.models.workspace import User, Workspace, WorkspaceMember, WorkspaceRole
from app.core.security import create_access_token
from app.services import quota as quota_service


def _lead(db_session, workspace, name: str = "Adega do Domingos") -> Lead:
    company = Company(
        workspace_id=workspace.id,
        name=name,
        niche="Restaurant",
        country="Portugal",
        city="Lisboa",
        source="lead_finder",
        external_ref=f"osm-{name.lower().replace(' ', '-')}",
    )
    db_session.add(company)
    db_session.flush()
    db_session.add(Contact(company_id=company.id, phone="+351 21 000 0000"))
    lead = Lead(workspace_id=workspace.id, company_id=company.id, score=90)
    db_session.add(lead)
    db_session.commit()
    return lead


def test_a_lead_can_be_deleted(client, auth_headers, db_session, demo_workspace):
    # The id is captured first: reading it back off the ORM object after the
    # row is gone raises, which would be the test tripping over itself rather
    # than a real failure.
    lead_id = _lead(db_session, demo_workspace).id

    assert client.delete(f"/api/leads/{lead_id}", headers=auth_headers).status_code == 204
    assert db_session.query(Lead).filter(Lead.id == lead_id).first() is None


def test_deleting_takes_the_company_with_it(client, auth_headers, db_session, demo_workspace):
    """A company exists to carry a lead. Left behind it is data the user
    cannot see or reach, and it would block the same business being found
    again by external_ref."""
    lead = _lead(db_session, demo_workspace)
    lead_id, company_id = lead.id, lead.company_id

    client.delete(f"/api/leads/{lead_id}", headers=auth_headers)

    assert db_session.query(Company).filter(Company.id == company_id).first() is None
    assert db_session.query(Contact).filter(Contact.company_id == company_id).first() is None


def test_a_lead_with_an_analysis_and_a_campaign_can_still_be_deleted(
    client, auth_headers, db_session, demo_workspace
):
    """Neither of these cascades, and both hold a non-null foreign key."""
    lead_id = _lead(db_session, demo_workspace).id
    campaign = Campaign(
        workspace_id=demo_workspace.id,
        name="March outreach",
        sender="hi@studio.example",
        subject="A quick note about your website",
    )
    db_session.add(campaign)
    db_session.flush()
    db_session.add(
        CampaignRecipient(campaign_id=campaign.id, lead_id=lead_id, email="hi@adega.pt")
    )
    db_session.add(AIAnalysis(lead_id=lead_id, provider="groq", model="test", result={}))
    db_session.add(LeadActivity(lead_id=lead_id, type="note", message="Called"))
    db_session.add(Note(lead_id=lead_id, body="Interested"))
    db_session.commit()

    assert client.delete(f"/api/leads/{lead_id}", headers=auth_headers).status_code == 204
    assert db_session.query(AIAnalysis).filter(AIAnalysis.lead_id == lead_id).count() == 0
    assert db_session.query(CampaignRecipient).filter(CampaignRecipient.lead_id == lead_id).count() == 0


def test_the_usage_record_survives_the_lead(client, auth_headers, db_session, demo_workspace):
    """The unlock was paid for. Deleting the lead afterwards does not un-read
    the phone number, so the row stays with its lead_id emptied."""
    lead_id = _lead(db_session, demo_workspace).id
    client.post(f"/api/leads/{lead_id}/reveal", headers=auth_headers)

    client.delete(f"/api/leads/{lead_id}", headers=auth_headers)

    reveals = db_session.query(LeadReveal).all()
    assert len(reveals) == 1, "the record of what was spent must not be deleted with the lead"
    assert reveals[0].lead_id is None
    assert quota_service.reveals_used(db_session, demo_workspace.id) == 1


# --- bulk ----------------------------------------------------------------


def test_several_leads_can_be_deleted_at_once(client, auth_headers, db_session, demo_workspace):
    lead_ids = [_lead(db_session, demo_workspace, f"Business {i}").id for i in range(3)]

    response = client.post("/api/leads/delete", json={"lead_ids": lead_ids}, headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["deleted"] == 3
    assert db_session.query(Lead).count() == 0


def test_a_bulk_delete_reports_what_it_actually_deleted(
    client, auth_headers, db_session, demo_workspace
):
    """A selection can contain ids already deleted in another tab. Those are
    skipped rather than failing the request, and the count says so."""
    lead_id = _lead(db_session, demo_workspace).id

    response = client.post(
        "/api/leads/delete",
        json={"lead_ids": [lead_id, "a-lead-that-is-already-gone"]},
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["deleted"] == 1


def test_a_bulk_delete_cannot_reach_another_workspace(client, db_session, demo_workspace):
    """The ids come from the browser, so the workspace filter is the whole of
    the tenant boundary here."""
    victim_id = _lead(db_session, demo_workspace).id

    outsider = User(email="outsider-delete@example.com")
    db_session.add(outsider)
    db_session.flush()
    other = Workspace(name="Other", slug="other-delete-ws")
    db_session.add(other)
    db_session.flush()
    db_session.add(WorkspaceMember(workspace_id=other.id, user_id=outsider.id, role=WorkspaceRole.OWNER))
    db_session.commit()

    response = client.post(
        "/api/leads/delete",
        json={"lead_ids": [victim_id]},
        headers={"Authorization": f"Bearer {create_access_token(outsider.id)}"},
    )

    assert response.json()["deleted"] == 0
    assert db_session.query(Lead).filter(Lead.id == victim_id).first() is not None


def test_an_empty_selection_is_refused(client, auth_headers):
    """Silently succeeding on an empty request would make a broken selection
    look like a successful delete."""
    response = client.post("/api/leads/delete", json={"lead_ids": []}, headers=auth_headers)
    assert response.status_code == 400


def test_a_company_backing_another_lead_is_kept(client, auth_headers, db_session, demo_workspace):
    """The same business can legitimately back two leads. Deleting one must
    not pull the company out from under the other."""
    first = _lead(db_session, demo_workspace)
    first_id, company_id = first.id, first.company_id
    second = Lead(workspace_id=demo_workspace.id, company_id=company_id, score=50)
    db_session.add(second)
    db_session.commit()
    second_id = second.id

    client.delete(f"/api/leads/{first_id}", headers=auth_headers)

    assert db_session.query(Company).filter(Company.id == company_id).first() is not None
    assert db_session.query(Lead).filter(Lead.id == second_id).first() is not None


def test_clearing_every_lead_still_does_not_refund_the_allowance(
    client, auth_headers, db_session, demo_workspace
):
    """The reset path deletes leads in bulk rather than one at a time, which
    skips SQLAlchemy's cascades entirely. The guarantee has to come from the
    database's own ON DELETE SET NULL, so it is worth proving separately -
    otherwise "delete everything" becomes the way to refill the week."""
    lead_id = _lead(db_session, demo_workspace).id
    client.post(f"/api/leads/{lead_id}/reveal", headers=auth_headers)
    assert quota_service.reveals_used(db_session, demo_workspace.id) == 1

    assert client.delete("/api/leads", headers=auth_headers).status_code == 204

    assert db_session.query(Lead).count() == 0
    assert quota_service.reveals_used(db_session, demo_workspace.id) == 1, (
        "clearing the workspace must not hand the week's allowance back"
    )
