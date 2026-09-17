from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import get_current_workspace
from app.db.session import get_db
from app.models.campaign import Campaign, CampaignRecipient
from app.models.company import Company
from app.models.lead import Lead, LeadStatus
from app.models.workspace import Workspace

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("")
def get_analytics(db: Session = Depends(get_db), workspace: Workspace = Depends(get_current_workspace)):
    base = db.query(Lead).filter(Lead.workspace_id == workspace.id)
    total = base.count()
    won = base.filter(Lead.status == LeadStatus.WON).count()
    lost = base.filter(Lead.status == LeadStatus.LOST).count()
    contacted = base.filter(Lead.status.notin_([LeadStatus.NEW])).count()

    pipeline_value = (
        db.query(func.coalesce(func.sum(Lead.estimated_value), 0))
        .filter(Lead.workspace_id == workspace.id, Lead.status.notin_([LeadStatus.WON, LeadStatus.LOST]))
        .scalar()
    )
    revenue = (
        db.query(func.coalesce(func.sum(Lead.estimated_value), 0))
        .filter(Lead.workspace_id == workspace.id, Lead.status == LeadStatus.WON)
        .scalar()
    )

    by_niche = (
        db.query(Company.niche, func.count(Lead.id))
        .join(Lead, Lead.company_id == Company.id)
        .filter(Lead.workspace_id == workspace.id)
        .group_by(Company.niche)
        .order_by(func.count(Lead.id).desc())
        .all()
    )
    by_country = (
        db.query(Company.country, func.count(Lead.id))
        .join(Lead, Lead.company_id == Company.id)
        .filter(Lead.workspace_id == workspace.id)
        .group_by(Company.country)
        .order_by(func.count(Lead.id).desc())
        .all()
    )

    conversion_rate = round((won / total) * 100, 2) if total else 0.0

    return {
        "leads_found": total,
        "leads_won": won,
        "leads_lost": lost,
        "leads_contacted": contacted,
        "conversion_rate": conversion_rate,
        "pipeline_value": float(pipeline_value or 0),
        "revenue": float(revenue or 0),
        "leads_by_niche": [{"name": n, "value": c} for n, c in by_niche],
        "leads_by_country": [{"name": n, "value": c} for n, c in by_country],
    }


def _parse_day(value: str | None) -> date | None:
    """Timestamps on campaign recipients are stored as ISO strings."""
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
    except ValueError:
        return None


@router.get("/timeseries")
def get_timeseries(
    days: int = Query(7, ge=1, le=90),
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_current_workspace),
):
    """Daily activity for the last `days` days.

    Every bucket is counted from real rows, so a new workspace legitimately
    reads zero across the board until it starts finding leads and sending mail.
    """
    today = datetime.now(timezone.utc).date()
    window = [today - timedelta(days=offset) for offset in range(days - 1, -1, -1)]
    start = datetime.combine(window[0], datetime.min.time(), tzinfo=timezone.utc)

    leads_added: dict[date, int] = {day: 0 for day in window}
    leads_won: dict[date, int] = {day: 0 for day in window}
    for created_at, status in (
        db.query(Lead.created_at, Lead.status)
        .filter(Lead.workspace_id == workspace.id, Lead.created_at >= start)
        .all()
    ):
        # SQLite hands back naive datetimes; treat those as UTC.
        stamp = created_at if created_at.tzinfo else created_at.replace(tzinfo=timezone.utc)
        day = stamp.astimezone(timezone.utc).date()
        if day not in leads_added:
            continue
        leads_added[day] += 1
        if status == LeadStatus.WON:
            leads_won[day] += 1

    sent: dict[date, int] = {day: 0 for day in window}
    replied: dict[date, int] = {day: 0 for day in window}
    for sent_at, replied_at in (
        db.query(CampaignRecipient.sent_at, CampaignRecipient.replied_at)
        .join(Campaign, Campaign.id == CampaignRecipient.campaign_id)
        .filter(Campaign.workspace_id == workspace.id)
        .all()
    ):
        sent_day = _parse_day(sent_at)
        if sent_day in sent:
            sent[sent_day] += 1
        replied_day = _parse_day(replied_at)
        if replied_day in replied:
            replied[replied_day] += 1

    stages = [
        ("Leads Found", [s for s in LeadStatus]),
        ("Contacted", [
            LeadStatus.CONTACTED, LeadStatus.REPLIED, LeadStatus.INTERESTED,
            LeadStatus.MEETING, LeadStatus.PROPOSAL, LeadStatus.WON,
        ]),
        ("Interested", [LeadStatus.INTERESTED, LeadStatus.MEETING, LeadStatus.PROPOSAL, LeadStatus.WON]),
        ("Meeting", [LeadStatus.MEETING, LeadStatus.PROPOSAL, LeadStatus.WON]),
        ("Won", [LeadStatus.WON]),
    ]
    funnel = [
        {
            "name": label,
            "value": db.query(Lead)
            .filter(Lead.workspace_id == workspace.id, Lead.status.in_(included))
            .count(),
        }
        for label, included in stages
    ]

    return {
        "acquisition": [
            {"day": day.isoformat(), "found": leads_added[day], "won": leads_won[day]} for day in window
        ],
        "outreach": [
            {"day": day.isoformat(), "sent": sent[day], "replied": replied[day]} for day in window
        ],
        "funnel": funnel,
    }
