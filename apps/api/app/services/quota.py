"""
Plan limits, and the metering of lead reveals.

A lead's contact details are what the product actually sells, so unlocking one
is the unit the plan is counted in. Three decisions shape this:

  * Metering is per lead per week, not per click. Reopening the same lead
    within the week is free - otherwise the number would measure clicking,
    and re-checking a phone number would be charged twice.
  * The allowance is weekly and refills every Monday, and an unlock covers
    the week it was bought in. Someone working through more leads than their
    plan includes therefore has a reason to buy more or move up, rather than
    working indefinitely from one week's allowance. The cost of this is that a
    lead opened last week is charged again this week, which customers will
    notice; there is no export yet to soften it.
  * Purchased credits (see CreditPurchase) sit behind the weekly allowance
    and do not expire. The included leads are always spent first, so a bought
    credit is never burned while a free one is going unused.
  * Enforcement is server-side, and locked details are removed from the API
    response rather than hidden by the interface. A paywall that only blurs
    in CSS is not a paywall: the value is still in the payload.
"""

from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.misc import CreditPurchase, LeadReveal
from app.models.workspace import Workspace

# One source of truth for what a plan includes. The frontend reads these from
# /api/workspace/usage rather than keeping its own copy, so a plan change can
# never leave the two disagreeing about someone's limit.
PLAN_LEAD_LIMITS: dict[str, int] = {
    "FREE": 50,
    "STARTER": 500,
    "PRO": 2000,
    "AGENCY": 10000,
    "BUSINESS": 100000,
}

DEFAULT_PLAN = "FREE"


class QuotaExceeded(Exception):
    """Raised when a workspace has used this week's allowance."""

    def __init__(self, used: int, limit: int, plan: str):
        self.used = used
        self.limit = limit
        self.plan = plan
        super().__init__(f"{used}/{limit} leads unlocked on the {plan} plan")


def current_period() -> str:
    """The week quota is counted against, as an ISO year and week: 2026-W38.

    ISO weeks rather than "seven days from signup": everyone's allowance
    refills on the same Monday, so "your leads refill on Monday" is true for
    every customer and support never has to work out an individual's cycle.

    The stored value is what makes the reset happen - usage is counted for the
    current period only, so a new week simply finds no rows.
    """
    return datetime.now(timezone.utc).strftime("%G-W%V")


def next_reset_description() -> str:
    """Plain wording for when the allowance refills, for the interface."""
    now = datetime.now(timezone.utc)
    days_until_monday = (7 - now.weekday()) % 7 or 7
    if days_until_monday == 1:
        return "tomorrow"
    return f"in {days_until_monday} days"


def limit_for(plan: str | None) -> int:
    return PLAN_LEAD_LIMITS.get((plan or DEFAULT_PLAN).upper(), PLAN_LEAD_LIMITS[DEFAULT_PLAN])


def reveals_used(db: Session, workspace_id: str, period: str | None = None) -> int:
    return (
        db.query(LeadReveal)
        .filter(LeadReveal.workspace_id == workspace_id, LeadReveal.period == (period or current_period()))
        .count()
    )


def is_revealed(db: Session, workspace_id: str, lead_id: str, period: str | None = None) -> bool:
    """Is this lead unlocked for the current week?

    Scoped to the period: an unlock covers the week it was bought in, and a
    lead opened last week is locked again this week. That is what gives a
    heavy user a reason to buy more rather than working indefinitely from one
    week's allowance.

    Within a week it is still free to reopen the same lead, so the number
    counts leads rather than clicks.
    """
    return (
        db.query(LeadReveal)
        .filter(
            LeadReveal.workspace_id == workspace_id,
            LeadReveal.lead_id == lead_id,
            LeadReveal.period == (period or current_period()),
        )
        .first()
        is not None
    )


def revealed_lead_ids(db: Session, workspace_id: str) -> set[str]:
    """Leads unlocked for the current week, for serialising a list in one query."""
    rows = (
        db.query(LeadReveal.lead_id)
        .filter(
            LeadReveal.workspace_id == workspace_id,
            LeadReveal.period == current_period(),
        )
        .all()
    )
    return {row[0] for row in rows}


def credits_purchased(db: Session, workspace_id: str) -> int:
    """Total lead unlocks ever bought outright by this workspace."""
    return int(
        db.query(func.coalesce(func.sum(CreditPurchase.credits), 0))
        .filter(CreditPurchase.workspace_id == workspace_id)
        .scalar()
        or 0
    )


def credits_spent(db: Session, workspace_id: str) -> int:
    """Unlocks paid for from purchased credits, across all time.

    Counted from the unlocks themselves rather than a running total, so the
    balance is always derivable from what actually happened and cannot drift
    out of step with it.
    """
    return (
        db.query(LeadReveal)
        .filter(LeadReveal.workspace_id == workspace_id, LeadReveal.from_credit.is_(True))
        .count()
    )


def credit_balance(db: Session, workspace_id: str) -> int:
    """Purchased unlocks still available. These do not expire weekly."""
    return max(0, credits_purchased(db, workspace_id) - credits_spent(db, workspace_id))


def reveal_lead(db: Session, workspace: Workspace, lead_id: str, user_id: str | None) -> LeadReveal:
    """Unlock one lead, consuming quota unless it is already unlocked.

    Raises QuotaExceeded when this week's allowance is spent. The caller
    commits: this records the reveal in the same transaction as anything else
    the request is doing.
    """
    period = current_period()

    existing = (
        db.query(LeadReveal)
        .filter(
            LeadReveal.workspace_id == workspace.id,
            LeadReveal.lead_id == lead_id,
            LeadReveal.period == period,
        )
        .first()
    )
    if existing:
        return existing

    used = reveals_used(db, workspace.id, period)
    limit = limit_for(workspace.plan)

    # The plan's included leads are spent first, because they refill on Monday
    # and purchased credits do not. Spending bought credits while free ones
    # remain would quietly waste something the customer paid for.
    from_credit = used >= limit
    if from_credit and credit_balance(db, workspace.id) <= 0:
        raise QuotaExceeded(used=used, limit=limit, plan=workspace.plan or DEFAULT_PLAN)

    reveal = LeadReveal(
        workspace_id=workspace.id,
        lead_id=lead_id,
        user_id=user_id,
        period=period,
        from_credit=from_credit,
    )
    db.add(reveal)
    db.flush()
    return reveal


def quota_state(db: Session, workspace: Workspace) -> dict[str, int | str | bool]:
    """Everything the interface needs to explain the limit before it is hit."""
    used = reveals_used(db, workspace.id)
    limit = limit_for(workspace.plan)
    credits = credit_balance(db, workspace.id)
    included_left = max(0, limit - used)
    return {
        "plan": workspace.plan or DEFAULT_PLAN,
        "used": used,
        "limit": limit,
        # What is left in total, so the interface can say how many unlocks
        # remain without the customer working out which bucket they come from.
        "remaining": included_left + credits,
        "included_remaining": included_left,
        "credit_balance": credits,
        # Only truly exhausted when the bought credits are gone too.
        "exhausted": included_left == 0 and credits == 0,
        "period": current_period(),
    }
