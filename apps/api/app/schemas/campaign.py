from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.campaign import CampaignStatus, RecipientStatus


class EmailTemplateCreate(BaseModel):
    name: str
    subject: str
    body: str


class EmailTemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    subject: str
    body: str


class CampaignCreate(BaseModel):
    name: str
    description: str | None = None
    sender: str
    reply_to: str | None = None
    subject: str
    template_id: str | None = None
    daily_send_limit: int = 100


class CampaignStatusUpdate(BaseModel):
    status: CampaignStatus


class CampaignRecipientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    lead_id: str
    email: str
    status: RecipientStatus
    sequence_step: int
    sent_at: str | None = None
    opened_at: str | None = None
    replied_at: str | None = None
    bounced_at: str | None = None
    unsubscribed_at: str | None = None


class CampaignOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    description: str | None = None
    sender: str
    reply_to: str | None = None
    subject: str
    status: CampaignStatus
    daily_send_limit: int
    created_at: datetime


class CampaignSendRequest(BaseModel):
    lead_ids: list[str]


class CampaignSendResult(BaseModel):
    queued: int
    skipped_suppressed: int
    skipped_duplicate: int
    sent: int
