"""
Re-running a save over the same area is a normal thing to do (refreshing
an area, widening filters, searching from a different device). These tests
pin the behaviour that made it safe: no duplicate companies, no duplicate
website rows, no duplicate leads, and no clobbering of pipeline status.

Search now returns preview results without saving; leads are persisted only
when the user explicitly saves them via POST /api/leads/save.
"""

from app.models.company import Company, Website
from app.models.lead import Lead, LeadStatus


def _make_preview(**overrides):
    """Build a LeadPreview dict for the save endpoint."""
    base = {
        "external_ref": "osm-node-1",
        "name": "Café Central",
        "niche": "Cafe",
        "country": "Portugal",
        "city": "Lisbon",
        "address": None,
        "phone": "+351 000 000",
        "email": None,
        "instagram": None,
        "website": None,
        "maps_url": None,
        "rating": None,
        "reviews_count": None,
        "hours": "Mo-Fr 09:00-18:00",
        "description": None,
        "website_status": "UNKNOWN",
        "score": {
            "score": 75,
            "breakdown": [{"label": "No website", "points": 55}, {"label": "Phone", "points": 15}],
            "recommendation": "Strong opportunity",
            "priority": "HIGH",
        },
    }
    base.update(overrides)
    return base


def test_repeat_save_does_not_duplicate_company_website_or_lead(client, db_session, demo_workspace, auth_headers):
    preview = _make_preview()
    first = client.post("/api/leads/save", json={"leads": [preview]}, headers=auth_headers)
    assert first.status_code == 201
    assert first.json()["saved"] == 1

    second = client.post("/api/leads/save", json={"leads": [preview]}, headers=auth_headers)
    assert second.status_code == 201, second.text

    assert db_session.query(Company).filter(Company.workspace_id == demo_workspace.id).count() == 1
    assert db_session.query(Lead).filter(Lead.workspace_id == demo_workspace.id).count() == 1
    company = db_session.query(Company).filter(Company.workspace_id == demo_workspace.id).one()
    assert db_session.query(Website).filter(Website.company_id == company.id).count() == 1


def test_save_preserves_pipeline_status(client, db_session, demo_workspace, auth_headers):
    preview = _make_preview()
    client.post("/api/leads/save", json={"leads": [preview]}, headers=auth_headers)
    lead = db_session.query(Lead).filter(Lead.workspace_id == demo_workspace.id).one()

    client.patch(f"/api/leads/{lead.id}", json={"status": "MEETING"}, headers=auth_headers)

    client.post("/api/leads/save", json={"leads": [preview]}, headers=auth_headers)

    db_session.expire_all()
    refreshed = db_session.query(Lead).filter(Lead.id == lead.id).one()
    assert refreshed.status == LeadStatus.MEETING, "a re-save must not reset a lead already in the pipeline"


def test_search_returns_preview_without_saving(client, db_session, demo_workspace, auth_headers):
    """Search should return preview results without persisting to the database."""
    from unittest.mock import patch
    from app.providers.business import BusinessResult

    fake = BusinessResult(
        external_ref="osm-node-1",
        name="Café Central",
        niche="Cafe",
        country="Portugal",
        city="Lisbon",
        phone="+351 000 000",
        hours="Mo-Fr 09:00-18:00",
    )
    with patch("app.routers.leads.get_business_provider") as mock_provider:
        mock_provider.return_value.search.return_value = [fake]
        resp = client.post(
            "/api/leads/search",
            json={"filters": {"city": "Lisbon", "country": "Portugal", "niche": "Cafe"}},
            headers=auth_headers,
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["total_found"] == 1
    assert data["leads"][0]["external_ref"] == "osm-node-1"
    assert data["leads"][0]["name"] == "Café Central"

    # No records should be created in the database
    assert db_session.query(Company).filter(Company.workspace_id == demo_workspace.id).count() == 0
    assert db_session.query(Lead).filter(Lead.workspace_id == demo_workspace.id).count() == 0
