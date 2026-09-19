from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.crypto import encrypt_secret
from app.core.deps import get_current_user, get_current_workspace
from app.db.session import get_db
from app.models.campaign import Campaign, CampaignRecipient, RecipientStatus
from app.models.lead import Lead
from app.models.misc import AIAnalysis
from app.models.search import SearchHistory
from app.models.workspace import (
    User,
    Workspace,
    WorkspaceEmailSettings,
    WorkspaceMember,
    WorkspaceRole,
)
from app.providers.email import get_workspace_email_provider
from app.providers.errors import ProviderError
from app.schemas.auth import WorkspaceOut
from app.schemas.workspace import (
    EmailSettingsOut,
    EmailSettingsUpdate,
    EmailTestRequest,
    InviteMemberRequest,
    UsageOut,
    WorkspaceMemberOut,
    WorkspaceUpdateRequest,
)
from app.services import quota as quota_service

router = APIRouter(prefix="/api/workspace", tags=["workspace"])


@router.patch("", response_model=WorkspaceOut)
def update_workspace(
    payload: WorkspaceUpdateRequest,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_current_workspace),
):
    workspace.name = payload.name
    db.commit()
    db.refresh(workspace)
    return workspace


@router.get("/members", response_model=list[WorkspaceMemberOut])
def list_members(db: Session = Depends(get_db), workspace: Workspace = Depends(get_current_workspace)):
    rows = (
        db.query(WorkspaceMember, User)
        .join(User, User.id == WorkspaceMember.user_id)
        .filter(WorkspaceMember.workspace_id == workspace.id)
        .all()
    )
    return [
        WorkspaceMemberOut(id=member.id, user_id=user.id, role=member.role, email=user.email, full_name=user.full_name)
        for member, user in rows
    ]


@router.post("/members/invite", response_model=WorkspaceMemberOut, status_code=status.HTTP_201_CREATED)
def invite_member(
    payload: InviteMemberRequest,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_current_workspace),
):
    """
    Adds an existing user to the workspace. Sending an actual invitation
    email (for a user who doesn't have an account yet) is a job for the
    EmailProvider once a real one is configured — this endpoint covers the
    data model side so the Team Management UI has something real to call.
    """
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "No LeadForge account exists for this email yet — ask them to sign up first.",
        )
    existing = (
        db.query(WorkspaceMember)
        .filter(WorkspaceMember.workspace_id == workspace.id, WorkspaceMember.user_id == user.id)
        .first()
    )
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "This user is already a member of the workspace")

    member = WorkspaceMember(workspace_id=workspace.id, user_id=user.id, role=payload.role)
    db.add(member)
    db.commit()
    db.refresh(member)
    return WorkspaceMemberOut(id=member.id, user_id=user.id, role=member.role, email=user.email, full_name=user.full_name)


@router.delete("/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    member_id: str, db: Session = Depends(get_db), workspace: Workspace = Depends(get_current_workspace)
):
    member = (
        db.query(WorkspaceMember)
        .filter(WorkspaceMember.id == member_id, WorkspaceMember.workspace_id == workspace.id)
        .first()
    )
    if not member:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
    if member.role == WorkspaceRole.OWNER:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The workspace owner cannot be removed")
    db.delete(member)
    db.commit()


@router.get("/usage", response_model=UsageOut)
def get_usage(db: Session = Depends(get_db), workspace: Workspace = Depends(get_current_workspace)):
    lead_searches = db.query(SearchHistory).filter(SearchHistory.workspace_id == workspace.id).count()

    ai_analyses = (
        db.query(AIAnalysis)
        .join(Lead, Lead.id == AIAnalysis.lead_id)
        .filter(Lead.workspace_id == workspace.id)
        .count()
    )

    emails_sent = (
        db.query(CampaignRecipient)
        .join(Campaign, Campaign.id == CampaignRecipient.campaign_id)
        .filter(Campaign.workspace_id == workspace.id, CampaignRecipient.status == RecipientStatus.SENT)
        .count()
    )

    quota = quota_service.quota_state(db, workspace)

    return UsageOut(
        lead_reveals=int(quota["used"]),
        lead_reveals_limit=int(quota["limit"]),
        lead_reveals_remaining=int(quota["remaining"]),
        lead_reveals_included_remaining=int(quota["included_remaining"]),
        credit_balance=int(quota["credit_balance"]),
        quota_exhausted=bool(quota["exhausted"]),
        lead_searches=lead_searches,
        ai_analyses=ai_analyses,
        emails_sent=emails_sent,
        team_members=db.query(WorkspaceMember).filter(WorkspaceMember.workspace_id == workspace.id).count(),
        plan=workspace.plan,
    )


# --- Outbound email configuration ----------------------------------------
# Each workspace connects its own mailbox. Nothing here ever returns the
# stored password, and only workspace owners/admins may change it.

SMTP_PRESETS = {
    "gmail.com": ("smtp.gmail.com", 587),
    "googlemail.com": ("smtp.gmail.com", 587),
    "outlook.com": ("smtp-mail.outlook.com", 587),
    "hotmail.com": ("smtp-mail.outlook.com", 587),
    "zoho.com": ("smtp.zoho.com", 587),
    "yahoo.com": ("smtp.mail.yahoo.com", 587),
    "fastmail.com": ("smtp.fastmail.com", 465),
}


def _require_admin(db: Session, workspace: Workspace, user: User) -> None:
    membership = (
        db.query(WorkspaceMember)
        .filter(WorkspaceMember.workspace_id == workspace.id, WorkspaceMember.user_id == user.id)
        .first()
    )
    if membership is None or membership.role not in (WorkspaceRole.OWNER, WorkspaceRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only workspace owners and admins can change email settings.",
        )


def _settings_out(row: WorkspaceEmailSettings | None) -> EmailSettingsOut:
    if row is None:
        return EmailSettingsOut(configured=False)
    return EmailSettingsOut(
        configured=True,
        from_address=row.from_address,
        from_name=row.from_name,
        reply_to=row.reply_to,
        smtp_host=row.smtp_host,
        smtp_port=row.smtp_port,
        smtp_username=row.smtp_username,
        smtp_use_tls=row.smtp_use_tls,
        daily_send_limit=row.daily_send_limit,
        verified_at=row.verified_at,
    )


@router.get("/email-settings", response_model=EmailSettingsOut)
def get_email_settings(
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_current_workspace),
):
    row = (
        db.query(WorkspaceEmailSettings)
        .filter(WorkspaceEmailSettings.workspace_id == workspace.id)
        .first()
    )
    return _settings_out(row)


@router.get("/email-settings/suggest")
def suggest_smtp(email: str):
    """Look up the SMTP host for a well-known mail domain, so most users
    never have to know what a host name is."""
    domain = email.split("@")[-1].strip().lower()
    preset = SMTP_PRESETS.get(domain)
    if not preset:
        return {"known": False}
    host, port = preset
    return {"known": True, "smtp_host": host, "smtp_port": port, "provider": domain}


@router.put("/email-settings", response_model=EmailSettingsOut)
def save_email_settings(
    payload: EmailSettingsUpdate,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_current_workspace),
    user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    _require_admin(db, workspace, user)

    row = (
        db.query(WorkspaceEmailSettings)
        .filter(WorkspaceEmailSettings.workspace_id == workspace.id)
        .first()
    )
    if row is None:
        if not payload.smtp_password:
            raise HTTPException(status_code=400, detail="An app password is required to connect a mailbox.")
        row = WorkspaceEmailSettings(workspace_id=workspace.id)
        db.add(row)

    row.from_address = payload.from_address
    row.from_name = payload.from_name
    row.reply_to = payload.reply_to
    row.smtp_host = payload.smtp_host
    row.smtp_port = payload.smtp_port
    row.smtp_username = payload.smtp_username or payload.from_address
    row.smtp_use_tls = payload.smtp_use_tls
    row.daily_send_limit = payload.daily_send_limit

    # An omitted password means "keep the existing one" — the form never
    # receives the stored value back, so it cannot echo it.
    if payload.smtp_password:
        row.smtp_password_encrypted = encrypt_secret(payload.smtp_password, settings)
        row.verified_at = None

    db.commit()
    db.refresh(row)
    return _settings_out(row)


@router.delete("/email-settings", status_code=status.HTTP_204_NO_CONTENT)
def disconnect_email(
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_current_workspace),
    user: User = Depends(get_current_user),
):
    _require_admin(db, workspace, user)
    row = (
        db.query(WorkspaceEmailSettings)
        .filter(WorkspaceEmailSettings.workspace_id == workspace.id)
        .first()
    )
    if row is not None:
        db.delete(row)
        db.commit()


@router.post("/email-settings/test")
def test_email_settings(
    payload: EmailTestRequest,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_current_workspace),
    settings: Settings = Depends(get_settings),
):
    """Send one real message, so delivery is proven before any campaign runs."""
    row = (
        db.query(WorkspaceEmailSettings)
        .filter(WorkspaceEmailSettings.workspace_id == workspace.id)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=400, detail="Connect a mailbox first.")

    provider = get_workspace_email_provider(db, workspace.id, settings)
    if not provider.verify_email(payload.to):
        raise HTTPException(status_code=400, detail=f"{payload.to} is not a valid email address.")

    try:
        provider.send(
            to=payload.to,
            subject="LeadForge test message",
            body=(
                f"This is a test message from the {workspace.name} workspace.\n\n"
                "If you are reading this, your outreach mailbox is connected correctly.\n"
            ),
            reply_to=row.reply_to,
        )
    except ProviderError as exc:
        raise HTTPException(status_code=502, detail=exc.message) from exc

    row.verified_at = datetime.now(timezone.utc).isoformat()
    db.commit()
    return {"ok": True, "message": f"Sent. Check the inbox for {payload.to}."}
