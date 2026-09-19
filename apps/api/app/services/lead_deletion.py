"""
Deleting leads, and everything that points at them.

Two things make this worth a module rather than a `db.delete(lead)` call.

**Not every reference cascades.** Activities, notes and tasks are cleaned up by
their relationships; AI analyses and campaign recipients are not, and hold
non-null foreign keys. Deleting a lead without clearing those raises an
IntegrityError on Postgres - which is what happened in production before this
existed, for any lead that had been analysed or mailed.

**An unlock is not one of those references.** A LeadReveal records that a lead
was paid for out of somebody's allowance, and throwing the lead away afterwards
does not un-spend it: the customer already read the contact details. Its
lead_id is therefore SET NULL by the database rather than cascaded, so usage
survives. Doing the opposite would make the limit trivially defeatable - open
a lead, copy the number, delete it, and it cost nothing.
"""

import logging

from sqlalchemy.orm import Session

from app.models.campaign import CampaignRecipient
from app.models.company import Company, Contact, SocialProfile, Website
from app.models.lead import Lead, LeadActivity, Note, Task
from app.models.misc import AIAnalysis

logger = logging.getLogger("leadforge.leads")


def delete_leads(db: Session, workspace_id: str, lead_ids: list[str]) -> int:
    """Delete these leads and their companies. Returns how many were deleted.

    Scoped to the workspace, so an id belonging to someone else matches
    nothing rather than deleting anything. The caller commits.
    """
    if not lead_ids:
        return 0

    # Re-read the ids through the workspace filter instead of trusting the
    # ones passed in. This is the whole of the tenant boundary for a bulk
    # delete: without it, a crafted request could name another workspace's
    # leads.
    owned = [
        row[0]
        for row in db.query(Lead.id)
        .filter(Lead.workspace_id == workspace_id, Lead.id.in_(lead_ids))
        .all()
    ]
    if not owned:
        return 0

    company_ids = [
        row[0]
        for row in db.query(Lead.company_id)
        .filter(Lead.workspace_id == workspace_id, Lead.id.in_(owned))
        .all()
    ]

    # Dependants first, in the order the foreign keys require.
    for model in (CampaignRecipient, AIAnalysis, LeadActivity, Note, Task):
        db.query(model).filter(model.lead_id.in_(owned)).delete(synchronize_session=False)

    db.query(Lead).filter(Lead.id.in_(owned)).delete(synchronize_session=False)

    # A company exists to carry a lead; with the lead gone it is unreferenced
    # data the user cannot see or reach. Deleted only when nothing else points
    # at it, because the same business can legitimately back a second lead.
    if company_ids:
        still_used = {
            row[0]
            for row in db.query(Lead.company_id).filter(Lead.company_id.in_(company_ids)).all()
        }
        orphaned = [cid for cid in company_ids if cid not in still_used]
        if orphaned:
            for model in (Contact, SocialProfile, Website):
                db.query(model).filter(model.company_id.in_(orphaned)).delete(
                    synchronize_session=False
                )
            db.query(Company).filter(Company.id.in_(orphaned)).delete(synchronize_session=False)

    logger.info("Deleted %d lead(s) from workspace %s", len(owned), workspace_id)
    return len(owned)
