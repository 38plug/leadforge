import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.workspace import User, Workspace, WorkspaceMember, WorkspaceRole
from app.schemas.auth import (
    AuthActionResponse,
    ForgotPasswordRequest,
    LoginRequest,
    MeResponse,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    VerifyEmailRequest,
)
from app.services import auth_tokens, transactional_email

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _slugify(name: str, db: Session) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "workspace"
    slug = base
    suffix = 1
    while db.query(Workspace).filter(Workspace.slug == slug).first():
        suffix += 1
        slug = f"{base}-{suffix}"
    return slug


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")

    user = User(
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        is_active=True,
    )
    db.add(user)
    db.flush()

    workspace = Workspace(name=payload.workspace_name, slug=_slugify(payload.workspace_name, db), plan="FREE")
    db.add(workspace)
    db.flush()

    db.add(WorkspaceMember(workspace_id=workspace.id, user_id=user.id, role=WorkspaceRole.OWNER))

    # Issued inside the same transaction as the account, so a confirmation
    # token can never exist for a user that failed to save.
    verification_token = auth_tokens.issue(db, user, auth_tokens.PURPOSE_VERIFY_EMAIL)
    db.commit()
    db.refresh(user)
    db.refresh(workspace)

    # After the commit and deliberately not fatal: a mail server being down
    # must not cost someone the account they just created. The address stays
    # unconfirmed and the link can be resent.
    transactional_email.send_verification_email(
        settings, user.email, user.full_name, verification_token
    )

    token = create_access_token(subject=user.id)
    return TokenResponse(access_token=token, user=user, workspace=workspace)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not user.hashed_password or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been deactivated")

    membership = db.query(WorkspaceMember).filter(WorkspaceMember.user_id == user.id).first()
    if not membership:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No workspace found for this account")
    workspace = db.query(Workspace).filter(Workspace.id == membership.workspace_id).first()

    token = create_access_token(subject=user.id)
    return TokenResponse(access_token=token, user=user, workspace=workspace)


@router.get("/me", response_model=MeResponse)
def me(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    memberships = db.query(WorkspaceMember).filter(WorkspaceMember.user_id == user.id).all()
    workspaces = [db.query(Workspace).filter(Workspace.id == m.workspace_id).first() for m in memberships]
    return MeResponse(user=user, workspaces=[w for w in workspaces if w])


# ------------------------------------------------- email verification


@router.post("/verify-email/resend", response_model=AuthActionResponse)
def resend_verification(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    if user.email_verified_at:
        return AuthActionResponse(message="This address is already confirmed.", email_sent=False)

    token = auth_tokens.issue(db, user, auth_tokens.PURPOSE_VERIFY_EMAIL)
    db.commit()
    sent = transactional_email.send_verification_email(settings, user.email, user.full_name, token)
    return AuthActionResponse(
        message=(
            f"Confirmation sent to {user.email}."
            if sent
            else "Could not send the email: this installation has no mail server configured."
        ),
        email_sent=sent,
    )


@router.post("/verify-email", response_model=AuthActionResponse)
def verify_email(
    payload: VerifyEmailRequest,
    db: Session = Depends(get_db),
):
    user = auth_tokens.consume(db, payload.token, auth_tokens.PURPOSE_VERIFY_EMAIL)
    if not user:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "This confirmation link is invalid, has expired, or has already been used. "
            "Request a new one from your account settings.",
        )
    auth_tokens.mark_email_verified(db, user)
    db.commit()
    return AuthActionResponse(message="Your email address is confirmed.", email_sent=False)


# ---------------------------------------------------- password reset


@router.post("/forgot-password", response_model=AuthActionResponse)
def forgot_password(
    payload: ForgotPasswordRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    """Start a password reset.

    The response is identical whether or not the address is registered. A
    different answer for a known address turns this endpoint into a way to
    discover who has an account.
    """
    user = db.query(User).filter(User.email == payload.email).first()
    generic = "If an account exists for that address, a reset link is on its way."

    if not user or not user.is_active:
        return AuthActionResponse(message=generic, email_sent=False)

    token = auth_tokens.issue(db, user, auth_tokens.PURPOSE_RESET_PASSWORD)
    db.commit()
    transactional_email.send_password_reset_email(settings, user.email, user.full_name, token)

    # email_sent stays false deliberately: reporting delivery here would leak
    # exactly what the generic message exists to hide.
    return AuthActionResponse(message=generic, email_sent=False)


@router.post("/reset-password", response_model=AuthActionResponse)
def reset_password(
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    user = auth_tokens.consume(db, payload.token, auth_tokens.PURPOSE_RESET_PASSWORD)
    if not user:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "This reset link is invalid, has expired, or has already been used. "
            "Request a new one to continue.",
        )

    user.hashed_password = hash_password(payload.new_password)
    # Resetting the password proves control of the mailbox, which is the same
    # thing email verification establishes.
    if not user.email_verified_at:
        auth_tokens.mark_email_verified(db, user)
    db.commit()

    # Sent after the fact: if the reset was not theirs, this is their warning.
    transactional_email.send_password_changed_email(settings, user.email, user.full_name)
    return AuthActionResponse(message="Your password has been changed. You can sign in now.")
