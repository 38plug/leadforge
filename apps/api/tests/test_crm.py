from app.models.company import Company
from app.models.lead import Lead


def _make_lead(db_session, workspace_id):
    company = Company(workspace_id=workspace_id, name="Test Co", niche="Cafe", country="X", city="Y")
    db_session.add(company)
    db_session.flush()
    lead = Lead(workspace_id=workspace_id, company_id=company.id, score=50)
    db_session.add(lead)
    db_session.commit()
    db_session.refresh(lead)
    return lead


def test_create_and_list_notes(client, db_session, demo_workspace, auth_headers):
    lead = _make_lead(db_session, demo_workspace.id)
    response = client.post(f"/api/leads/{lead.id}/notes", json={"body": "Called, left voicemail"}, headers=auth_headers)
    assert response.status_code == 201
    assert response.json()["body"] == "Called, left voicemail"

    listed = client.get(f"/api/leads/{lead.id}/notes", headers=auth_headers)
    assert listed.status_code == 200
    assert len(listed.json()) == 1


def test_create_update_delete_task(client, db_session, demo_workspace, auth_headers):
    lead = _make_lead(db_session, demo_workspace.id)
    created = client.post(f"/api/leads/{lead.id}/tasks", json={"title": "Follow up"}, headers=auth_headers)
    assert created.status_code == 201
    task_id = created.json()["id"]

    updated = client.patch(f"/api/leads/{lead.id}/tasks/{task_id}", json={"completed": True}, headers=auth_headers)
    assert updated.status_code == 200
    assert updated.json()["completed"] is True

    deleted = client.delete(f"/api/leads/{lead.id}/tasks/{task_id}", headers=auth_headers)
    assert deleted.status_code == 204

    remaining = client.get(f"/api/leads/{lead.id}/tasks", headers=auth_headers)
    assert remaining.json() == []


def test_activity_records_note_and_task_events(client, db_session, demo_workspace, auth_headers):
    lead = _make_lead(db_session, demo_workspace.id)
    client.post(f"/api/leads/{lead.id}/notes", json={"body": "hi"}, headers=auth_headers)
    client.post(f"/api/leads/{lead.id}/tasks", json={"title": "Call back"}, headers=auth_headers)

    activity = client.get(f"/api/leads/{lead.id}/activity", headers=auth_headers)
    types = [a["type"] for a in activity.json()]
    assert "note" in types
    assert "system" in types


def test_notes_scoped_to_workspace(client, db_session, demo_workspace, auth_headers):
    other_lead_id = "does-not-exist-in-workspace"
    response = client.get(f"/api/leads/{other_lead_id}/notes", headers=auth_headers)
    assert response.status_code == 404
