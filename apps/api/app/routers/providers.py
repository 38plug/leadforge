"""Reports which providers are actually resolved at runtime.

The Data Sources page used to hard-code this list, which meant it could drift
from reality. Everything here is derived from the live settings object so the
page can never claim a capability the server does not have.

No secret is returned — only whether each one is present.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.deps import get_current_workspace

from app.db.session import get_db
from app.models.workspace import Workspace, WorkspaceEmailSettings
from app.providers.ai import LeadContext, get_ai_provider
from app.providers.email import smtp_is_configured
from app.providers.errors import ProviderError

router = APIRouter(prefix="/api/providers", tags=["providers"])


@router.get("")
def list_providers(
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    workspace: Workspace = Depends(get_current_workspace),
):
    ai_live = bool(settings.ai_provider_api_key) and settings.ai_provider.lower() != "rules"
    email_live = smtp_is_configured(settings) and settings.email_provider.lower() in ("auto", "smtp")
    business_live = settings.business_provider.lower() == "osm"

    # This workspace's own mailbox always takes precedence over the
    # server-wide fallback.
    mailbox = (
        db.query(WorkspaceEmailSettings)
        .filter(WorkspaceEmailSettings.workspace_id == workspace.id)
        .first()
    )
    workspace_mailbox = (
        f"{mailbox.from_address}" + ("" if mailbox.verified_at else " (untested)") if mailbox else None
    )

    return {
        "providers": [
            {
                "key": "business",
                "name": "Business Search",
                "description": "Discovers real businesses by country, city and niche.",
                "active": "OpenStreetMap — free, worldwide, no API key"
                if business_live
                else f"{settings.business_provider} (not a real data source)",
                "live": business_live,
                "env_var": "BUSINESS_PROVIDER",
                "note": "Real names, addresses, phone numbers, websites and social links contributed by "
                "OpenStreetMap mappers. No star ratings or review counts — OSM does not track them.",
            },
            {
                "key": "website",
                "name": "Website Detection",
                "description": "Checks whether each business has a working, modern website.",
                "active": "Built-in HTTP checker",
                "live": True,
                "env_var": "—",
                "note": "Fetches each site directly to classify it as missing, broken, outdated or modern.",
            },
            {
                "key": "social",
                "name": "Social Profiles",
                "description": "Public social links attached to a business.",
                "active": "OpenStreetMap tags",
                "live": business_live,
                "env_var": "—",
                "note": "Read from each business's own public contact:instagram / contact:facebook tags. "
                "LeadForge never guesses handles from a company name, and no free API offers public "
                "social profile discovery.",
            },
            {
                "key": "ai",
                "name": "AI Provider",
                "description": "Lead analysis, email drafting, call scripts and the assistant.",
                "active": f"{settings.ai_provider} — {settings.ai_model}"
                if ai_live
                else "Rule-based fallback (no API key set)",
                "live": ai_live,
                "env_var": "AI_PROVIDER_API_KEY",
                "note": "Without a key, analyses are generated from each lead's own stored attributes — "
                "accurate but not written by a model. Set AI_PROVIDER_API_KEY for real AI output.",
            },
            {
                "key": "email",
                "name": "Email Sending",
                "description": "Delivers outreach campaigns.",
                "active": workspace_mailbox or (
                    f"Server fallback: {settings.smtp_host}" if email_live else "No mailbox connected"
                ),
                "live": bool(workspace_mailbox) or email_live,
                "env_var": "Settings → Email",
                "note": "Each workspace connects its own mailbox in Settings → Email, so outreach is sent "
                "from your address and replies come back to you. Until one is connected, campaigns run "
                "end to end but no mail leaves the server.",
            },
        ]
    }


@router.post("/ai/test")
def test_ai_provider(
    settings: Settings = Depends(get_settings),
    workspace: Workspace = Depends(get_current_workspace),
):
    """Makes one small real call so a key can be verified before it's relied on."""
    if not settings.ai_provider_api_key:
        raise HTTPException(
            status_code=400,
            detail="No AI key is configured. Set AI_PROVIDER_API_KEY in apps/api/.env and restart the API.",
        )

    probe = LeadContext(
        company_name="Test Business",
        niche="Cafe",
        city="Lisbon",
        country="PT",
        rating=None,
        reviews_count=None,
        website_status="NO_WEBSITE",
        has_instagram=False,
        has_phone=True,
        has_email=False,
    )
    try:
        provider = get_ai_provider(settings)
        provider.generate_email(probe, tone="professional", goal="book_a_call")
    except ProviderError as exc:
        # exc.message is provider-authored text; it never contains the key.
        raise HTTPException(status_code=502, detail=exc.message) from exc

    # Report the model actually in use — a preset may override AI_MODEL.
    model = getattr(provider, "model", settings.ai_model)
    return {"ok": True, "message": f"Connected. Using {model}."}
