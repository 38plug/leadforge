"""
Re-running a search over the same area is a normal thing to do (refreshing
an area, widening filters, searching from a different device). These tests
pin the behaviour that made it safe: no duplicate companies, no duplicate
website rows, no duplicate leads, and no clobbering of pipeline status.
"""

from unittest.mock import patch

from app.models.company import Company, Website
from app.models.lead import Lead, LeadStatus
from app.providers.business import BusinessResult


def _fake_businesses():
    return [
        BusinessResult(
            external_ref="osm-node-1",
            name="Café Central",
            niche="Cafe",
            country="Portugal",
            city="Lisbon",
            phone="+351 000 000",
            hours="Mo-Fr 09:00-18:00",
        )
    ]


def _run_search(client, auth_headers):
    with patch("app.routers.leads.get_business_provider") as mock_provider:
        mock_provider.return_value.search.return_value = _fake_businesses()
        return client.post(
            "/api/leads/search",
            json={"filters": {"city": "Lisbon", "country": "Portugal", "niche": "Cafe"}},
            headers=auth_headers,
        )


def test_repeat_search_does_not_duplicate_company_website_or_lead(client, db_session, demo_workspace, auth_headers):
    first = _run_search(client, auth_headers)
    assert first.status_code == 200
    assert first.json()["total_found"] == 1

    second = _run_search(client, auth_headers)
    assert second.status_code == 200, second.text

    assert db_session.query(Company).filter(Company.workspace_id == demo_workspace.id).count() == 1
    assert db_session.query(Lead).filter(Lead.workspace_id == demo_workspace.id).count() == 1
    company = db_session.query(Company).filter(Company.workspace_id == demo_workspace.id).one()
    assert db_session.query(Website).filter(Website.company_id == company.id).count() == 1


def test_repeat_search_refreshes_business_details(client, db_session, demo_workspace, auth_headers):
    """Re-searching an area should pick up renames/new phone numbers."""
    _run_search(client, auth_headers)

    updated = [
        BusinessResult(
            external_ref="osm-node-1",
            name="Café Central (renamed)",
            niche="Cafe",
            country="Portugal",
            city="Lisbon",
            phone="+351 111 111",
            hours="Mo-Fr 09:00-18:00",
        )
    ]
    with patch("app.routers.leads.get_business_provider") as mock_provider:
        mock_provider.return_value.search.return_value = updated
        client.post(
            "/api/leads/search",
            json={"filters": {"city": "Lisbon", "country": "Portugal", "niche": "Cafe"}},
            headers=auth_headers,
        )

    db_session.expire_all()
    company = db_session.query(Company).filter(Company.workspace_id == demo_workspace.id).one()
    assert company.name == "Café Central (renamed)"
    assert company.contacts[0].phone == "+351 111 111"


def test_repeat_search_preserves_pipeline_status(client, db_session, demo_workspace, auth_headers):
    _run_search(client, auth_headers)
    lead = db_session.query(Lead).filter(Lead.workspace_id == demo_workspace.id).one()

    client.patch(f"/api/leads/{lead.id}", json={"status": "MEETING"}, headers=auth_headers)

    _run_search(client, auth_headers)

    db_session.expire_all()
    refreshed = db_session.query(Lead).filter(Lead.id == lead.id).one()
    assert refreshed.status == LeadStatus.MEETING, "a re-search must not reset a lead already in the pipeline"
