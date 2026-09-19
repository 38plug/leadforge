"""
Subscription billing through Stripe Checkout.

Two principles run through this module.

**Stripe is the source of truth for what was paid; this database is the source
of truth for what a workspace may do.** The two are reconciled in one place -
`apply_subscription_state` - which every webhook and every manual sync goes
through. Granting access anywhere else is how an account ends up on a plan
nobody paid for.

**Access is granted by webhook, never by the browser returning from Checkout.**
A success page is a redirect the user controls; it can be opened directly,
replayed, or never reached at all when someone closes the tab after paying.
The webhook is the only report of payment that Stripe actually signs.
"""

import logging
import secrets
import string

import stripe
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models.misc import CreditPurchase, Subscription
from app.models.workspace import Workspace
from app.services.quota import PLAN_LEAD_LIMITS

logger = logging.getLogger("leadforge.billing")

# Pinned deliberately. Stripe's API evolves, and an unpinned integration can
# start receiving differently-shaped objects after an upgrade on their side.
STRIPE_API_VERSION = "2026-08-26.dahlia"

# The plan a workspace falls back to when a subscription ends or fails.
FREE_PLAN = "FREE"


class BillingNotConfigured(RuntimeError):
    """Raised when billing is used before Stripe credentials are set.

    Failing loudly beats a checkout button that silently does nothing, which
    reads to a customer as a broken product rather than an unfinished one.
    """


def is_configured(settings: Settings) -> bool:
    return bool(settings.stripe_secret_key)


def client(settings: Settings) -> stripe.StripeClient:
    """A configured client instance.

    An instance rather than the module-level `stripe.api_key`, which is
    deprecated across Stripe's SDKs and makes the key process-global.
    """
    if not settings.stripe_secret_key:
        raise BillingNotConfigured(
            "STRIPE_SECRET_KEY is not set, so payments cannot be taken. Add a "
            "restricted key with Billing and Checkout permissions."
        )
    return stripe.StripeClient(settings.stripe_secret_key, stripe_version=STRIPE_API_VERSION)


def price_for_plan(settings: Settings, plan: str) -> str | None:
    """The Stripe Price backing a plan, or None if that plan is not sold."""
    return {
        "STARTER": settings.stripe_price_starter,
        "PRO": settings.stripe_price_pro,
        "AGENCY": settings.stripe_price_agency,
    }.get(plan.upper())


def plan_for_price(settings: Settings, price_id: str | None) -> str | None:
    """Reverse lookup, used when a webhook reports which price is now active."""
    if not price_id:
        return None
    for plan in ("STARTER", "PRO", "AGENCY"):
        if price_for_plan(settings, plan) == price_id:
            return plan
    return None


def purchasable_plans(settings: Settings) -> list[dict[str, object]]:
    """Plans the interface may offer, with whether each can actually be bought.

    A plan with no configured price is listed as unavailable rather than
    hidden: the customer should see what exists, and the operator should see
    that something is unconfigured.
    """
    plans = []
    for plan in ("FREE", "STARTER", "PRO", "AGENCY"):
        price_id = price_for_plan(settings, plan)
        plans.append(
            {
                "plan": plan,
                "lead_limit": PLAN_LEAD_LIMITS.get(plan, 0),
                "purchasable": plan != FREE_PLAN and bool(price_id),
            }
        )
    return plans


def _integration_tag() -> str:
    """Labels Checkout Sessions so flows can be compared in the Dashboard."""
    suffix = "".join(secrets.choice(string.ascii_lowercase) for _ in range(8))
    return f"leadforge-subscription-{suffix}"


def ensure_customer(
    db: Session, settings: Settings, workspace: Workspace, email: str | None
) -> str:
    """Return the workspace's Stripe customer, creating it once if needed.

    Stored against the workspace rather than the user: the subscription belongs
    to the team, and a workspace outlives the person who happened to pay.
    """
    subscription = _subscription_row(db, workspace)
    if subscription.external_customer_id:
        return subscription.external_customer_id

    customer = client(settings).v1.customers.create(
        params={
            "email": email,
            "name": workspace.name,
            # Lets a Stripe-side record be traced back without a lookup table.
            "metadata": {"workspace_id": workspace.id, "workspace_name": workspace.name},
        }
    )
    subscription.external_customer_id = customer.id
    subscription.provider = "stripe"
    db.flush()
    return customer.id


def create_checkout_session(
    db: Session,
    settings: Settings,
    workspace: Workspace,
    plan: str,
    email: str | None,
    success_url: str,
    cancel_url: str,
) -> str:
    """Start a subscription purchase and return the URL to send the user to."""
    # Checked first so the error names the root cause: with nothing
    # configured at all, "no price for PRO" sends someone hunting for a price
    # when the key is what is missing.
    if not is_configured(settings):
        raise BillingNotConfigured(
            "STRIPE_SECRET_KEY is not set, so payments cannot be taken. Add a "
            "restricted key with Billing and Checkout permissions."
        )

    price_id = price_for_plan(settings, plan)
    if not price_id:
        raise BillingNotConfigured(
            f"No Stripe price is configured for the {plan} plan. Set "
            f"STRIPE_PRICE_{plan.upper()} to a recurring price ID."
        )

    customer_id = ensure_customer(db, settings, workspace, email)

    session = client(settings).v1.checkout.sessions.create(
        params={
            "mode": "subscription",
            "customer": customer_id,
            "line_items": [{"price": price_id, "quantity": 1}],
            "success_url": success_url,
            "cancel_url": cancel_url,
            # Carried through to the webhook, which is where access is granted:
            # the handler must not have to guess which workspace paid.
            "metadata": {"workspace_id": workspace.id, "plan": plan},
            "subscription_data": {"metadata": {"workspace_id": workspace.id, "plan": plan}},
            # Lets a customer enter a coupon at checkout rather than needing
            # support to apply one.
            "allow_promotion_codes": True,
            "integration_identifier": _integration_tag(),
            # payment_method_types is deliberately omitted so Stripe shows the
            # methods each customer is eligible for, configured in the
            # Dashboard rather than hard-coded here.
        }
    )
    return session.url


# Prices change rarely and a Stripe round trip on every settings page load is
# wasteful, so a fetched amount is remembered for the process's lifetime. The
# cost of the cache is that a price edited in the Dashboard shows the old
# amount until the service restarts; the alternative is a network call in the
# path of every page load.
_price_amount_cache: dict[str, tuple[int, str] | None] = {}


def _price_amount(settings: Settings, price_id: str) -> tuple[int, str] | None:
    """The amount and currency of a Stripe price, or None if it cannot be read."""
    if price_id in _price_amount_cache:
        return _price_amount_cache[price_id]

    try:
        price = client(settings).v1.prices.retrieve(price_id)
        amount = price.unit_amount
        result = (int(amount), str(price.currency)) if amount is not None else None
    except (stripe.StripeError, BillingNotConfigured) as exc:
        # Not fatal: the pack is still purchasable, the page just cannot print
        # the figure. Caching the failure would hide a recovered Stripe, so
        # this is left uncached and retried on the next request.
        logger.warning("Could not read price %s from Stripe: %s", price_id, exc)
        return None

    _price_amount_cache[price_id] = result
    return result


def credit_pack_offer(settings: Settings) -> dict[str, object]:
    """The one-off pack, and whether it can actually be bought right now.

    Returned even when unpurchasable so the interface can show what exists and
    the operator can see that a price is missing, rather than the pack quietly
    vanishing from the page with no explanation anywhere.

    The amount is read from Stripe, which is where it is actually set, and is
    null when it cannot be read. The interface must then say nothing about the
    price rather than print a figure this application guessed at.
    """
    price_id = settings.stripe_price_credit_pack
    amount = _price_amount(settings, price_id) if price_id and is_configured(settings) else None
    return {
        "credits": settings.credit_pack_size,
        "purchasable": is_configured(settings) and bool(price_id),
        "amount_cents": amount[0] if amount else None,
        "currency": amount[1] if amount else None,
    }


def create_credit_checkout_session(
    db: Session,
    settings: Settings,
    workspace: Workspace,
    user_id: str | None,
    email: str | None,
    success_url: str,
    cancel_url: str,
) -> str:
    """Start a one-off purchase of extra lead unlocks.

    mode="payment", not "subscription": this is a pack someone buys once, and
    billing it monthly would be charging for something they did not agree to.
    It is available on every plan, including FREE - a free user who needs
    thirty more leads this week should be able to pay a few dollars instead of
    committing to a monthly bill they do not want.
    """
    if not is_configured(settings):
        raise BillingNotConfigured(
            "STRIPE_SECRET_KEY is not set, so payments cannot be taken. Add a "
            "restricted key with Billing and Checkout permissions."
        )

    price_id = settings.stripe_price_credit_pack
    if not price_id:
        raise BillingNotConfigured(
            "No Stripe price is configured for the lead pack. Set "
            "STRIPE_PRICE_CREDIT_PACK to a one-time price ID."
        )

    customer_id = ensure_customer(db, settings, workspace, email)

    session = client(settings).v1.checkout.sessions.create(
        params={
            "mode": "payment",
            "customer": customer_id,
            "line_items": [{"price": price_id, "quantity": 1}],
            "success_url": success_url,
            "cancel_url": cancel_url,
            # The webhook grants the credits, so it must be able to tell which
            # workspace paid and how many unlocks this application decided the
            # pack is worth. Reading the size from here rather than from the
            # Stripe line item keeps the granted amount under our control.
            "metadata": {
                "workspace_id": workspace.id,
                "purchase_type": "credit_pack",
                "credits": str(settings.credit_pack_size),
                "user_id": user_id or "",
            },
            "allow_promotion_codes": True,
            "integration_identifier": _integration_tag().replace("subscription", "credits"),
        }
    )
    return session.url


def grant_credits_from_session(db: Session, session: dict) -> bool:
    """Record a paid credit pack, once.

    Returns True when credits were granted, False when this session was
    already recorded or carries nothing to grant. The uniqueness of the
    session id is what makes a redelivered webhook harmless: Stripe retries on
    any non-2xx response, so "handled twice" is a normal event rather than an
    edge case.
    """
    metadata = session.get("metadata") or {}
    if metadata.get("purchase_type") != "credit_pack":
        return False

    workspace_id = metadata.get("workspace_id")
    session_id = session.get("id")
    try:
        credits = int(metadata.get("credits") or 0)
    except (TypeError, ValueError):
        credits = 0

    if not workspace_id or not session_id or credits <= 0:
        logger.warning("Credit pack session %s is missing what it needs to grant", session_id)
        return False

    already = (
        db.query(CreditPurchase).filter(CreditPurchase.stripe_session_id == session_id).first()
    )
    if already:
        logger.info("Credit pack session %s was already granted; ignoring", session_id)
        return False

    db.add(
        CreditPurchase(
            workspace_id=workspace_id,
            credits=credits,
            amount_cents=int(session.get("amount_total") or 0),
            currency=str(session.get("currency") or "usd"),
            stripe_session_id=session_id,
            purchased_by_user_id=metadata.get("user_id") or None,
        )
    )
    db.flush()
    logger.info("Granted %s lead credits to workspace %s", credits, workspace_id)
    return True


def create_portal_session(db: Session, settings: Settings, workspace: Workspace, return_url: str) -> str:
    """Open Stripe's customer portal for plan changes, cancellation and invoices.

    Using the portal rather than building those flows means card updates, tax
    IDs, proration and invoice history are handled by Stripe, and PCI scope
    stays out of this codebase.
    """
    subscription = _subscription_row(db, workspace)
    if not subscription.external_customer_id:
        raise BillingNotConfigured("This workspace has no billing account yet.")

    session = client(settings).v1.billing_portal.sessions.create(
        params={"customer": subscription.external_customer_id, "return_url": return_url}
    )
    return session.url


def apply_subscription_state(
    db: Session,
    settings: Settings,
    workspace_id: str,
    *,
    status: str,
    plan: str | None,
    stripe_subscription_id: str | None = None,
    stripe_customer_id: str | None = None,
    current_period_end: str | None = None,
) -> None:
    """Reconcile one workspace's access with what Stripe reports.

    Every path that changes a paid plan goes through here, so there is one
    place where "what Stripe says" becomes "what this workspace may do".

    A subscription that is not active drops the workspace to FREE rather than
    deleting anything. Their leads stay, any credits they bought outright
    stay, and only the weekly allowance shrinks.
    """
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        logger.warning("Billing event for unknown workspace %s; ignoring", workspace_id)
        return

    subscription = _subscription_row(db, workspace)
    subscription.status = status
    subscription.provider = "stripe"
    if stripe_subscription_id:
        subscription.external_subscription_id = stripe_subscription_id
    if stripe_customer_id:
        subscription.external_customer_id = stripe_customer_id
    if current_period_end:
        subscription.current_period_end = current_period_end

    # "active" and "trialing" both mean the customer may use what they bought;
    # everything else - past_due, canceled, unpaid, incomplete - does not.
    entitled = status in {"active", "trialing"}
    new_plan = (plan or workspace.plan) if entitled else FREE_PLAN

    if new_plan != workspace.plan:
        logger.info(
            "Workspace %s moving from %s to %s (subscription %s)",
            workspace_id,
            workspace.plan,
            new_plan,
            status,
        )
    workspace.plan = new_plan
    subscription.plan = new_plan
    db.flush()


def _subscription_row(db: Session, workspace: Workspace) -> Subscription:
    """The workspace's subscription record, created on first use."""
    subscription = (
        db.query(Subscription).filter(Subscription.workspace_id == workspace.id).first()
    )
    if not subscription:
        subscription = Subscription(workspace_id=workspace.id, plan=workspace.plan, status="INACTIVE")
        db.add(subscription)
        db.flush()
    return subscription
