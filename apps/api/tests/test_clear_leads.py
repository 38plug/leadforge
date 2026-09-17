from app.models.company import Company
from app.models.lead import Lead, LeadActivity, Note
from app.models.workspace import User, Workspace, WorkspaceMember, WorkspaceRole


def _make_lead(db_session, workspace_id, name="Test Co"):
    company = Company(workspace_id=workspace_id, name=name, niche="Cafe", country="X", city="Y")
    db_session.add(company)
    db_session.flush()
    lead = Lead(workspace_id=workspace_id, company_id=company.id, score=50)
    db_session.add(lead)
    db_session.flush()
    db_session.add(LeadActivity(lead_id=lead.id, type="system", message="created"))
    db_session.add(Note(lead_id=lead.id, body="a note"))
    db_session.commit()
    db_session.refresh(lead)
    return lead


def test_clear_all_leads_removes_leads_and_dependents(client, db_session, demo_workspace, auth_headers):
    _make_lead(db_session, demo_workspace.id, "Co 1")
    _make_lead(db_session, demo_workspace.id, "Co 2")

    response = client.delete("/api/leads", headers=auth_headers)
    assert response.status_code == 204

    assert client.get("/api/leads", headers=auth_headers).json() == []
    assert db_session.query(Lead).filter(Lead.workspace_id == demo_workspace.id).count() == 0
    assert db_session.query(Company).filter(Company.workspace_id == demo_workspace.id).count() == 0
    assert db_session.query(LeadActivity).count() == 0
    assert db_session.query(Note).count() == 0


def test_clear_all_leads_does_not_touch_other_workspaces(client, db_session, demo_workspace, auth_headers):
    other_user = User(email="other-clear@leadforge.dev", full_name="Other")
    db_session.add(other_user)
    db_session.flush()
    other_workspace = Workspace(name="Other", slug="other-clear")
    db_session.add(other_workspace)
    db_session.flush()
    db_session.add(WorkspaceMember(workspace_id=other_workspace.id, user_id=other_user.id, role=WorkspaceRole.OWNER))
    db_session.commit()

    _make_lead(db_session, demo_workspace.id, "Mine")
    other_lead = _make_lead(db_session, other_workspace.id, "Not mine")

    response = client.delete("/api/leads", headers=auth_headers)
    assert response.status_code == 204

    assert db_session.query(Lead).filter(Lead.id == other_lead.id).first() is not None
    assert db_session.query(Lead).filter(Lead.workspace_id == demo_workspace.id).count() == 0


def test_clear_all_leads_on_empty_workspace_is_a_noop(client, auth_headers):
    response = client.delete("/api/leads", headers=auth_headers)
    assert response.status_code == 204
