from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core.config import Settings, get_settings
from app.core.deps import get_current_user, get_current_workspace
from app.db.session import get_db
from app.models.campaign import CampaignRecipient
from app.models.company import Company, Contact, SocialProfile, Website, WebsiteStatus
from app.models.lead import Lead, LeadActivity, LeadStatus, Note, Task
from app.models.misc import AIAnalysis
from app.models.search import SearchHistory
from app.models.workspace import User, Workspace
from app.providers.business import BusinessSearchFilters, get_business_provider
from app.providers.website import get_website_provider
from app.schemas.ai import AILeadAnalysis
from app.schemas.lead import (
    LeadDeleteRequest,
    LeadOut,
    LeadSearchRequest,
    LeadSearchResult,
    LeadStatusUpdate,
    LeadsDeleted,
)
from app.services.lead_scoring import LeadScoreService, ScoringInput
from app.services import lead_deletion
from app.services import quota as quota_service
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
    company_ids = [row[0] for row in db.query(Company.id).filter(Company.workspace_id == workspace.id).all()]

    if lead_ids:
        db.query(CampaignRecipient).filter(CampaignRecipient.lead_id.in_(lead_ids)).delete(synchronize_session=False)
        db.query(AIAnalysis).filter(AIAnalysis.lead_id.in_(lead_ids)).delete(synchronize_session=False)
        db.query(LeadActivity).filter(LeadActivity.lead_id.in_(lead_ids)).delete(synchronize_session=False)
        db.query(Note).filter(Note.lead_id.in_(lead_ids)).delete(synchronize_session=False)
        db.query(Task).filter(Task.lead_id.in_(lead_ids)).delete(synchronize_session=False)
        db.query(Lead).filter(Lead.workspace_id == workspace.id).delete(synchronize_session=False)

    if company_ids:
        db.query(Contact).filter(Contact.company_id.in_(company_ids)).delete(synchronize_session=False)
        db.query(SocialProfile).filter(SocialProfile.company_id.in_(company_ids)).delete(synchronize_session=False)
        db.query(Website).filter(Website.company_id.in_(company_ids)).delete(synchronize_session=False)
        db.query(Company).filter(Company.workspace_id == workspace.id).delete(synchronize_session=False)

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
    Runs the full discover -> detect website -> score pipeline synchronously
    for a small result set. At production scale this becomes a background
    job (see apps/worker) that streams progress back over websockets/polling.
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
            limit=25,
        )
    )

    # Website checks were the slowest part of a search by a wide margin: one
    # request per business, in sequence, each waiting up to the provider's
    # timeout. Twenty-five businesses could spend over two minutes here while
    # the user watched a progress bar, which reads as the search being broken.
    #
    # They are independent of each other and almost entirely spent waiting on
    # the network, so they run together. The worker count is capped because
    # these are outbound requests to twenty-five unrelated small businesses,
    # not a pool to saturate.
    website_checks = _check_websites_concurrently(website_provider, businesses)

    created_leads: list[Lead] = []
    for biz in businesses:
        if filters.require_phone and not biz.phone:
            continue
        if filters.require_email and not biz.email:
            continue
        if filters.require_instagram and not biz.instagram:
            continue

        existing = (
            db.query(Company)
            .filter(Company.workspace_id == workspace.id, Company.external_ref == biz.external_ref)
            .first()
        )
        company = existing or Company(
            workspace_id=workspace.id,
            source="lead_finder",
            external_ref=biz.external_ref,
        )
        if not existing:
            db.add(company)

        # Refresh the business details on every search, not just the first —
        # re-running a search over an area is how a user picks up renames,
        # new phone numbers, and corrected addresses. Fields the provider
        # doesn't carry (e.g. ratings on OSM) must not wipe existing values.
        company.name = biz.name
        company.niche = biz.niche
        company.country = biz.country or company.country or ""
        company.city = biz.city or company.city or ""
        company.address = biz.address or company.address
        company.maps_url = biz.maps_url or company.maps_url
        company.hours = biz.hours or company.hours
        company.description = biz.description or company.description
        if biz.rating is not None:
            company.rating = biz.rating
        if biz.reviews_count is not None:
            company.reviews_count = biz.reviews_count

        db.flush()

        if not existing:
            if biz.phone or biz.email:
                db.add(Contact(company_id=company.id, phone=biz.phone, email=biz.email))
            if biz.instagram:
                db.add(
                    SocialProfile(
                        company_id=company.id,
                        platform="instagram",
                        handle=biz.instagram,
                        url=f"https://instagram.com/{biz.instagram}",
                    )
                )
        else:
            # Keep the primary contact in step with the provider without
            # discarding details a user may have filled in by hand.
            contact = db.query(Contact).filter(Contact.company_id == company.id).first()
            if contact is None and (biz.phone or biz.email):
                db.add(Contact(company_id=company.id, phone=biz.phone, email=biz.email))
            elif contact is not None:
                contact.phone = biz.phone or contact.phone
                contact.email = biz.email or contact.email

        website_check = website_checks[biz.external_ref]
        if filters.website_status and website_check.status != filters.website_status:
            continue

        # A company has at most one Website row (unique on company_id), so a
        # repeat search of the same area must refresh the existing record
        # rather than insert a second one.
        website_row = (
            db.query(Website).filter(Website.company_id == company.id).first() if existing else None
        )
        if website_row is None:
            website_row = Website(company_id=company.id)
            db.add(website_row)

        website_row.website_url = website_check.website_url
        website_row.domain = website_check.domain
        website_row.http_status = website_check.http_status
        website_row.ssl_status = website_check.ssl_status
        website_row.redirect_url = website_check.redirect_url
        website_row.title = website_check.title
        website_row.status = website_check.status
        website_row.mobile_friendly = website_check.mobile_friendly
        website_row.load_time_ms = website_check.load_time_ms
        website_row.last_checked_at = website_check.last_checked_at

        # "Established" is normally inferred from review volume, but free
        # providers (OpenStreetMap) don't carry ratings/reviews at all — fall
        # back to other signs of an active, real listing (posted hours,
        # a contact channel) so those leads aren't unfairly zeroed out on
        # this factor just because the data source doesn't track reviews.
        is_established = (
            (biz.reviews_count or 0) >= 30
            if biz.reviews_count is not None
            else bool(biz.hours or biz.phone or biz.email)
        )

        score_result = scorer.score(
            ScoringInput(
                website_status=website_check.status,
                has_active_social=bool(biz.instagram),
                has_phone=bool(biz.phone),
                has_email=bool(biz.email),
                # A listing carrying these is a real, maintained business
                # rather than a stale pin on a map.
                has_address=bool(biz.address),
                has_hours=bool(biz.hours),
            )
        )
        if score_result.score < filters.min_score:
            continue

        # Re-running a search over the same area is normal (refreshing an
        # area, tweaking filters). It must refresh the existing lead's score
        # rather than create a duplicate — and it must never overwrite the
        # pipeline status of a lead the user is already working.
        lead = (
            db.query(Lead)
            .filter(Lead.workspace_id == workspace.id, Lead.company_id == company.id)
            .first()
        )
        if lead is None:
            lead = Lead(
                workspace_id=workspace.id,
                company_id=company.id,
                status=LeadStatus.NEW,
                source="lead_finder",
            )
            db.add(lead)
            db.flush()
            db.add(LeadActivity(lead_id=lead.id, type="system", message="Lead discovered via Lead Finder"))

        lead.score = score_result.score
        lead.score_breakdown = [{"label": b.label, "points": b.points} for b in score_result.breakdown]
        lead.score_recommendation = score_result.recommendation
        lead.priority = score_result.priority
        created_leads.append(lead)

    db.add(
        SearchHistory(
            workspace_id=workspace.id,
            filters=filters.model_dump(mode="json"),
            result_count=len(created_leads),
        )
    )
    db.commit()

    for lead in created_leads:
        db.refresh(lead)

    # Search finds and saves the leads; it does not unlock them. Charging a
    # whole page of quota for one search would spend a FREE plan's month in two
    # searches, and the user has not looked at any of them yet.
    return LeadSearchResult(
        total_found=len(created_leads),
        leads=_serialise(db, workspace.id, created_leads),
    )


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
    from app.models.misc import AIAnalysis
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

