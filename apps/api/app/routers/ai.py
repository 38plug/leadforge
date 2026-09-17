from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core.config import Settings, get_settings
from app.core.deps import get_current_workspace
from app.db.session import get_db
from app.models.company import Company, WebsiteStatus
from app.models.lead import Lead
from app.models.workspace import Workspace
from app.providers.ai import LeadContext, get_ai_provider
from app.schemas.ai import (
    AssistantChatRequest,
    AssistantChatResponse,
    GenerateCallScriptRequest,
    GenerateCallScriptResponse,
    GenerateEmailRequest,
    GenerateEmailResponse,
)
from app.services.ai_service import AIService

router = APIRouter(prefix="/api/ai", tags=["ai"])


def _lead_context(db: Session, workspace_id: str, lead_id: str) -> LeadContext:
    lead = (
        db.query(Lead)
        .options(joinedload(Lead.company).joinedload(Company.contacts), joinedload(Lead.company).joinedload(Company.social_profiles))
        .filter(Lead.id == lead_id, Lead.workspace_id == workspace_id)
        .first()
    )
    if not lead:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lead not found")
    company = lead.company
    return LeadContext(
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


@router.post("/generate-email", response_model=GenerateEmailResponse)
def generate_email(
    payload: GenerateEmailRequest,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_current_workspace),
    settings: Settings = Depends(get_settings),
):
    context = _lead_context(db, workspace.id, payload.lead_id)
    service = AIService(get_ai_provider(settings))
    return service.generate_email(context, payload.tone, payload.goal)


@router.post("/generate-call-script", response_model=GenerateCallScriptResponse)
def generate_call_script(
    payload: GenerateCallScriptRequest,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_current_workspace),
    settings: Settings = Depends(get_settings),
):
    context = _lead_context(db, workspace.id, payload.lead_id)
    service = AIService(get_ai_provider(settings))
    return service.generate_call_script(context)


@router.post("/assistant", response_model=AssistantChatResponse)
def assistant_chat(
    payload: AssistantChatRequest,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_current_workspace),
    settings: Settings = Depends(get_settings),
):
    context = _lead_context(db, workspace.id, payload.lead_id) if payload.lead_id else None
    service = AIService(get_ai_provider(settings))
    return AssistantChatResponse(reply=service.chat(payload.message, context))
