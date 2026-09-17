from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core.config import Settings, get_settings
from app.core.deps import get_current_workspace
from app.db.session import get_db
from app.models.campaign import Campaign, CampaignRecipient, CampaignStatus, EmailTemplate
from app.models.company import Company
from app.models.lead import Lead
from app.models.workspace import Workspace
from app.providers.email import get_workspace_email_provider
from app.schemas.campaign import (
    CampaignCreate,
    CampaignOut,
    CampaignRecipientOut,
    CampaignSendRequest,
    CampaignSendResult,
    CampaignStatusUpdate,
    EmailTemplateCreate,
    EmailTemplateOut,
)
from app.services.campaign_service import CampaignService

router = APIRouter(prefix="/api/campaigns", tags=["campaigns"])
templates_router = APIRouter(prefix="/api/email-templates", tags=["campaigns"])


@router.get("", response_model=list[CampaignOut])
def list_campaigns(db: Session = Depends(get_db), workspace: Workspace = Depends(get_current_workspace)):
    return (
        db.query(Campaign)
        .filter(Campaign.workspace_id == workspace.id)
        .order_by(Campaign.created_at.desc())
        .all()
    )


@router.post("", response_model=CampaignOut, status_code=status.HTTP_201_CREATED)
def create_campaign(
    payload: CampaignCreate, db: Session = Depends(get_db), workspace: Workspace = Depends(get_current_workspace)
):
    if payload.template_id:
        template = (
            db.query(EmailTemplate)
            .filter(EmailTemplate.id == payload.template_id, EmailTemplate.workspace_id == workspace.id)
            .first()
        )
        if not template:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Email template not found")

    campaign = Campaign(workspace_id=workspace.id, status=CampaignStatus.DRAFT, **payload.model_dump())
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign


@router.get("/{campaign_id}", response_model=CampaignOut)
def get_campaign(
    campaign_id: str, db: Session = Depends(get_db), workspace: Workspace = Depends(get_current_workspace)
):
    campaign = (
        db.query(Campaign).filter(Campaign.id == campaign_id, Campaign.workspace_id == workspace.id).first()
    )
    if not campaign:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Campaign not found")
    return campaign


@router.patch("/{campaign_id}/status", response_model=CampaignOut)
def update_campaign_status(
    campaign_id: str,
    payload: CampaignStatusUpdate,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_current_workspace),
):
    """
    DRAFT -> RUNNING, RUNNING <-> PAUSED, anything -> COMPLETED. This is the
    only way a campaign's status changes, so pausing always takes effect
    before the next send.
    """
    campaign = (
        db.query(Campaign).filter(Campaign.id == campaign_id, Campaign.workspace_id == workspace.id).first()
    )
    if not campaign:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Campaign not found")
    campaign.status = payload.status
    db.commit()
    db.refresh(campaign)
    return campaign


@router.get("/{campaign_id}/recipients", response_model=list[CampaignRecipientOut])
def list_recipients(
    campaign_id: str, db: Session = Depends(get_db), workspace: Workspace = Depends(get_current_workspace)
):
    campaign = (
        db.query(Campaign).filter(Campaign.id == campaign_id, Campaign.workspace_id == workspace.id).first()
    )
    if not campaign:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Campaign not found")
    return db.query(CampaignRecipient).filter(CampaignRecipient.campaign_id == campaign_id).all()


@router.post("/{campaign_id}/send", response_model=CampaignSendResult)
def send_campaign(
    campaign_id: str,
    payload: CampaignSendRequest,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_current_workspace),
    settings: Settings = Depends(get_settings),
):
    campaign = (
        db.query(Campaign).filter(Campaign.id == campaign_id, Campaign.workspace_id == workspace.id).first()
    )
    if not campaign:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Campaign not found")
    if campaign.status == CampaignStatus.PAUSED:
        raise HTTPException(status.HTTP_409_CONFLICT, "Campaign is paused — resume it before sending")

    # Ensure lead.company + contacts are loaded for the render step
    db.query(Lead).options(joinedload(Lead.company).joinedload(Company.contacts)).filter(
        Lead.id.in_(payload.lead_ids)
    ).all()

    service = CampaignService(db, get_workspace_email_provider(db, workspace.id, settings))
    summary = service.send_to_leads(campaign, payload.lead_ids, workspace.id)

    if campaign.status == CampaignStatus.DRAFT:
        campaign.status = CampaignStatus.RUNNING
        db.commit()

    return CampaignSendResult(
        queued=summary.queued,
        skipped_suppressed=summary.skipped_suppressed,
        skipped_duplicate=summary.skipped_duplicate,
        sent=summary.sent,
    )


@router.post("/unsubscribe", status_code=status.HTTP_204_NO_CONTENT, tags=["public"])
def unsubscribe(
    workspace_id: str,
    email: str,
    db: Session = Depends(get_db),
):
    """
    Public, unauthenticated endpoint — this is the link every outreach
    email must include. No workspace membership is required to opt out.
    """
    service = CampaignService(db, get_workspace_email_provider(db, workspace_id, get_settings()))
    service.unsubscribe(workspace_id, email)


@templates_router.get("", response_model=list[EmailTemplateOut])
def list_templates(db: Session = Depends(get_db), workspace: Workspace = Depends(get_current_workspace)):
    return db.query(EmailTemplate).filter(EmailTemplate.workspace_id == workspace.id).all()


@templates_router.post("", response_model=EmailTemplateOut, status_code=status.HTTP_201_CREATED)
def create_template(
    payload: EmailTemplateCreate, db: Session = Depends(get_db), workspace: Workspace = Depends(get_current_workspace)
):
    template = EmailTemplate(workspace_id=workspace.id, **payload.model_dump())
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


@templates_router.patch("/{template_id}", response_model=EmailTemplateOut)
def update_template(
    template_id: str,
    payload: EmailTemplateCreate,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_current_workspace),
):
    template = (
        db.query(EmailTemplate)
        .filter(EmailTemplate.id == template_id, EmailTemplate.workspace_id == workspace.id)
        .first()
    )
    if not template:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Template not found")
    for field, value in payload.model_dump().items():
        setattr(template, field, value)
    db.commit()
    db.refresh(template)
    return template


@templates_router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(
    template_id: str, db: Session = Depends(get_db), workspace: Workspace = Depends(get_current_workspace)
):
    template = (
        db.query(EmailTemplate)
        .filter(EmailTemplate.id == template_id, EmailTemplate.workspace_id == workspace.id)
        .first()
    )
    if not template:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Template not found")
    db.delete(template)
    db.commit()
