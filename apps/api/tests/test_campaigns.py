from app.models.campaign import SuppressionEntry
from app.models.company import Company, Contact
from app.models.lead import Lead


def _make_lead_with_email(db_session, workspace_id, email="lead@example.com", name="Test Co"):
    company = Company(workspace_id=workspace_id, name=name, niche="Cafe", country="X", city="Y")
    db_session.add(company)
    db_session.flush()
    db_session.add(Contact(company_id=company.id, email=email))
    lead = Lead(workspace_id=workspace_id, company_id=company.id, score=80)
    db_session.add(lead)
    db_session.commit()
    db_session.refresh(lead)
    return lead


def _create_campaign(client, auth_headers, **overrides):
    payload = {
        "name": "Test Campaign",
        "sender": "you@youragency.com",
        "subject": "Quick idea for {{company_name}}",
    }
    payload.update(overrides)
    response = client.post("/api/campaigns", json=payload, headers=auth_headers)
    assert response.status_code == 201
    return response.json()


def test_send_campaign_delivers_to_valid_lead(client, db_session, demo_workspace, auth_headers):
    lead = _make_lead_with_email(db_session, demo_workspace.id)
    campaign = _create_campaign(client, auth_headers)

    response = client.post(
        f"/api/campaigns/{campaign['id']}/send", json={"lead_ids": [lead.id]}, headers=auth_headers
    )
    assert response.status_code == 200
    body = response.json()
    assert body == {"queued": 1, "skipped_suppressed": 0, "skipped_duplicate": 0, "sent": 1}

    recipients = client.get(f"/api/campaigns/{campaign['id']}/recipients", headers=auth_headers).json()
    assert len(recipients) == 1
    assert recipients[0]["status"] == "SENT"


def test_sending_twice_to_the_same_lead_is_deduplicated(client, db_session, demo_workspace, auth_headers):
    lead = _make_lead_with_email(db_session, demo_workspace.id)
    campaign = _create_campaign(client, auth_headers)

    client.post(f"/api/campaigns/{campaign['id']}/send", json={"lead_ids": [lead.id]}, headers=auth_headers)
    second = client.post(
        f"/api/campaigns/{campaign['id']}/send", json={"lead_ids": [lead.id]}, headers=auth_headers
    )
    assert second.json() == {"queued": 0, "skipped_suppressed": 0, "skipped_duplicate": 1, "sent": 0}


def test_suppressed_email_is_never_sent(client, db_session, demo_workspace, auth_headers):
    lead = _make_lead_with_email(db_session, demo_workspace.id, email="opted-out@example.com")
    db_session.add(SuppressionEntry(workspace_id=demo_workspace.id, email="opted-out@example.com", reason="unsubscribed"))
    db_session.commit()

    campaign = _create_campaign(client, auth_headers)
    response = client.post(
        f"/api/campaigns/{campaign['id']}/send", json={"lead_ids": [lead.id]}, headers=auth_headers
    )
    assert response.json() == {"queued": 0, "skipped_suppressed": 1, "skipped_duplicate": 0, "sent": 0}


def test_unsubscribe_endpoint_suppresses_future_sends(client, db_session, demo_workspace, auth_headers):
    lead = _make_lead_with_email(db_session, demo_workspace.id, email="unsub-me@example.com")
    campaign = _create_campaign(client, auth_headers)

    unsub = client.post(
        "/api/campaigns/unsubscribe",
        params={"workspace_id": demo_workspace.id, "email": "unsub-me@example.com"},
    )
    assert unsub.status_code == 204

    response = client.post(
        f"/api/campaigns/{campaign['id']}/send", json={"lead_ids": [lead.id]}, headers=auth_headers
    )
    assert response.json()["skipped_suppressed"] == 1


def test_daily_send_limit_is_respected(client, db_session, demo_workspace, auth_headers):
    leads = [
        _make_lead_with_email(db_session, demo_workspace.id, email=f"lead{i}@example.com", name=f"Co {i}")
        for i in range(3)
    ]
    campaign = _create_campaign(client, auth_headers, daily_send_limit=2)

    response = client.post(
        f"/api/campaigns/{campaign['id']}/send",
        json={"lead_ids": [l.id for l in leads]},
        headers=auth_headers,
    )
    body = response.json()
    # All 3 are queued as recipients, but only 2 actually get sent under the limit
    assert body["queued"] == 3
    assert body["sent"] == 2


def test_paused_campaign_refuses_to_send(client, db_session, demo_workspace, auth_headers):
    lead = _make_lead_with_email(db_session, demo_workspace.id)
    campaign = _create_campaign(client, auth_headers)
    pause = client.patch(f"/api/campaigns/{campaign['id']}/status", json={"status": "PAUSED"}, headers=auth_headers)
    assert pause.status_code == 200

    response = client.post(
        f"/api/campaigns/{campaign['id']}/send", json={"lead_ids": [lead.id]}, headers=auth_headers
    )
    assert response.status_code == 409
