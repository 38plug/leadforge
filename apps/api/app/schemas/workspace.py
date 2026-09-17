from pydantic import BaseModel, ConfigDict, Field

from app.models.workspace import WorkspaceRole


class WorkspaceMemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    user_id: str
    role: WorkspaceRole
    email: str
    full_name: str | None = None


class InviteMemberRequest(BaseModel):
    email: str
    role: WorkspaceRole = WorkspaceRole.MEMBER


class WorkspaceUpdateRequest(BaseModel):
    name: str


class UsageOut(BaseModel):
    lead_searches: int
    ai_analyses: int
    emails_sent: int
    team_members: int
    plan: str


class EmailSettingsOut(BaseModel):
    """Never includes the SMTP password, in any form."""

    configured: bool
    from_address: str | None = None
    from_name: str | None = None
    reply_to: str | None = None
    smtp_host: str | None = None
    smtp_port: int | None = None
    smtp_username: str | None = None
    smtp_use_tls: bool = True
    daily_send_limit: int | None = None
    verified_at: str | None = None


class EmailSettingsUpdate(BaseModel):
    from_address: str
    from_name: str | None = None
    reply_to: str | None = None
    smtp_host: str
    smtp_port: int = 587
    smtp_username: str | None = None
    # Omitted on edit to keep the stored password unchanged.
    smtp_password: str | None = None
    smtp_use_tls: bool = True
    daily_send_limit: int = Field(default=200, ge=1, le=2000)


class EmailTestRequest(BaseModel):
    to: str
