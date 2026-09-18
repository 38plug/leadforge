"""
Billing endpoints: buy a plan, manage it, and receive Stripe's reports.

The webhook is the important one. It is the only place a workspace's plan is
raised, because it is the only report of payment that Stripe signs. The
browser returning to a success page proves nothing - that URL can be opened
directly, and a customer who closes the tab after paying never reaches it.
"""

import json
import logging

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.deps import get_current_user, get_current_workspace
from app.db.session import get_db
from app.models.misc import Subscription
from app.models.workspace import User, Workspace
from app.services import billing

logger = logging.getLogger("leadforge.billing")

router = APIRouter(prefix="/api/billing", tags=["billing"])


@router.get("/plans")
def list_plans(
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    workspace: Workspace = Depends(get_current_workspace),
):
    """What this workspace is on, and what it could move to."""
    subscription = db.query(Subscription).filter(Subscription.workspace_id == workspace.id).first()
    return {
        "current_plan": workspace.plan,
        "billing_configured": billing.is_configured(settings),
        "subscription_status": subscription.status if subscription else None,
        "current_period_end": subscription.current_period_end if subscription else None,
        "has_billing_account": bool(subscription and subscription.external_customer_id),
        "plans": billing.purchasable_plans(settings),
    }


@router.post("/checkout")
def start_checkout(
    payload: dict,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    workspace: Workspace = Depends(get_current_workspace),
    user: User = Depends(get_current_user),
):
    """Create a Checkout Session and return where to send the customer."""
    plan = str(payload.get("plan", "")).upper()
    if not plan:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A plan is required")

    app_url = (settings.cors_origins or ["http://localhost:3000"])[0].rstrip("/")
    try:
        url = billing.create_checkout_session(
            db,
            settings,
            workspace,
            plan,
            email=user.email,
            success_url=f"{app_url}/settings?tab=billing&checkout=success",
            cancel_url=f"{app_url}/settings?tab=billing&checkout=cancelled",
        )
    except billing.BillingNotConfigured as exc:
        # 503 rather than 400: the request was fine, the service is not ready.
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    except stripe.StripeError as exc:
        logger.warning("Stripe refused a checkout session: %s", exc)
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            "Stripe could not start this checkout. Please try again.",
        ) from exc

    db.commit()
    return {"url": url}


@router.post("/portal")
def open_portal(
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    workspace: Workspace = Depends(get_current_workspace),
):
    """Send the customer to Stripe's portal to change or cancel their plan."""
    app_url = (settings.cors_origins or ["http://localhost:3000"])[0].rstrip("/")
    try:
        url = billing.create_portal_session(db, settings, workspace, f"{app_url}/settings?tab=billing")
    except billing.BillingNotConfigured as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    except stripe.StripeError as exc:
        logger.warning("Stripe refused a portal session: %s", exc)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Stripe could not open the billing portal.") from exc

    db.commit()
    return {"url": url}


# Events that change whether a workspace may use what it paid for. Anything
# else Stripe sends is acknowledged and ignored: returning an error for an
# event we simply do not act on would make Stripe retry it indefinitely.
HANDLED_EVENTS = {
    "checkout.session.completed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "invoice.payment_failed",
}


@router.post("/webhook", include_in_schema=False)
async def stripe_webhook(
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    """Receive Stripe's signed reports and reconcile access.

    The signature check is not optional. This endpoint is unauthenticated by
    necessity - Stripe cannot log in - so the signature is the only thing
    distinguishing Stripe from anyone who knows the URL and would like a free
    AGENCY plan.
    """
    if not settings.stripe_webhook_secret:
        logger.error("Stripe webhook received but STRIPE_WEBHOOK_SECRET is not set; rejecting")
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Billing webhooks are not configured on this installation.",
        )

    payload = await request.body()
    signature = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(payload, signature, settings.stripe_webhook_secret)
    except (ValueError, stripe.SignatureVerificationError) as exc:
        logger.warning("Rejected an unverifiable Stripe webhook: %s", exc)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid signature") from exc

    event_type = event["type"]
    if event_type not in HANDLED_EVENTS:
        return {"received": True, "handled": False}

    # The signature is verified above, so the raw body can be trusted and
    # parsed as plain JSON. construct_event returns StripeObjects, which look
    # like dicts but do not implement .get(); working with real dicts keeps
    # every handler below free of defensive attribute checks.
    obj = json.loads(payload)["data"]["object"]
    workspace_id = (obj.get("metadata") or {}).get("workspace_id")

    if event_type == "checkout.session.completed":
        # Only a paid session grants anything. A session can complete while
        # payment is still processing, and treating that as paid hands out
        # access that may never be funded.
        if obj.get("payment_status") != "paid":
            return {"received": True, "handled": False}
        _sync_from_stripe(db, settings, obj.get("subscription"), workspace_id)

    elif event_type in {"customer.subscription.created", "customer.subscription.updated"}:
        billing.apply_subscription_state(
            db,
            settings,
            workspace_id or "",
            status=obj.get("status", "incomplete"),
            plan=billing.plan_for_price(settings, _first_price_id(obj)),
            stripe_subscription_id=obj.get("id"),
            stripe_customer_id=obj.get("customer"),
            current_period_end=str(obj.get("current_period_end") or ""),
        )

    elif event_type == "customer.subscription.deleted":
        billing.apply_subscription_state(
            db, settings, workspace_id or "", status="canceled", plan=None,
            stripe_subscription_id=obj.get("id"),
        )

    elif event_type == "invoice.payment_failed":
        # Not a downgrade on its own: Stripe retries, and dropping someone to
        # FREE on a first failed charge would punish an expired card. The
        # subscription's own status change is what eventually moves them.
        logger.info("Payment failed for workspace %s; awaiting Stripe's retries", workspace_id)

    db.commit()
    return {"received": True, "handled": True}


def _sync_from_stripe(db: Session, settings: Settings, subscription_id: str | None, workspace_id: str | None) -> None:
    """Read the subscription back from Stripe rather than trusting the event body.

    The checkout event carries only an id, and re-reading means the plan and
    status applied are the ones Stripe holds right now.
    """
    if not subscription_id or not workspace_id:
        return
    subscription = client_subscription(settings, subscription_id)
    if not subscription:
        return
    if not isinstance(subscription, dict):
        subscription = dict(subscription)
    billing.apply_subscription_state(
        db,
        settings,
        workspace_id,
        status=subscription.get("status", "incomplete"),
        plan=billing.plan_for_price(settings, _first_price_id(subscription)),
        stripe_subscription_id=subscription.get("id"),
        stripe_customer_id=subscription.get("customer"),
        current_period_end=str(subscription.get("current_period_end") or ""),
    )


def client_subscription(settings: Settings, subscription_id: str):
    try:
        return billing.client(settings).v1.subscriptions.retrieve(subscription_id)
    except stripe.StripeError as exc:
        logger.warning("Could not read subscription %s from Stripe: %s", subscription_id, exc)
        return None


def _first_price_id(subscription: object) -> str | None:
    """The price on a subscription's first line, which is the plan it is on."""
    try:
        items = subscription.get("items", {}).get("data", [])  # type: ignore[union-attr]
        return items[0]["price"]["id"] if items else None
    except (AttributeError, KeyError, IndexError, TypeError):
        return None
