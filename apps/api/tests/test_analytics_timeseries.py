"""The dashboard charts must count from real rows, starting at zero."""

from app.models.company import Company
from app.models.lead import Lead, LeadStatus


def test_a_fresh_workspace_reports_zero_across_every_chart(client, auth_headers):
    body = client.get("/api/analytics/timeseries", headers=auth_headers).json()

    assert len(body["acquisition"]) == 7
    assert all(point["found"] == 0 and point["won"] == 0 for point in body["acquisition"])
    assert all(point["sent"] == 0 and point["replied"] == 0 for point in body["outreach"])
    assert [stage["value"] for stage in body["funnel"]] == [0, 0, 0, 0, 0]
    assert [stage["name"] for stage in body["funnel"]] == [
        "Leads Found",
        "Contacted",
        "Interested",
        "Meeting",
        "Won",
    ]


def test_a_saved_lead_shows_up_on_todays_bucket(client, auth_headers, db_session, demo_workspace):
    company = Company(workspace_id=demo_workspace.id, name="Real Cafe", niche="Cafe", city="Köln", country="DE")
    db_session.add(company)
    db_session.flush()
    db_session.add(Lead(workspace_id=demo_workspace.id, company_id=company.id, status=LeadStatus.MEETING))
    db_session.commit()

    body = client.get("/api/analytics/timeseries", headers=auth_headers).json()

    assert body["acquisition"][-1]["found"] == 1
    assert body["acquisition"][-1]["won"] == 0
    # A lead at MEETING counts toward every earlier funnel stage, not just its own.
    assert [stage["value"] for stage in body["funnel"]] == [1, 1, 1, 1, 0]


def test_the_window_is_configurable(client, auth_headers):
    body = client.get("/api/analytics/timeseries?days=30", headers=auth_headers).json()
    assert len(body["acquisition"]) == 30
    assert len(body["outreach"]) == 30
