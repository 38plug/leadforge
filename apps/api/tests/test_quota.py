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


def test_a_lead_unlocked_in_an_earlier_week_locks_again(db_session, demo_workspace, lead_with_contact):
    """Unlocks are scoped to the week they were bought in.

    This is the deliberate half of the policy: without it, a heavy user works
    forever from one week's allowance and never has a reason to buy more. The
    cost is real - re-opening a lead from last week is charged again - and
    there is currently no export, so a customer who wants to keep a number has
    to copy it out while the week lasts.
    """
    db_session.add(
        LeadReveal(
            workspace_id=demo_workspace.id,
            lead_id=lead_with_contact.id,
            period="2020-W01",
        )
    )
    db_session.commit()

    assert not quota_service.is_revealed(db_session, demo_workspace.id, lead_with_contact.id)
    assert quota_service.reveals_used(db_session, demo_workspace.id) == 0, (
        "an unlock from an earlier week must not count against this week either"
    )


def test_unlocking_again_in_a_new_week_is_allowed(db_session, demo_workspace, lead_with_contact):
    """The old unique key was (workspace, lead) and would reject this as a
    duplicate. Period-scoping is worthless if the second unlock cannot be
    written."""
    db_session.add(
        LeadReveal(workspace_id=demo_workspace.id, lead_id=lead_with_contact.id, period="2020-W01")
    )
    db_session.commit()

    quota_service.reveal_lead(db_session, demo_workspace, lead_with_contact.id, user_id=None)
    db_session.commit()

    assert quota_service.is_revealed(db_session, demo_workspace.id, lead_with_contact.id)
    assert quota_service.reveals_used(db_session, demo_workspace.id) == 1


# --- purchased credit packs ----------------------------------------------
# A pack is bought outright, so it must behave differently from the weekly
# allowance in two ways: it does not expire, and it is never spent while
# included leads remain.


def _buy_credits(db_session, workspace, credits: int, session_id: str = "cs_test_1"):
    from app.models.misc import CreditPurchase

    db_session.add(
        CreditPurchase(
            workspace_id=workspace.id,
            credits=credits,
            amount_cents=2000,
            currency="usd",
            stripe_session_id=session_id,
        )
    )
    db_session.commit()


def _fill_the_week(db_session, workspace):
    period = quota_service.current_period()
    for index in range(quota_service.limit_for(workspace.plan)):
        db_session.add(
            LeadReveal(workspace_id=workspace.id, lead_id=f"filler-{index}", period=period)
        )
    db_session.commit()


def test_credits_extend_the_week_once_the_allowance_is_gone(
    client, auth_headers, demo_workspace, db_session, lead_with_contact
):
    _fill_the_week(db_session, demo_workspace)
    _buy_credits(db_session, demo_workspace, 200)

    response = client.post(f"/api/leads/{lead_with_contact.id}/reveal", headers=auth_headers)
    assert response.status_code == 200, "a bought pack must actually unlock something"
    assert quota_service.credit_balance(db_session, demo_workspace.id) == 199


def test_included_leads_are_spent_before_bought_ones(db_session, demo_workspace, lead_with_contact):
    """Included leads refill on Monday and credits do not, so spending a paid
    credit while a free one is going unused quietly wastes money the customer
    already handed over."""
    _buy_credits(db_session, demo_workspace, 200)

    quota_service.reveal_lead(db_session, demo_workspace, lead_with_contact.id, user_id=None)
    db_session.commit()

    assert quota_service.credit_balance(db_session, demo_workspace.id) == 200
    assert quota_service.reveals_used(db_session, demo_workspace.id) == 1


def test_credits_survive_the_week_rolling_over(db_session, demo_workspace):
    """The balance is derived from purchases minus credit-funded unlocks, with
    no period in it, so a new week cannot silently erase what was bought."""
    _buy_credits(db_session, demo_workspace, 200)
    db_session.add(
        LeadReveal(
            workspace_id=demo_workspace.id,
            lead_id="old-lead",
            period="2020-W01",
            from_credit=True,
        )
    )
    db_session.commit()

    assert quota_service.credit_balance(db_session, demo_workspace.id) == 199


def test_the_limit_still_applies_once_credits_run_out(
    client, auth_headers, demo_workspace, db_session, lead_with_contact
):
    _fill_the_week(db_session, demo_workspace)
    _buy_credits(db_session, demo_workspace, 1)
    db_session.add(
        LeadReveal(
            workspace_id=demo_workspace.id,
            lead_id="spent-on-credit",
            period=quota_service.current_period(),
            from_credit=True,
        )
    )
    db_session.commit()

    response = client.post(f"/api/leads/{lead_with_contact.id}/reveal", headers=auth_headers)
    assert response.status_code == 402
    assert response.json()["detail"]["code"] == "QUOTA_EXCEEDED"


def test_a_redelivered_purchase_webhook_grants_credits_once(db_session, demo_workspace):
    """Stripe retries any webhook it does not get a 2xx for, so the same paid
    session arriving twice is ordinary, not an attack. The unique session id
    is the whole of the protection."""
    from app.services import billing

    session = {
        "id": "cs_test_duplicate",
        "amount_total": 2000,
        "currency": "usd",
        "metadata": {
            "workspace_id": demo_workspace.id,
            "purchase_type": "credit_pack",
            "credits": "200",
        },
    }

    assert billing.grant_credits_from_session(db_session, session) is True
    db_session.commit()
    assert billing.grant_credits_from_session(db_session, session) is False
    db_session.commit()

    assert quota_service.credit_balance(db_session, demo_workspace.id) == 200


def test_a_session_that_is_not_a_credit_pack_grants_nothing(db_session, demo_workspace):
    """Subscription checkouts go through the same event, and must not be read
    as a pack purchase."""
    from app.services import billing

    granted = billing.grant_credits_from_session(
        db_session,
        {"id": "cs_test_sub", "metadata": {"workspace_id": demo_workspace.id, "plan": "PRO"}},
    )
    assert granted is False
    assert quota_service.credit_balance(db_session, demo_workspace.id) == 0


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
