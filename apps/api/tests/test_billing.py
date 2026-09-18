"""
Subscription billing.

The webhook is where a workspace's plan is raised, which makes it the place an
attacker would go to award themselves an AGENCY plan. Most of what follows
tests that it refuses them.
"""

import json
import time
from unittest.mock import MagicMock, patch

import pytest
import stripe

from app.core.config import Settings
from app.models.misc import Subscription
from app.models.workspace import Workspace
from app.services import billing

WEBHOOK_SECRET = "whsec_test_secret_value"


def settings_with_stripe(**overrides) -> Settings:
    return Settings(
        _env_file=None,
        stripe_secret_key="rk_test_example",
        stripe_webhook_secret=WEBHOOK_SECRET,
        stripe_price_starter="price_starter",
        stripe_price_pro="price_pro",
        stripe_price_agency="price_agency",
        **overrides,
    )


def signed(payload: dict, secret: str = WEBHOOK_SECRET) -> tuple[bytes, str]:
    """Sign a payload the way Stripe does, so the endpoint sees a real signature."""
    body = json.dumps(payload).encode()
    timestamp = int(time.time())
    signature = stripe.WebhookSignature._compute_signature(f"{timestamp}.{body.decode()}", secret)
    return body, f"t={timestamp},v1={signature}"


def subscription_event(workspace_id: str, status: str = "active", price: str = "price_pro") -> dict:
    return {
        "id": "evt_test",
        "type": "customer.subscription.updated",
        "data": {
            "object": {
                "id": "sub_test123",
                "status": status,
                "customer": "cus_test123",
                "current_period_end": 1800000000,
                "metadata": {"workspace_id": workspace_id},
                "items": {"data": [{"price": {"id": price}}]},
            }
        },
    }


# --------------------------------------------------------- the signature


def test_an_unsigned_webhook_is_refused(client, demo_workspace, app_with_stripe):
    """This endpoint cannot require a login - Stripe has no account here - so
    the signature is the only thing standing between it and anyone who knows
    the URL and would like a free plan."""
    body, _ = signed(subscription_event(demo_workspace.id))
    response = client.post("/api/billing/webhook", content=body)
    assert response.status_code == 400


def test_a_forged_signature_is_refused(client, demo_workspace, app_with_stripe):
    body, _ = signed(subscription_event(demo_workspace.id), secret="whsec_wrong_secret")
    response = client.post(
        "/api/billing/webhook", content=body, headers={"stripe-signature": "t=1,v1=deadbeef"}
    )
    assert response.status_code == 400


def test_a_forged_upgrade_does_not_change_the_plan(client, demo_workspace, db_session, app_with_stripe):
    """The attack this all exists to stop."""
    body, _ = signed(subscription_event(demo_workspace.id, price="price_agency"), secret="whsec_attacker")
    client.post("/api/billing/webhook", content=body, headers={"stripe-signature": "t=1,v1=nope"})

    db_session.refresh(demo_workspace)
    assert demo_workspace.plan == "FREE"


def test_webhooks_are_refused_when_no_signing_secret_is_configured(client, demo_workspace, app_no_stripe):
    """Accepting unverified webhooks because the secret is missing would be
    worse than refusing them."""
    body, signature = signed(subscription_event(demo_workspace.id))
    response = client.post("/api/billing/webhook", content=body, headers={"stripe-signature": signature})
    assert response.status_code == 503


# ------------------------------------------------------------ the upgrade


def test_a_signed_subscription_raises_the_plan(client, demo_workspace, db_session, app_with_stripe):
    body, signature = signed(subscription_event(demo_workspace.id, price="price_pro"))
    response = client.post("/api/billing/webhook", content=body, headers={"stripe-signature": signature})

    assert response.status_code == 200
    db_session.refresh(demo_workspace)
    assert demo_workspace.plan == "PRO"


def test_the_allowance_follows_the_plan(client, demo_workspace, db_session, app_with_stripe):
    """Buying a plan has to actually buy something: the metered limit moves."""
    from app.services.quota import limit_for

    assert limit_for(demo_workspace.plan) == 50

    body, signature = signed(subscription_event(demo_workspace.id, price="price_agency"))
    client.post("/api/billing/webhook", content=body, headers={"stripe-signature": signature})

    db_session.refresh(demo_workspace)
    assert limit_for(demo_workspace.plan) == 10000


def test_a_cancelled_subscription_drops_to_free(client, demo_workspace, db_session, app_with_stripe):
    body, signature = signed(subscription_event(demo_workspace.id, price="price_pro"))
    client.post("/api/billing/webhook", content=body, headers={"stripe-signature": signature})

    cancelled = subscription_event(demo_workspace.id, status="canceled", price="price_pro")
    body, signature = signed(cancelled)
    client.post("/api/billing/webhook", content=body, headers={"stripe-signature": signature})

    db_session.refresh(demo_workspace)
    assert demo_workspace.plan == "FREE"


def test_a_past_due_subscription_loses_access(client, demo_workspace, db_session, app_with_stripe):
    body, signature = signed(subscription_event(demo_workspace.id, status="past_due"))
    client.post("/api/billing/webhook", content=body, headers={"stripe-signature": signature})

    db_session.refresh(demo_workspace)
    assert demo_workspace.plan == "FREE"


def test_a_trialing_subscription_keeps_access(client, demo_workspace, db_session, app_with_stripe):
    """A trial is a subscription someone is entitled to use."""
    body, signature = signed(subscription_event(demo_workspace.id, status="trialing", price="price_pro"))
    client.post("/api/billing/webhook", content=body, headers={"stripe-signature": signature})

    db_session.refresh(demo_workspace)
    assert demo_workspace.plan == "PRO"


def test_an_unpaid_checkout_grants_nothing(client, demo_workspace, db_session, app_with_stripe):
    """A session can complete while payment is still processing."""
    event = {
        "id": "evt_checkout",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": "cs_test",
                "payment_status": "unpaid",
                "subscription": "sub_test123",
                "metadata": {"workspace_id": demo_workspace.id, "plan": "PRO"},
            }
        },
    }
    body, signature = signed(event)
    client.post("/api/billing/webhook", content=body, headers={"stripe-signature": signature})

    db_session.refresh(demo_workspace)
    assert demo_workspace.plan == "FREE"


def test_an_event_for_an_unknown_workspace_is_ignored_quietly(client, app_with_stripe):
    """Erroring would make Stripe retry an event that can never succeed."""
    body, signature = signed(subscription_event("no-such-workspace"))
    response = client.post("/api/billing/webhook", content=body, headers={"stripe-signature": signature})
    assert response.status_code == 200


def test_an_unrelated_event_is_acknowledged(client, app_with_stripe):
    event = {"id": "evt_x", "type": "customer.created", "data": {"object": {"id": "cus_x"}}}
    body, signature = signed(event)
    response = client.post("/api/billing/webhook", content=body, headers={"stripe-signature": signature})
    assert response.status_code == 200
    assert response.json()["handled"] is False


# ----------------------------------------------------------- configuration


def test_checkout_reports_when_billing_is_not_configured(client, auth_headers, app_no_stripe):
    """A checkout button that silently does nothing reads as a broken product."""
    response = client.post("/api/billing/checkout", json={"plan": "PRO"}, headers=auth_headers)
    assert response.status_code == 503
    assert "STRIPE_SECRET_KEY" in response.json()["detail"]


def test_plans_report_whether_they_can_be_bought(client, auth_headers, app_no_stripe):
    body = client.get("/api/billing/plans", headers=auth_headers).json()
    assert body["billing_configured"] is False
    assert all(plan["purchasable"] is False for plan in body["plans"])


def test_plans_are_purchasable_once_prices_exist(client, auth_headers, app_with_stripe):
    body = client.get("/api/billing/plans", headers=auth_headers).json()
    purchasable = {plan["plan"] for plan in body["plans"] if plan["purchasable"]}
    assert purchasable == {"STARTER", "PRO", "AGENCY"}, "FREE is never sold"


def test_checkout_requires_authentication(client, app_with_stripe):
    assert client.post("/api/billing/checkout", json={"plan": "PRO"}).status_code == 401


def test_prices_map_to_plans_both_ways():
    settings = settings_with_stripe()
    assert billing.price_for_plan(settings, "PRO") == "price_pro"
    assert billing.plan_for_price(settings, "price_pro") == "PRO"
    assert billing.plan_for_price(settings, "price_unknown") is None
