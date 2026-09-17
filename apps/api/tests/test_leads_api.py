from app.models.company import Company, Website, WebsiteStatus
from app.models.lead import Lead, LeadStatus


def _make_lead(db_session, workspace_id, name="Test Co", status=LeadStatus.NEW):
    company = Company(workspace_id=workspace_id, name=name, niche="Cafe", country="Testland", city="Testville")
    db_session.add(company)
    db_session.flush()
    db_session.add(Website(company_id=company.id, status=WebsiteStatus.NO_WEBSITE, last_checked_at="now"))
    lead = Lead(workspace_id=workspace_id, company_id=company.id, status=status, score=80)
    db_session.add(lead)
    db_session.commit()
    db_session.refresh(lead)
    return lead


def test_list_leads_returns_only_workspace_leads(client, db_session, demo_workspace, auth_headers):
    _make_lead(db_session, demo_workspace.id)
    response = client.get("/api/leads", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["company"]["name"] == "Test Co"


def test_get_lead_not_found_returns_404(client, auth_headers):
    response = client.get("/api/leads/does-not-exist", headers=auth_headers)
    assert response.status_code == 404


def test_update_lead_status(client, db_session, demo_workspace, auth_headers):
    lead = _make_lead(db_session, demo_workspace.id)
    response = client.patch(f"/api/leads/{lead.id}", json={"status": "CONTACTED"}, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["status"] == "CONTACTED"


def test_requests_without_auth_headers_use_demo_default(client):
    # No X-Workspace-Id / X-User-Email provided -> falls back to the dev
    # default user, who has no workspace yet -> 401/403, never leaks data.
    response = client.get("/api/leads")
    assert response.status_code in (401, 403)
