"""
Deleting a workspace, and deleting an account.

Fifteen tables point at a workspace and eleven at a user. None of that is
visible from `db.delete(workspace)`, which is why the original version of this
worked in tests and raised an IntegrityError for any account that had actually
used the product - an analysed lead, a verification token, a bought pack. The
tests passed because SQLite ignored foreign keys; production is Postgres and
does not.

The rule applied here, table by table:

  * Rows that only exist to describe the workspace go with it.
  * Rows that record something a person did, where the row is still meaningful
    without them, keep the row and lose the name. A lead unlock is usage that
    was paid for; it survives its lead and it survives the colleague who
    clicked it. A coupon someone issued does not stop existing because they
    left.

Both routes - platform admin deleting an account, and someone deleting their
own - come through here, so they cannot drift apart.
"""

import logging

from sqlalchemy.orm import Session

from app.models.campaign import Campaign, CampaignRecipient, EmailTemplate, SuppressionEntry
from app.models.lead import Lead, LeadActivity, Note, Task
from app.models.misc import (
    CreditPurchase,
    DataProviderConfig,
    Notification,
    Subscription,
    UsageRecord,
)
from app.models.misc import AuthToken, LeadReveal
from app.models.search import SavedSearch, SearchHistory
from app.models.workspace import User, Workspace, WorkspaceEmailSettings, WorkspaceMember
from app.services import lead_deletion

logger = logging.getLogger("leadforge.accounts")


def delete_workspace(db: Session, workspace: Workspace) -> None:
    """Remove a workspace and everything that belongs to it.

    Leads go through the lead deletion service, so unlocks keep behaving the
    way they do everywhere else: the usage record survives with its lead_id
    emptied, and deleting a workspace is not a way to reclaim an allowance.
    """
    workspace_id = workspace.id

    lead_ids = [row[0] for row in db.query(Lead.id).filter(Lead.workspace_id == workspace_id).all()]
    lead_deletion.delete_leads(db, workspace_id, lead_ids)

    # Campaign recipients hang off campaigns, which hang off the workspace.
    campaign_ids = [
        row[0] for row in db.query(Campaign.id).filter(Campaign.workspace_id == workspace_id).all()
    ]
    if campaign_ids:
        db.query(CampaignRecipient).filter(
            CampaignRecipient.campaign_id.in_(campaign_ids)
        ).delete(synchronize_session=False)

    # Everything else keyed directly on the workspace. Listed explicitly rather
    # than discovered, so adding a table is a deliberate decision about whether
    # it should survive a deletion - not something that silently starts
    # blocking every delete the day it ships.
    for model in (
        Campaign,
        EmailTemplate,
        SuppressionEntry,
        CreditPurchase,
        LeadReveal,
        Subscription,
        UsageRecord,
        DataProviderConfig,
        Notification,
        SavedSearch,
        SearchHistory,
        WorkspaceEmailSettings,
        WorkspaceMember,
    ):
        db.query(model).filter(model.workspace_id == workspace_id).delete(synchronize_session=False)

    db.query(Workspace).filter(Workspace.id == workspace_id).delete(synchronize_session=False)
    logger.info("Deleted workspace %s and everything belonging to it", workspace_id)


def delete_user(db: Session, user: User) -> None:
    """Remove an account, and any workspace it would leave unreachable.

    A workspace with other members survives; only the membership goes. A
    workspace the account solely owned has nobody left who could reach it, so
    it is removed rather than stranded.
    """
    user_id = user.id

    for membership in db.query(WorkspaceMember).filter(WorkspaceMember.user_id == user_id).all():
        others = (
            db.query(WorkspaceMember)
            .filter(
                WorkspaceMember.workspace_id == membership.workspace_id,
                WorkspaceMember.user_id != user_id,
            )
            .count()
        )
        if others:
            db.delete(membership)
            continue
        workspace = (
            db.query(Workspace).filter(Workspace.id == membership.workspace_id).first()
        )
        if workspace:
            delete_workspace(db, workspace)
        else:
            db.delete(membership)

    db.flush()

    # Tokens exist only to let this person prove something about themselves.
    db.query(AuthToken).filter(AuthToken.user_id == user_id).delete(synchronize_session=False)

    # References that name the person on a record which still means something
    # without them. Emptied rather than deleted: a coupon that was issued was
    # still issued, and an unlock was still paid for.
    for model, column in (
        (LeadReveal, LeadReveal.user_id),
        (CreditPurchase, CreditPurchase.purchased_by_user_id),
        (Notification, Notification.user_id),
        (SearchHistory, SearchHistory.user_id),
        (Lead, Lead.owner_id),
        (LeadActivity, LeadActivity.actor_id),
        (Note, Note.author_id),
        (Task, Task.assignee_id),
    ):
        db.query(model).filter(column == user_id).update(
            {column: None}, synchronize_session=False
        )

    from app.models.misc import Coupon

    db.query(Coupon).filter(Coupon.created_by_user_id == user_id).update(
        {Coupon.created_by_user_id: None}, synchronize_session=False
    )

    db.query(User).filter(User.id == user_id).delete(synchronize_session=False)
    logger.info("Deleted account %s", user_id)
