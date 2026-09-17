import enum

from sqlalchemy import JSON, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class CampaignStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SCHEDULED = "SCHEDULED"
    RUNNING = "RUNNING"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"


class RecipientStatus(str, enum.Enum):
    PENDING = "PENDING"
    SENT = "SENT"
    OPENED = "OPENED"
    REPLIED = "REPLIED"
    BOUNCED = "BOUNCED"
    UNSUBSCRIBED = "UNSUBSCRIBED"
    SKIPPED_SUPPRESSED = "SKIPPED_SUPPRESSED"


class EmailTemplate(Base):
    __tablename__ = "email_templates"

    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    subject: Mapped[str] = mapped_column(String(500), nullable=False)
    body: Mapped[str] = mapped_column(String(8000), nullable=False)


class Campaign(Base):
    __tablename__ = "campaigns"

    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String(2000))
    sender: Mapped[str] = mapped_column(String(255), nullable=False)
    reply_to: Mapped[str | None] = mapped_column(String(255))
    subject: Mapped[str] = mapped_column(String(500), nullable=False)
    template_id: Mapped[str | None] = mapped_column(ForeignKey("email_templates.id"))
    status: Mapped[CampaignStatus] = mapped_column(Enum(CampaignStatus), default=CampaignStatus.DRAFT, index=True, nullable=False)
    daily_send_limit: Mapped[int] = mapped_column(Integer, default=100)

    recipients: Mapped[list["CampaignRecipient"]] = relationship(back_populates="campaign", cascade="all, delete-orphan")


class CampaignRecipient(Base):
    __tablename__ = "campaign_recipients"

    campaign_id: Mapped[str] = mapped_column(ForeignKey("campaigns.id"), index=True, nullable=False)
    lead_id: Mapped[str] = mapped_column(ForeignKey("leads.id"), index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    status: Mapped[RecipientStatus] = mapped_column(Enum(RecipientStatus), default=RecipientStatus.PENDING, nullable=False)
    sequence_step: Mapped[int] = mapped_column(Integer, default=0)
    sent_at: Mapped[str | None] = mapped_column(String(64))
    opened_at: Mapped[str | None] = mapped_column(String(64))
    replied_at: Mapped[str | None] = mapped_column(String(64))
    bounced_at: Mapped[str | None] = mapped_column(String(64))
    unsubscribed_at: Mapped[str | None] = mapped_column(String(64))

    campaign: Mapped["Campaign"] = relationship(back_populates="recipients")


class EmailEvent(Base):
    __tablename__ = "email_events"

    campaign_recipient_id: Mapped[str] = mapped_column(ForeignKey("campaign_recipients.id"), index=True, nullable=False)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)


class SuppressionEntry(Base):
    __tablename__ = "suppression_entries"

    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id"), index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    reason: Mapped[str] = mapped_column(String(120), nullable=False)
