import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.workspace import User, Workspace, WorkspaceMember, WorkspaceRole
from app.schemas.auth import LoginRequest, MeResponse, RegisterRequest, TokenResponse

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
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
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
    db.commit()
    db.refresh(user)
    db.refresh(workspace)

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
