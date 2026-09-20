"""
CampaignService — compliant outreach sending.

Every send goes through here, never directly through an EmailProvider, so
suppression, duplicate-prevention, and daily sending limits are enforced
in exactly one place. See docs/compliance.md for the policy this encodes.
"""

from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.campaign import Campaign, CampaignRecipient, EmailTemplate, RecipientStatus, SuppressionEntry
from app.models.lead import Lead, LeadActivity
from app.providers.email import EmailProvider


@dataclass
class SendSummary:
    queued: int = 0
    skipped_suppressed: int = 0
    skipped_duplicate: int = 0
    sent: int = 0


class CampaignService:
    def __init__(self, db: Session, email_provider: EmailProvider):
        self.db = db
        self.email_provider = email_provider

    def _is_suppressed(self, workspace_id: str, email: str) -> bool:
        return (
            self.db.query(SuppressionEntry)
            .filter(SuppressionEntry.workspace_id == workspace_id, SuppressionEntry.email == email)
            .first()
            is not None
        )

    def _render(self, template: str, lead: Lead, contact_email: str) -> str:
        company = lead.company
        values = {
            "first_name": "there",
            "company_name": company.name,
            "industry": company.niche,
            "city": company.city,
            "country": company.country,
            "website": company.website.website_url if company.website and company.website.website_url else "",
            "instagram": next((s.handle for s in company.social_profiles if s.platform == "instagram"), ""),
            "rating": str(company.rating) if company.rating else "",
        }
        rendered = template
        for key, value in values.items():
            rendered = rendered.replace("{{" + key + "}}", value)
        return rendered

    def send_to_leads(self, campaign: Campaign, lead_ids: list[str], workspace_id: str) -> SendSummary:
        summary = SendSummary()

        already_sent_today = (
            self.db.query(func.count(CampaignRecipient.id))
            .filter(CampaignRecipient.campaign_id == campaign.id, CampaignRecipient.status == RecipientStatus.SENT)
            .scalar()
            or 0
        )
        remaining_budget = max(0, campaign.daily_send_limit - already_sent_today)

        template = (
            self.db.query(EmailTemplate).filter(EmailTemplate.id == campaign.template_id).first()
            if campaign.template_id
            else None
        )
        body_template = template.body if template else "Hi {{first_name}},\n\nJust following up — let us know if you'd like to chat.\n"

        leads = (
            self.db.query(Lead)
            .filter(Lead.id.in_(lead_ids), Lead.workspace_id == workspace_id)
            .all()
        )

        for lead in leads:
            contact = lead.company.contacts[0] if lead.company.contacts else None
            email = contact.email if contact else None
            if not email or not self.email_provider.verify_email(email):
                continue

            existing = (
                self.db.query(CampaignRecipient)
                .filter(CampaignRecipient.campaign_id == campaign.id, CampaignRecipient.lead_id == lead.id)
                .first()
            )
            if existing:
                summary.skipped_duplicate += 1
                continue

            if self._is_suppressed(workspace_id, email):
                self.db.add(
                    CampaignRecipient(
                        campaign_id=campaign.id,
                        lead_id=lead.id,
                        email=email,
                        status=RecipientStatus.SKIPPED_SUPPRESSED,
                    )
                )
                summary.skipped_suppressed += 1
                continue

            recipient = CampaignRecipient(campaign_id=campaign.id, lead_id=lead.id, email=email)
            self.db.add(recipient)
            summary.queued += 1

            if remaining_budget > 0:
                body = self._render(body_template, lead, email)
                subject = self._render(campaign.subject, lead, email)
                self.email_provider.send(to=email, subject=subject, body=body, reply_to=campaign.reply_to)
                recipient.status = RecipientStatus.SENT
                recipient.sent_at = datetime.now(timezone.utc).isoformat()
                remaining_budget -= 1
                summary.sent += 1
                self.db.add(LeadActivity(lead_id=lead.id, type="email", message=f"Outreach email sent via '{campaign.name}'"))

        self.db.commit()
        return summary

    def unsubscribe(self, workspace_id: str, email: str) -> None:
        if not self._is_suppressed(workspace_id, email):
            self.db.add(SuppressionEntry(workspace_id=workspace_id, email=email, reason="unsubscribed"))
        self.db.query(CampaignRecipient).join(Campaign).filter(
            Campaign.workspace_id == workspace_id,
            CampaignRecipient.email == email,
        ).update({"status": RecipientStatus.UNSUBSCRIBED})
        self.db.commit()
