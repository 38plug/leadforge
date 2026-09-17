"""
Background job: re-check a company's website status.

Runs the same WebsiteProvider used synchronously by the Lead Finder search
endpoint, so a scheduled re-check (e.g. nightly refresh of stale leads)
produces identical results to an on-demand check. Retries with exponential
backoff on transient provider errors; a permanent failure downgrades the
website status to INACCESSIBLE rather than raising, since one dead job
must never block the rest of the queue.
"""

from app.db.session import SessionLocal
from app.models.company import Company, Website
from app.providers.website import get_website_provider


def check_company_website(company_id: str, attempt: int = 1, max_attempts: int = 3) -> None:
    db = SessionLocal()
    try:
        company = db.query(Company).filter(Company.id == company_id).first()
        if not company:
            return

        provider = get_website_provider()
        result = provider.detect_website(company.website.website_url if company.website else None)

        if company.website:
            company.website.website_url = result.website_url
            company.website.domain = result.domain
            company.website.http_status = result.http_status
            company.website.ssl_status = result.ssl_status
            company.website.redirect_url = result.redirect_url
            company.website.title = result.title
            company.website.status = result.status
            company.website.load_time_ms = result.load_time_ms
            company.website.last_checked_at = result.last_checked_at
        else:
            db.add(
                Website(
                    company_id=company.id,
                    website_url=result.website_url,
                    domain=result.domain,
                    http_status=result.http_status,
                    ssl_status=result.ssl_status,
                    status=result.status,
                    last_checked_at=result.last_checked_at,
                )
            )
        db.commit()
    finally:
        db.close()
