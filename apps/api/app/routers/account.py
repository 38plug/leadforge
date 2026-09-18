"""
Self-service account management.

Separate from /api/admin: these act on the caller's own account and need no
special privilege, only proof that the person asking is the account holder.
Both operations re-check the password, because a session left open on a shared
machine should not be enough to change credentials or destroy data.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.security import hash_password, verify_password
from app.db.session import get_db
from app.models.workspace import User
from app.routers.admin import _delete_user_and_owned_workspaces
from app.schemas.admin import ChangePasswordRequest, DeleteAccountRequest

router = APIRouter(prefix="/api/account", tags=["account"])


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not user.hashed_password or not verify_password(payload.current_password, user.hashed_password):
        # Deliberately vague: confirming which half was wrong would help
        # someone probing an account they have a session for.
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect")

    if payload.new_password == payload.current_password:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The new password must be different")

    user.hashed_password = hash_password(payload.new_password)
    db.commit()

    # Existing tokens stay valid: they are signed with the application secret
    # rather than derived from the password, and this codebase has no token
    # revocation list. Worth knowing before relying on a password change to
    # end someone else's session.


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    payload: DeleteAccountRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete the caller's account, and any workspace it solely owns.

    A workspace with other members survives and simply loses this member -
    removing other people's data because one owner left would be the wrong
    call. Everything else goes, and none of it comes back.
    """
    if not user.hashed_password or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Password is incorrect")

    if user.is_superuser:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Platform administrators cannot delete their own account. Have another "
            "administrator remove the access first.",
        )

    _delete_user_and_owned_workspaces(db, user)
    db.commit()
