"""
Recompute every lead's Opportunity Score from data already stored.

The score is derived, never entered, so recomputing it is safe and is the only
way an existing lead reflects a change to the scoring rules. Without this,
leads saved before a change keep their old numbers and sit alongside new ones
on a different scale, which makes the whole column meaningless.

Nothing is fetched from the network: the website status, contacts and listing
details were captured when the lead was found.

    python scripts/rescore_leads.py            # show what would change
    python scripts/rescore_leads.py --apply    # write the new scores
"""

import argparse
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, joinedload

from app.models.company import Company
from app.models.lead import Lead
from app.services.lead_scoring import LeadScoreService, ScoringInput


def database_url() -> str:
    import os

    if os.environ.get("DATABASE_URL"):
        return os.environ["DATABASE_URL"]
    env_local = pathlib.Path(__file__).resolve().parents[3] / ".env.local"
    if env_local.exists():
        match = re.search(r"^DATABASE_URL=(.*)$", env_local.read_text(encoding="utf-8"), re.M)
        if match:
            return match.group(1).strip().strip('"').strip("'")
    sys.exit("No DATABASE_URL found.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Recompute Opportunity Scores.")
    parser.add_argument("--apply", action="store_true", help="Write the new scores")
    args = parser.parse_args()

    engine = create_engine(database_url(), pool_pre_ping=True)
    service = LeadScoreService()

    with Session(engine) as session:
        leads = (
            session.query(Lead)
            .options(
                joinedload(Lead.company).joinedload(Company.contacts),
                joinedload(Lead.company).joinedload(Company.social_profiles),
                joinedload(Lead.company).joinedload(Company.website),
            )
            .all()
        )

        changed = 0
        before: dict[int, int] = {}
        after: dict[int, int] = {}

        for lead in leads:
            company = lead.company
            contact = company.contacts[0] if company.contacts else None
            website = company.website

            result = service.score(
                ScoringInput(
                    website_status=website.status if website else None,
                    has_phone=bool(contact and contact.phone),
                    has_email=bool(contact and contact.email),
                    has_active_social=bool(company.social_profiles),
                    has_address=bool(company.address),
                    has_hours=bool(company.hours),
                )
            )

            before[lead.score] = before.get(lead.score, 0) + 1
            after[result.score] = after.get(result.score, 0) + 1

            if result.score != lead.score:
                changed += 1
                if args.apply:
                    lead.score = result.score
                    lead.score_breakdown = [
                        {"label": item.label, "points": item.points} for item in result.breakdown
                    ]
                    lead.score_recommendation = result.recommendation
                    lead.priority = result.priority

        print(f"{len(leads)} leads, {changed} would change\n")
        print("  score   before -> after")
        for score in sorted(set(before) | set(after), reverse=True):
            print(f"  {score:5}   {before.get(score, 0):6} -> {after.get(score, 0)}")

        if args.apply:
            session.commit()
            print("\nWritten.")
        else:
            print("\nDry run. Re-run with --apply to write them.")


if __name__ == "__main__":
    main()
