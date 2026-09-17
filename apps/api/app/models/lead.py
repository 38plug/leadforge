import enum

from sqlalchemy import JSON, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class LeadStatus(str, enum.Enum):
    NEW = "NEW"
    RESEARCHED = "RESEARCHED"
    CONTACTED = "CONTACTED"
    REPLIED = "REPLIED"
    INTERESTED = "INTERESTED"
    MEETING = "MEETING"
    PROPOSAL = "PROPOSAL"
    WON = "WON"
    LOST = "LOST"


class LeadPriority(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    URGENT = "URGENT"


class Lead(Base):
    __tablename__ = "leads"

    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id"), index=True, nullable=False)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"), index=True, nullable=False)

    status: Mapped[LeadStatus] = mapped_column(Enum(LeadStatus), default=LeadStatus.NEW, index=True, nullable=False)
    owner_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))

    score: Mapped[int] = mapped_column(Integer, default=0, index=True, nullable=False)
    score_breakdown: Mapped[list] = mapped_column(JSON, default=list)
    score_recommendation: Mapped[str | None] = mapped_column(String(500))
    priority: Mapped[LeadPriority] = mapped_column(Enum(LeadPriority), default=LeadPriority.LOW, nullable=False)

    estimated_value: Mapped[float | None] = mapped_column()
    source: Mapped[str] = mapped_column(String(120), default="lead_finder")
    campaign_id: Mapped[str | None] = mapped_column(ForeignKey("campaigns.id"))

    last_contacted_at: Mapped[str | None] = mapped_column(String(64))
    follow_up_date: Mapped[str | None] = mapped_column(String(64))
    contact_attempts: Mapped[int] = mapped_column(Integer, default=0)

    company: Mapped["Company"] = relationship(back_populates="leads")  # noqa: F821
    activities: Mapped[list["LeadActivity"]] = relationship(back_populates="lead", cascade="all, delete-orphan")
    notes: Mapped[list["Note"]] = relationship(back_populates="lead", cascade="all, delete-orphan")
    tasks: Mapped[list["Task"]] = relationship(back_populates="lead", cascade="all, delete-orphan")


class LeadActivity(Base):
    __tablename__ = "lead_activities"

    lead_id: Mapped[str] = mapped_column(ForeignKey("leads.id"), index=True, nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    message: Mapped[str] = mapped_column(String(1000), nullable=False)
    actor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))

    lead: Mapped["Lead"] = relationship(back_populates="activities")


class Note(Base):
    __tablename__ = "notes"

    lead_id: Mapped[str] = mapped_column(ForeignKey("leads.id"), index=True, nullable=False)
    author_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(String(4000), nullable=False)

    lead: Mapped["Lead"] = relationship(back_populates="notes")


class Task(Base):
    __tablename__ = "tasks"

    lead_id: Mapped[str] = mapped_column(ForeignKey("leads.id"), index=True, nullable=False)
    assignee_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    due_date: Mapped[str | None] = mapped_column(String(64))
    completed: Mapped[bool] = mapped_column(default=False)

    lead: Mapped["Lead"] = relationship(back_populates="tasks")
