from sqlalchemy import JSON, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Notification(Base):
    __tablename__ = "notifications"

    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id"), index=True, nullable=False)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str | None] = mapped_column(String(1000))
    read: Mapped[bool] = mapped_column(default=False)


class AIAnalysis(Base):
    __tablename__ = "ai_analyses"

    lead_id: Mapped[str] = mapped_column(ForeignKey("leads.id"), index=True, nullable=False)
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    model: Mapped[str] = mapped_column(String(120), nullable=False)
    result: Mapped[dict] = mapped_column(JSON, default=dict)


class DataProviderConfig(Base):
    __tablename__ = "data_provider_configs"

    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id"), index=True, nullable=False)
    provider_type: Mapped[str] = mapped_column(String(50), nullable=False)
    provider_name: Mapped[str] = mapped_column(String(120), nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True)
    config: Mapped[dict] = mapped_column(JSON, default=dict)


class Subscription(Base):
    __tablename__ = "subscriptions"

    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id"), unique=True, index=True, nullable=False)
    plan: Mapped[str] = mapped_column(String(50), default="FREE", nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="ACTIVE", nullable=False)
    provider: Mapped[str | None] = mapped_column(String(50))
    external_customer_id: Mapped[str | None] = mapped_column(String(255))
    external_subscription_id: Mapped[str | None] = mapped_column(String(255))
    current_period_end: Mapped[str | None] = mapped_column(String(64))


class UsageRecord(Base):
    __tablename__ = "usage_records"

    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id"), index=True, nullable=False)
    metric: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    period: Mapped[str] = mapped_column(String(20), index=True, nullable=False)
