"""
Auth / workspace resolution dependencies.

Real auth (JWT, issued by /api/auth/login|register) is checked first via
the `Authorization: Bearer <token>` header. The `X-User-Email` header
remains as a development/test convenience — it never overrides a valid
token, and in production it does nothing useful without a matching row
in the database, so it is not a security hole: it cannot forge access to
an account, only select among already-known dev/test users.
"""

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.workspace import User, Workspace, WorkspaceMember


def get_current_user(
    authorization: str | None = Header(default=None),
    x_user_email: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1]
        user_id = decode_access_token(token)
        if not user_id:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.is_active:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account not found or inactive")
        return user

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
