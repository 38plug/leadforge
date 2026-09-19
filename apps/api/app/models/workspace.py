import enum

from sqlalchemy import Enum, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class WorkspaceRole(str, enum.Enum):
    OWNER = "OWNER"
    ADMIN = "ADMIN"
    MEMBER = "MEMBER"


class User(Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(255))
    hashed_password: Mapped[str | None] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(default=True)

    # Platform administrator, distinct from WorkspaceRole.ADMIN below. That
    # role governs one workspace; this governs the installation - every
    # account, every workspace, billing. It is deliberately not settable
    # through registration or any workspace-scoped endpoint.
    is_superuser: Mapped[bool] = mapped_column(default=False, nullable=False)

    # Whether the address has been confirmed by following an emailed link.
    # Recorded but not required to sign in: gating login on it would lock
    # everyone out of an installation whose SMTP is not configured yet.
    email_verified_at: Mapped[str | None] = mapped_column(String(64))

    # Keyed hash of the origin this account was created from, for limiting how
    # many accounts one place can open. Stored hashed because counting only
    # needs equality, and an IP address is personal data this table has no
    # reason to hold in readable form. See app/services/signup_guard.py.
    signup_ip_hash: Mapped[str | None] = mapped_column(String(64), index=True)

    memberships: Mapped[list["WorkspaceMember"]] = relationship(back_populates="user")


class Workspace(Base):
    __tablename__ = "workspaces"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    plan: Mapped[str] = mapped_column(String(50), default="FREE", nullable=False)

    members: Mapped[list["WorkspaceMember"]] = relationship(back_populates="workspace", cascade="all, delete-orphan")


class WorkspaceMember(Base):
    __tablename__ = "workspace_members"
    __table_args__ = (UniqueConstraint("workspace_id", "user_id", name="uq_workspace_user"),)

    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id"), index=True, nullable=False)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    role: Mapped[WorkspaceRole] = mapped_column(Enum(WorkspaceRole), default=WorkspaceRole.MEMBER, nullable=False)

    workspace: Mapped["Workspace"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship(back_populates="memberships")


class WorkspaceEmailSettings(Base):
    """Per-workspace outbound mail configuration.

    LeadForge is multi-tenant: every workspace sends from its own mailbox,
    under its own name, so replies reach the person who sent the outreach.
    A single server-wide SMTP account would put every customer's mail under
    one sender identity, which is both wrong for deliverability and a
    compliance problem.

    The password is stored encrypted (see app/core/crypto.py) and is never
    returned by the API.
    """

    __tablename__ = "workspace_email_settings"
    __table_args__ = (UniqueConstraint("workspace_id", name="uq_email_settings_workspace"),)

    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id"), index=True, nullable=False)

    from_address: Mapped[str] = mapped_column(String(255), nullable=False)
    from_name: Mapped[str | None] = mapped_column(String(255))
    reply_to: Mapped[str | None] = mapped_column(String(255))

    smtp_host: Mapped[str] = mapped_column(String(255), nullable=False)
    smtp_port: Mapped[int] = mapped_column(default=587, nullable=False)
    smtp_username: Mapped[str] = mapped_column(String(255), nullable=False)
    smtp_password_encrypted: Mapped[str] = mapped_column(String(1000), nullable=False)
    smtp_use_tls: Mapped[bool] = mapped_column(default=True, nullable=False)

    daily_send_limit: Mapped[int] = mapped_column(default=200, nullable=False)
    # Set when a test message was delivered successfully, so the UI can show
    # whether this configuration has actually been proven to work.
    verified_at: Mapped[str | None] = mapped_column(String(64))
