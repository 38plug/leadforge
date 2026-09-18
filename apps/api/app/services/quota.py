"""
Plan limits, and the metering of lead reveals.

A lead's contact details are what the product actually sells, so unlocking one
is the unit the plan is counted in. Three decisions shape this:

  * Metering is per lead, not per click. Opening the same lead again is free -
    otherwise the number would measure clicking, and a user re-checking a
    phone number they already paid for would be charged twice.
  * The allowance is monthly and resets on the first of the month. Nothing is
    deducted permanently, so hitting the limit is a wait, not a loss.
  * Enforcement is server-side, and locked details are removed from the API
    response rather than hidden by the interface. A paywall that only blurs
    in CSS is not a paywall: the value is still in the payload.
"""

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.misc import LeadReveal
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
    """Raised when a workspace has used its monthly allowance."""

    def __init__(self, used: int, limit: int, plan: str):
        self.used = used
        self.limit = limit
        self.plan = plan
        super().__init__(f"{used}/{limit} leads unlocked on the {plan} plan")


def current_period() -> str:
    """The month quota is counted against, as YYYY-MM."""
    return datetime.now(timezone.utc).strftime("%Y-%m")


def limit_for(plan: str | None) -> int:
    return PLAN_LEAD_LIMITS.get((plan or DEFAULT_PLAN).upper(), PLAN_LEAD_LIMITS[DEFAULT_PLAN])


def reveals_used(db: Session, workspace_id: str, period: str | None = None) -> int:
    return (
        db.query(LeadReveal)
        .filter(LeadReveal.workspace_id == workspace_id, LeadReveal.period == (period or current_period()))
        .count()
    )


def is_revealed(db: Session, workspace_id: str, lead_id: str) -> bool:
    """Has this lead ever been unlocked by this workspace?

    Deliberately not scoped to the period: a lead unlocked in March stays
    unlocked in April. Re-charging for details someone already has would make
    saved leads decay, which is not what a lead list is for.
    """
    return (
        db.query(LeadReveal)
        .filter(LeadReveal.workspace_id == workspace_id, LeadReveal.lead_id == lead_id)
        .first()
        is not None
    )


def revealed_lead_ids(db: Session, workspace_id: str) -> set[str]:
    """Every lead this workspace has unlocked, for serialising a list in one query."""
    rows = db.query(LeadReveal.lead_id).filter(LeadReveal.workspace_id == workspace_id).all()
    return {row[0] for row in rows}


def reveal_lead(db: Session, workspace: Workspace, lead_id: str, user_id: str | None) -> LeadReveal:
    """Unlock one lead, consuming quota unless it is already unlocked.

    Raises QuotaExceeded when the monthly allowance is spent. The caller
    commits: this records the reveal in the same transaction as anything else
    the request is doing.
    """
    existing = (
        db.query(LeadReveal)
        .filter(LeadReveal.workspace_id == workspace.id, LeadReveal.lead_id == lead_id)
        .first()
    )
    if existing:
        return existing

    period = current_period()
    used = reveals_used(db, workspace.id, period)
    limit = limit_for(workspace.plan)
    if used >= limit:
        raise QuotaExceeded(used=used, limit=limit, plan=workspace.plan or DEFAULT_PLAN)

    reveal = LeadReveal(
        workspace_id=workspace.id,
        lead_id=lead_id,
        user_id=user_id,
        period=period,
    )
    db.add(reveal)
    db.flush()
    return reveal


def quota_state(db: Session, workspace: Workspace) -> dict[str, int | str | bool]:
    """Everything the interface needs to explain the limit before it is hit."""
    used = reveals_used(db, workspace.id)
    limit = limit_for(workspace.plan)
    return {
        "plan": workspace.plan or DEFAULT_PLAN,
        "used": used,
        "limit": limit,
        "remaining": max(0, limit - used),
        "exhausted": used >= limit,
        "period": current_period(),
    }
