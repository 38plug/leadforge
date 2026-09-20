"""
Auth / workspace resolution dependencies.

Authentication is a JWT issued by /api/auth/login|register and presented as
either:
  - An httpOnly cookie named `lf_token` (preferred, XSS-safe), or
  - `Authorization: Bearer <token>` header (for API clients / backward compat)

`X-User-Email` selects a user without a password and exists only so local
development and tests can act as a known account. It is refused outright in
production. It was previously allowed there on the reasoning that it "does
nothing useful without a matching row in the database" - which was wrong:
every real customer has a matching row, and their email address is not a
secret. Anyone who could guess one had full read and write access to that
workspace.
"""

from fastapi import Cookie, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.workspace import User, Workspace, WorkspaceMember


def _extract_token(
    authorization: str | None,
    lf_token: str | None,
) -> str | None:
    """Pull the JWT from the Authorization header first, then the cookie.

    When both are present the header wins so that API clients sending an
    explicit ``Authorization`` header are never silently downgraded to a
    stale cookie that a TestClient (or a real browser) kept from an earlier
    request.
    """
    if authorization and authorization.lower().startswith("bearer "):
        return authorization.split(" ", 1)[1]
    if lf_token:
        return lf_token
    return None


def get_current_user(
    request: Request,
    authorization: str | None = Header(default=None),
    lf_token: str | None = Cookie(default=None),
    x_user_email: str | None = Header(default=None),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> User:
    token = _extract_token(authorization, lf_token)
    if token:
        user_id = decode_access_token(token)
        if not user_id:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.is_active:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account not found or inactive")
        return user

    # Everything below identifies a user without proving who they are, so it
    # is confined to development. In production the only way in is a token.
    if settings.environment.lower() == "production":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentication required")

    email = x_user_email or "demo@leadforge.dev"
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unknown user")
    return user


def get_current_workspace(
    x_workspace_id: str | None = Header(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Workspace:
    query = db.query(Workspace).join(WorkspaceMember).filter(WorkspaceMember.user_id == user.id)
    workspace = query.filter(Workspace.id == x_workspace_id).first() if x_workspace_id else query.first()
    if not workspace:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No accessible workspace")
    return workspace
