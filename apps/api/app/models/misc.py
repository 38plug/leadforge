from sqlalchemy import JSON, ForeignKey, Integer, String, UniqueConstraint
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


class Coupon(Base):
    """A discount code, typically issued for a partnership or a launch.

    Coupons are real records and can be created, listed and revoked today.
    What they cannot yet do is reduce anyone's bill: no payment processor is
    connected, so nothing charges money for them to discount. They are stored
    so the codes exist and are auditable from the moment they are handed out,
    and billing reads them once it exists.
    """

    __tablename__ = "coupons"

    code: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(255))

    # Exactly one of these is set; the other stays null.
    percent_off: Mapped[int | None] = mapped_column(Integer)
    amount_off_cents: Mapped[int | None] = mapped_column(Integer)

    # Null means unlimited. redeemed_count only moves when billing redeems it.
    max_redemptions: Mapped[int | None] = mapped_column(Integer)
    redeemed_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    expires_at: Mapped[str | None] = mapped_column(String(64))
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_by_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), index=True)


class LeadReveal(Base):
    """Records that a workspace has unlocked one lead's contact details.

    This is the unit the plan is metered in. It exists as its own table rather
    than as a UsageRecord row so that (workspace, lead) can be unique: opening
    the same lead a second time must not consume quota again, or the counter
    would measure clicking rather than leads and punish ordinary use.
    """

    __tablename__ = "lead_reveals"
    __table_args__ = (UniqueConstraint("workspace_id", "lead_id", name="uq_reveal_workspace_lead"),)

    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id"), index=True, nullable=False)
    lead_id: Mapped[str] = mapped_column(ForeignKey("leads.id"), index=True, nullable=False)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), index=True)
    # "YYYY-MM": quota is a monthly allowance, so usage is counted per period.
    period: Mapped[str] = mapped_column(String(20), index=True, nullable=False)


class AuthToken(Base):
    """A single-use, expiring token for email verification or password reset.

    Only a hash is stored. These tokens are password-equivalent - one is enough
    to take over an account - so a database dump must not hand out working
    reset links. The raw value exists only in the email that was sent.

    `purpose` is checked on use so a verification link can never be replayed as
    a password reset.
    """

    __tablename__ = "auth_tokens"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    purpose: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    expires_at: Mapped[str] = mapped_column(String(64), nullable=False)
    used_at: Mapped[str | None] = mapped_column(String(64))
