from app.models.company import Company
from app.models.lead import Lead
from app.models.workspace import User, Workspace, WorkspaceMember, WorkspaceRole


def test_user_cannot_see_leads_from_another_workspace(client, db_session, demo_workspace, auth_headers):
    other_user = User(email="other@leadforge.dev", full_name="Other User")
    db_session.add(other_user)
    db_session.flush()

    other_workspace = Workspace(name="Other Workspace", slug="other")
    db_session.add(other_workspace)
    db_session.flush()
    db_session.add(WorkspaceMember(workspace_id=other_workspace.id, user_id=other_user.id, role=WorkspaceRole.OWNER))

    company = Company(workspace_id=other_workspace.id, name="Secret Co", niche="Law Firm", country="X", city="Y")
    db_session.add(company)
    db_session.flush()
    lead = Lead(workspace_id=other_workspace.id, company_id=company.id, score=90)
    db_session.add(lead)
    db_session.commit()

    # demo_workspace's own member tries to fetch the other workspace's lead directly
    response = client.get(f"/api/leads/{lead.id}", headers=auth_headers)
    assert response.status_code == 404

    response = client.get("/api/leads", headers=auth_headers)
    assert all(item["company"]["name"] != "Secret Co" for item in response.json())
