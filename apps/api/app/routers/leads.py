from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core.config import Settings, get_settings
from app.core.deps import get_current_user, get_current_workspace
from app.db.session import get_db
from app.models.company import Company, Contact, SocialProfile, Website, WebsiteStatus
from app.models.lead import Lead, LeadActivity, LeadStatus
from app.models.misc import AIAnalysis
from app.models.search import SearchHistory
from app.models.workspace import User, Workspace
from app.providers.business import BusinessSearchFilters, get_business_provider
from app.providers.website import get_website_provider
from app.schemas.ai import AILeadAnalysis
from app.schemas.lead import (
    LeadDeleteRequest,
    LeadOut,
    LeadPreview,
    LeadSaveRequest,
    LeadSaveResponse,
    LeadSearchRequest,
    LeadSearchResult,
    LeadStatusUpdate,
    LeadsDeleted,
)
from app.services import lead_deletion
from app.services import quota as quota_service
from app.services.lead_scoring import LeadScoreService, ScoringInput
from app.schemas.admin import LeadRevealOut
router = APIRouter(prefix="/api/leads", tags=["leads"])
def _lead_query(db: Session, workspace_id: str):
    return (
        db.query(Lead)
        .options(
            joinedload(Lead.company).joinedload(Company.contacts),
            joinedload(Lead.company).joinedload(Company.social_profiles),
            joinedload(Lead.company).joinedload(Company.website),
        )
        .filter(Lead.workspace_id == workspace_id)
    )
def _check_websites_concurrently(website_provider, businesses: list) -> dict:
    """Check every business's website at once, keyed by its external ref.
    Returns a result for every business, including those with no website at
    all, so the caller can look each one up without a second code path.
    """
    if not businesses:
        return {}
    results: dict[str, object] = {}
    def check(business):
        return business.external_ref, website_provider.detect_website(business.website)
    # Enough to make the wait roughly one timeout rather than twenty-five,
    # without opening an unreasonable number of sockets at once.
    workers = min(10, len(businesses))
    with ThreadPoolExecutor(max_workers=workers) as pool:
        for external_ref, check_result in pool.map(check, businesses):
            results[external_ref] = check_result
    return results
def _serialise(db: Session, workspace_id: str, leads: list[Lead]) -> list[LeadOut]:
    """Serialise leads, removing contact details the workspace has not unlocked.
    The redaction happens here rather than in the interface: an unlocked lead's
    phone number is the thing being sold, so it must not travel in a response
    the user has not paid for.
    """
    revealed = quota_service.revealed_lead_ids(db, workspace_id)
    out: list[LeadOut] = []
    for lead in leads:
        model = LeadOut.model_validate(lead)
        model.contact_revealed = lead.id in revealed
        if not model.contact_revealed:
            for contact in model.company.contacts:
                contact.phone = None
                contact.email = None
            # The maps link carries the exact coordinates, which is most of
            # what the address is worth, so it is withheld too.
            model.company.maps_url = None
        out.append(model)
    return out
@router.get("", response_model=list[LeadOut])
def list_leads(
    status_filter: LeadStatus | None = None,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_current_workspace),
):
    query = _lead_query(db, workspace.id)
    if status_filter:
        query = query.filter(Lead.status == status_filter)
    return _serialise(db, workspace.id, query.order_by(Lead.score.desc()).all())
@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def clear_all_leads(db: Session = Depends(get_db), workspace: Workspace = Depends(get_current_workspace)):
    """
    Permanently deletes every lead (and its companies/contacts/socials/
    website/activity/notes/tasks) in the current workspace — a full reset,
    e.g. to clear out mock-provider test data before switching to a real
    business data provider. Scoped to the workspace, so it can never touch
    another tenant's data.
    """
    lead_ids = [row[0] for row in db.query(Lead.id).filter(Lead.workspace_id == workspace.id).all()]
    # The same service as a single or bulk delete. It kept its own copy of the
    # dependant-clearing logic until now, which is how the two drifted: the
    # single-lead path was missing everything this one remembered.
    lead_deletion.delete_leads(db, workspace.id, lead_ids)
    db.commit()
@router.post("/delete", response_model=LeadsDeleted)
def delete_selected_leads(
    payload: LeadDeleteRequest,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_current_workspace),
):
    """Delete several leads at once.
    POST rather than DELETE with a body: request bodies on DELETE are poorly
    supported by proxies and HTTP clients alike, and a selection of a few
    hundred ids does not belong in a query string.
    Ids belonging to another workspace match nothing rather than erroring, so
    a stale selection deletes what it legitimately can instead of failing
    whole. The count returned is what was actually deleted.
    """
    if not payload.lead_ids:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No leads were selected")
    deleted = lead_deletion.delete_leads(db, workspace.id, payload.lead_ids)
    db.commit()
    return LeadsDeleted(deleted=deleted)
@router.post("/search", response_model=LeadSearchResult)
def search_leads(
    payload: LeadSearchRequest,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_current_workspace),
    settings: Settings = Depends(get_settings),
):
    """
    Runs the discover -> detect website -> score pipeline and returns preview
    results WITHOUT saving to the database. Leads are only persisted when the
    user explicitly saves them via POST /api/leads/save.
    """
    filters = payload.filters
    business_provider = get_business_provider(settings)
    website_provider = get_website_provider()
    scorer = LeadScoreService()
    niche = filters.custom_niche or filters.niche
    businesses = business_provider.search(
        BusinessSearchFilters(
            country=filters.country,
            city=filters.city,
            niche=niche,
            min_rating=filters.min_rating,
            min_reviews=filters.min_reviews,
            max_reviews=filters.max_reviews,
            limit=min(filters.limit, 100),
        )
    )
    website_checks = _check_websites_concurrently(website_provider, businesses)
    previews: list[LeadPreview] = []
    for biz in businesses:
        if filters.require_phone and not biz.phone:
            continue
        if filters.require_email and not biz.email:
            continue
        if filters.require_instagram and not biz.instagram:
            continue
        website_check = website_checks[biz.external_ref]
        if filters.website_status and website_check.status != filters.website_status:
            continue
        score_result = scorer.score(
            ScoringInput(
                website_status=website_check.status,
                has_active_social=bool(biz.instagram),
                has_phone=bool(biz.phone),
                has_email=bool(biz.email),
                has_address=bool(biz.address),
                has_hours=bool(biz.hours),
            )
        )
        if score_result.score < filters.min_score:
            continue
        previews.append(
            LeadPreview(
                external_ref=biz.external_ref,
                name=biz.name,
                niche=biz.niche,
                country=biz.country,
                city=biz.city,
                address=biz.address,
                phone=biz.phone,
                email=biz.email,
                instagram=biz.instagram,
                website=website_check.website_url,
                maps_url=biz.maps_url,
                rating=biz.rating,
                reviews_count=biz.reviews_count,
                hours=biz.hours,
                description=biz.description,
                website_status=website_check.status,
                score={
                    "score": score_result.score,
                    "breakdown": [{"label": b.label, "points": b.points} for b in score_result.breakdown],
                    "recommendation": score_result.recommendation,
                    "priority": score_result.priority,
                },
            )
        )
    db.add(
        SearchHistory(
            workspace_id=workspace.id,
            filters=filters.model_dump(mode="json"),
            result_count=len(previews),
        )
    )
    db.commit()
    return LeadSearchResult(
        total_found=len(previews),
        leads=previews,
    )


@router.post("/save", response_model=LeadSaveResponse, status_code=status.HTTP_201_CREATED)
def save_leads(
    payload: LeadSaveRequest,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_current_workspace),
):
    """Save previewed leads to the workspace. Only creates records for
    external_refs that are not already saved."""
    saved_ids: list[str] = []

    for preview in payload.leads:
        # Skip if already saved
        existing = (
            db.query(Company)
            .filter(Company.workspace_id == workspace.id, Company.external_ref == preview.external_ref)
            .first()
        )
        if existing:
            lead = (
                db.query(Lead)
                .filter(Lead.workspace_id == workspace.id, Lead.company_id == existing.id)
                .first()
            )
            if lead:
                saved_ids.append(lead.id)
                continue
            company = existing
        else:
            company = Company(
                workspace_id=workspace.id,
                source="lead_finder",
                external_ref=preview.external_ref,
                name=preview.name,
                niche=preview.niche,
                country=preview.country or "",
                city=preview.city or "",
                address=preview.address,
                maps_url=preview.maps_url,
                hours=preview.hours,
                description=preview.description,
                rating=preview.rating,
                reviews_count=preview.reviews_count,
            )
            db.add(company)
            db.flush()

        if not existing:
            if preview.phone or preview.email:
                db.add(Contact(company_id=company.id, phone=preview.phone, email=preview.email))
            if preview.instagram:
                db.add(
                    SocialProfile(
                        company_id=company.id,
                        platform="instagram",
                        handle=preview.instagram,
                        url=f"https://instagram.com/{preview.instagram}",
                    )
                )
            db.add(Website(
                company_id=company.id,
                website_url=preview.website,
                status=preview.website_status,
            ))

        lead = Lead(
            workspace_id=workspace.id,
            company_id=company.id,
            status=LeadStatus.NEW,
            source="lead_finder",
            score=preview.score.score,
            score_breakdown=[{"label": b.label, "points": b.points} for b in preview.score.breakdown],
            score_recommendation=preview.score.recommendation,
            priority=preview.score.priority,
        )
        db.add(lead)
        db.flush()
        db.add(LeadActivity(lead_id=lead.id, type="system", message="Lead saved from discovery"))
        saved_ids.append(lead.id)

    db.commit()
    return LeadSaveResponse(saved=len(saved_ids), lead_ids=saved_ids)
@router.get("/{lead_id}", response_model=LeadOut)
def get_lead(lead_id: str, db: Session = Depends(get_db), workspace: Workspace = Depends(get_current_workspace)):
    lead = _lead_query(db, workspace.id).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lead not found")
    return _serialise(db, workspace.id, [lead])[0]
@router.patch("/{lead_id}", response_model=LeadOut)
def update_lead_status(
    lead_id: str,
    payload: LeadStatusUpdate,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_current_workspace),
):
    lead = _lead_query(db, workspace.id).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lead not found")
    lead.status = payload.status
    db.add(LeadActivity(lead_id=lead.id, type="system", message=f"Status changed to {payload.status.value}"))
    db.commit()
    db.refresh(lead)
    return lead
@router.delete("/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lead(lead_id: str, db: Session = Depends(get_db), workspace: Workspace = Depends(get_current_workspace)):
    lead = _lead_query(db, workspace.id).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lead not found")
    # Goes through the same service as a bulk delete rather than db.delete():
    # AI analyses and campaign recipients hold non-null foreign keys that no
    # relationship cascades, so the plain version raised an IntegrityError for
    # any lead that had been analysed, mailed, or unlocked.
    lead_deletion.delete_leads(db, workspace.id, [lead_id])
    db.commit()
@router.post("/{lead_id}/analyze", response_model=AILeadAnalysis)
def analyze_lead(
    lead_id: str,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_current_workspace),
    settings: Settings = Depends(get_settings),
):
    from app.providers.ai import LeadContext, get_ai_provider
    from app.services.ai_service import AIService
    lead = _lead_query(db, workspace.id).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lead not found")
    company = lead.company
    context = LeadContext(
        company_name=company.name,
        niche=company.niche,
        city=company.city,
        country=company.country,
        rating=company.rating,
        reviews_count=company.reviews_count,
        website_status=(company.website.status.value if company.website else WebsiteStatus.NO_WEBSITE.value),
        has_instagram=bool(company.social_profiles),
        has_phone=bool(company.contacts and company.contacts[0].phone),
        has_email=bool(company.contacts and company.contacts[0].email),
    )
    service = AIService(get_ai_provider(settings))
    analysis = service.analyze_lead(context)
    db.add(AIAnalysis(lead_id=lead.id, provider=settings.ai_provider, model=settings.ai_model, result=analysis.model_dump()))
    db.add(LeadActivity(lead_id=lead.id, type="ai", message="AI analysis completed"))
    db.commit()
    return analysis
@router.post("/{lead_id}/reveal", response_model=LeadRevealOut)
def reveal_lead_contact(
    lead_id: str,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_current_workspace),
    user: User = Depends(get_current_user),
):
    """Unlock one lead's contact details, consuming one of the plan's leads.
    Unlocking the same lead again is free and returns the same details, so the
    number counts leads rather than clicks.
    """
    lead = (
        _lead_query(db, workspace.id)
        .filter(Lead.id == lead_id)
        .first()
    )
    if not lead:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lead not found")
    try:
        quota_service.reveal_lead(db, workspace, lead_id, user.id)
    except quota_service.QuotaExceeded as exc:
        # 402 rather than 403: the request is understood and the caller is
        # allowed to make it - they have simply used the month's allowance.
        raise HTTPException(
            status.HTTP_402_PAYMENT_REQUIRED,
            {
                "code": "QUOTA_EXCEEDED",
                "message": (
                    f"You have used all {exc.limit} leads included in the "
                    f"{exc.plan} plan this week. Your allowance refills on Monday. "
                    "You can also buy a pack of extra leads, or upgrade for a "
                    "larger weekly allowance."
                ),
                "used": exc.used,
                "limit": exc.limit,
                "plan": exc.plan,
            },
        ) from exc
    db.commit()
    state = quota_service.quota_state(db, workspace)
    contact = lead.company.contacts[0] if lead.company.contacts else None
    return LeadRevealOut(
        lead_id=lead.id,
        phone=contact.phone if contact else None,
        email=contact.email if contact else None,
        maps_url=lead.company.maps_url,
        website=lead.company.website.website_url if lead.company.website else None,
        used=int(state["used"]),
        limit=int(state["limit"]),
        remaining=int(state["remaining"]),
        included_remaining=int(state["included_remaining"]),
        credit_balance=int(state["credit_balance"]),
    )
