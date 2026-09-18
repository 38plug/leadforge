"""
Platform administration.

Everything here crosses workspace boundaries, so every endpoint is guarded by
`require_superuser` - enforced on the server, never by hiding a menu. A UI that
simply doesn't show a button is not access control: the endpoint is still one
HTTP request away.

Two rules shape the destructive operations:

  * An administrator cannot revoke their own access or delete their own
    account here. Locking every administrator out of an installation is not
    recoverable through the product, and self-service deletion lives on
    /api/account where it belongs.
  * Deleting an account deletes the workspaces it solely owns, because leaving
    a workspace no one can reach is worse than removing it. Workspaces with
    other members are left alone and the membership is dropped.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.company import Company
from app.models.lead import Lead
from app.models.misc import Coupon, Subscription
from app.models.workspace import User, Workspace, WorkspaceMember, WorkspaceRole
from app.schemas.admin import (
    AdminCouponCreate,
    AdminCouponOut,
    AdminOverview,
    AdminUserOut,
    AdminUserUpdate,
    AdminWorkspaceOut,
    AdminWorkspaceUpdate,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])

VALID_PLANS = {"FREE", "STARTER", "PRO", "AGENCY", "BUSINESS"}


def require_superuser(user: User = Depends(get_current_user)) -> User:
    """Refuse anyone who is not a platform administrator.

    404 rather than 403 would hide the existence of this API, but the routes
    are in the public OpenAPI schema anyway, so a plain 403 is more honest and
    easier to debug.
    """
    if not user.is_superuser:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Platform administrator access required")
    return user


# --------------------------------------------------------------- overview


@router.get("/overview", response_model=AdminOverview)
def overview(db: Session = Depends(get_db), _: User = Depends(require_superuser)):
    """Counts across the whole installation, read live."""
    paying = (
        db.query(func.count(Subscription.id))
        .filter(Subscription.provider.isnot(None), Subscription.status == "ACTIVE")
        .scalar()
        or 0
    )
    return AdminOverview(
        total_users=db.query(func.count(User.id)).scalar() or 0,
        active_users=db.query(func.count(User.id)).filter(User.is_active.is_(True)).scalar() or 0,
        total_workspaces=db.query(func.count(Workspace.id)).scalar() or 0,
        total_leads=db.query(func.count(Lead.id)).scalar() or 0,
        total_companies=db.query(func.count(Company.id)).scalar() or 0,
        active_coupons=db.query(func.count(Coupon.id)).filter(Coupon.is_active.is_(True)).scalar() or 0,
        # Zero until a payment processor is connected. Reported rather than
        # hidden, so the admin screen can say why instead of showing a blank.
        paying_subscriptions=paying,
        payment_provider_connected=paying > 0,
    )


# ------------------------------------------------------------------ users


@router.get("/users", response_model=list[AdminUserOut])
def list_users(db: Session = Depends(get_db), _: User = Depends(require_superuser)):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [_user_out(db, user) for user in users]


@router.patch("/users/{user_id}", response_model=AdminUserOut)
def update_user(
    user_id: str,
    payload: AdminUserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_superuser),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Account not found")

    if user.id == admin.id and (payload.is_superuser is False or payload.is_active is False):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "You cannot remove your own administrator access or deactivate yourself. "
            "Ask another administrator to do it.",
        )

    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.is_superuser is not None:
        user.is_superuser = payload.is_superuser
    if payload.full_name is not None:
        user.full_name = payload.full_name

    db.commit()
    db.refresh(user)
    return _user_out(db, user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_superuser),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Account not found")
    if user.id == admin.id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Use account deletion in Settings to remove your own account.",
        )

    _delete_user_and_owned_workspaces(db, user)
    db.commit()


# ------------------------------------------------------------- workspaces


@router.get("/workspaces", response_model=list[AdminWorkspaceOut])
def list_workspaces(db: Session = Depends(get_db), _: User = Depends(require_superuser)):
    workspaces = db.query(Workspace).order_by(Workspace.created_at.desc()).all()
    return [_workspace_out(db, workspace) for workspace in workspaces]


@router.patch("/workspaces/{workspace_id}", response_model=AdminWorkspaceOut)
def update_workspace(
    workspace_id: str,
    payload: AdminWorkspaceUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Workspace not found")

    if payload.plan is not None:
        if payload.plan not in VALID_PLANS:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Unknown plan '{payload.plan}'. Valid plans: {', '.join(sorted(VALID_PLANS))}.",
            )
        # Changing a plan here grants access; it does not charge anyone, since
        # no payment processor is connected. That is the intended behaviour for
        # comped and partnership accounts.
        workspace.plan = payload.plan

    db.commit()
    db.refresh(workspace)
    return _workspace_out(db, workspace)


# ---------------------------------------------------------------- coupons


@router.get("/coupons", response_model=list[AdminCouponOut])
def list_coupons(db: Session = Depends(get_db), _: User = Depends(require_superuser)):
    return db.query(Coupon).order_by(Coupon.created_at.desc()).all()


@router.post("/coupons", response_model=AdminCouponOut, status_code=status.HTTP_201_CREATED)
def create_coupon(
    payload: AdminCouponCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_superuser),
):
    code = payload.code.strip().upper()
    if db.query(Coupon).filter(Coupon.code == code).first():
        raise HTTPException(status.HTTP_409_CONFLICT, f"Coupon '{code}' already exists")

    coupon = Coupon(
        code=code,
        description=payload.description,
        percent_off=payload.percent_off,
        amount_off_cents=payload.amount_off_cents,
        max_redemptions=payload.max_redemptions,
        expires_at=payload.expires_at,
        created_by_user_id=admin.id,
    )
    db.add(coupon)
    db.commit()
    db.refresh(coupon)
    return coupon


@router.delete("/coupons/{coupon_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_coupon(
    coupon_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
):
    """Deactivate rather than delete, so an issued code keeps its history."""
    coupon = db.query(Coupon).filter(Coupon.id == coupon_id).first()
    if not coupon:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Coupon not found")
    coupon.is_active = False
    db.commit()


# ---------------------------------------------------------------- helpers


def _user_out(db: Session, user: User) -> AdminUserOut:
    memberships = (
        db.query(WorkspaceMember, Workspace)
        .join(Workspace, Workspace.id == WorkspaceMember.workspace_id)
        .filter(WorkspaceMember.user_id == user.id)
        .all()
    )
    return AdminUserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        is_active=user.is_active,
        is_superuser=user.is_superuser,
        created_at=user.created_at,
        workspaces=[
            {"id": workspace.id, "name": workspace.name, "plan": workspace.plan, "role": member.role.value}
            for member, workspace in memberships
        ],
    )


def _workspace_out(db: Session, workspace: Workspace) -> AdminWorkspaceOut:
    subscription = db.query(Subscription).filter(Subscription.workspace_id == workspace.id).first()
    return AdminWorkspaceOut(
        id=workspace.id,
        name=workspace.name,
        slug=workspace.slug,
        plan=workspace.plan,
        created_at=workspace.created_at,
        member_count=db.query(func.count(WorkspaceMember.id))
        .filter(WorkspaceMember.workspace_id == workspace.id)
        .scalar()
        or 0,
        lead_count=db.query(func.count(Lead.id)).filter(Lead.workspace_id == workspace.id).scalar() or 0,
        subscription_status=subscription.status if subscription else None,
        payment_provider=subscription.provider if subscription else None,
    )


def _delete_user_and_owned_workspaces(db: Session, user: User) -> None:
    """Remove an account, and any workspace that would be left unreachable.

    Shared here and by self-service deletion so both paths behave identically.
    """
    memberships = db.query(WorkspaceMember).filter(WorkspaceMember.user_id == user.id).all()

    for membership in memberships:
        others = (
            db.query(func.count(WorkspaceMember.id))
            .filter(
                WorkspaceMember.workspace_id == membership.workspace_id,
                WorkspaceMember.user_id != user.id,
            )
            .scalar()
            or 0
        )
        db.delete(membership)
        if others == 0 and membership.role == WorkspaceRole.OWNER:
            workspace = db.query(Workspace).filter(Workspace.id == membership.workspace_id).first()
            if workspace:
                # Cascades to the workspace's members; leads and companies are
                # removed explicitly because they are not cascade-configured.
                db.query(Lead).filter(Lead.workspace_id == workspace.id).delete(synchronize_session=False)
                db.query(Company).filter(Company.workspace_id == workspace.id).delete(
                    synchronize_session=False
                )
                db.delete(workspace)

    db.delete(user)


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
