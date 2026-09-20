from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


# Render mounts Secret Files here under whatever name they were given, and the
# name is not something the application should have to know in advance. Every
# file in the directory is treated as an env file, so adding a secret file is
# all a deployment has to do.
RENDER_SECRETS_DIR = Path("/etc/secrets")


def _secret_env_files() -> tuple[str, ...]:
    """Every readable secret file Render has mounted, oldest name first."""
    try:
        entries = sorted(RENDER_SECRETS_DIR.iterdir())
    except OSError:
        # The directory only exists on Render; locally there is nothing to read.
        return ()

    return tuple(
        str(entry)
        for entry in entries
        # Kubernetes atomically swaps mounted secrets using "..data" and
        # "..<timestamp>" helper entries; only the real files are config.
        if entry.is_file() and not entry.name.startswith("..")
    )


class Settings(BaseSettings):
    """
    Central application configuration.

    Every external integration is optional: when its API key env var is
    absent, the corresponding provider factory (see app/providers) falls
    back to a mock implementation so the app always runs locally.
    """

    # "/etc/secrets/.env" is where Render mounts a Secret File, which is the
    # one location it guarantees regardless of the service's root directory.
    # Listing it last means it wins over a local .env, so a deployed secret is
    # never shadowed by a file that happened to ship in the image. Both are
    # optional: a missing env file is not an error.
    # A local .env first for development, then anything mounted as a Render
    # Secret File. Later entries win, so a deployed secret is never shadowed by
    # a file that happened to ship in the image. All of them are optional.
    model_config = SettingsConfigDict(
        env_file=(".env", *_secret_env_files()),
        extra="ignore",
    )

    app_name: str = "LeadForge API"
    environment: str = "development"
    debug: bool = True

    # Defaults to a local SQLite file so the API runs with zero setup.
    # Point this at a managed Postgres instance in staging/production, e.g.
    # postgresql+psycopg2://user:password@host:5432/leadforge
    database_url: str = "sqlite:///./leadforge.db"

    redis_url: str = "redis://localhost:6379/0"

    # Auth (Supabase Auth or any OIDC-compatible provider)
    auth_provider: str = "mock"
    supabase_url: str | None = None
    supabase_anon_key: str | None = None
    jwt_secret: str = "dev-secret-change-me"
    # Fernet key encrypting per-workspace credentials (SMTP passwords) at
    # rest. Required in production; derived from jwt_secret otherwise.
    secret_encryption_key: str | None = None

    # Business search: defaults to the free OpenStreetMap provider (no API
    # key, no signup, no cost) — set BUSINESS_PROVIDER=mock to go fully
    # offline, or to a paid provider name once one is implemented and its
    # API key is set.
    #
    # Supported values:
    #   osm        — Overpass + Nominatim (default, free, no key)
    #   overpass   — Overpass only
    #   nominatim  — Nominatim only
    #   photon     — Photon geocoder + Overpass (free, no key)
    #   wikidata   — Wikidata SPARQL business discovery (free, no key)
    #   opencage   — OpenCage geocoding + Overpass (free key, 2500 req/day)
    #   reefapi    — ReefAPI Google Maps (free: 1,000 credits, provides ratings)
    #   multi      — Chains all free sources: OSM → Photon → Wikidata → OpenCage
    #   mock       — Deterministic fake data (refused in production)
    business_provider: str = "osm"
    business_provider_api_key: str | None = None
    # Optional contact (email or project URL) included in the User-Agent
    # sent to OpenStreetMap's Nominatim service, per its usage policy. Not
    # required, but recommended if you start running many searches.
    osm_contact: str | None = None
    # OpenCage API key (free tier: 2,500 req/day, no credit card).
    # Only needed when BUSINESS_PROVIDER=opencage or multi.
    # Sign up at https://opencagedata.com/api
    opencage_api_key: str | None = None
    # ReefAPI key (free tier: 1,000 credits, provides Google Maps ratings).
    # Only needed when BUSINESS_PROVIDER=reefapi.
    # Sign up at https://reefapi.com (no credit card required).
    reefapi_key: str | None = None

    # Social profiles are read from the business record itself (OpenStreetMap
    # carries real, public contact:instagram / contact:facebook tags). There is
    # no separate social provider: no free API exposes public business profile
    # discovery, and guessing handles from a company name produces links that
    # are wrong more often than right.

    # AI provider. Supported: "groq" and "gemini" (both have a free tier),
    # "anthropic", "openai", "openrouter", "openai_compatible" (needs
    # AI_PROVIDER_BASE_URL), "rules", or "auto".
    #
    # "auto" means Anthropic when a key is present and a deterministic
    # rule-based fallback when it is not. The fallback never invents facts
    # about a business — it only restates that lead's stored attributes.
    ai_provider: str = "auto"
    ai_provider_api_key: str | None = None
    ai_provider_base_url: str | None = None
    ai_model: str = "claude-sonnet-5"

    # Email provider. "auto" sends over SMTP once SMTP_HOST/SMTP_USERNAME/
    # SMTP_PASSWORD are set (any provider works — Gmail, Zoho, Fastmail,
    # a VPS), otherwise tries Resend if SMTP_PASSWORD starts with "re_",
    # and finally falls back to recording outbound mail without sending it.
    email_provider: str = "auto"
    email_from_address: str = "outreach@leadforge.dev"
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_use_tls: bool = True
    mailjet_api_key: str | None = None
    mailjet_secret_key: str | None = None

    # Browsers block a cross-origin call unless the API names the calling
    # origin here, so the deployed frontend's own domains are defaults rather
    # than something a deployment has to remember to set. CORS_ORIGINS
    # overrides this entirely — set it to just your domain(s) if you want the
    # local development origin closed off in production.
    # --- Billing (Stripe) --------------------------------------------
    # A restricted key (rk_) is preferred over a secret key: it can be scoped
    # to just the Billing and Checkout permissions this integration needs, so
    # a leak cannot move money or read the whole account.
    stripe_secret_key: str | None = None
    # Signing secret for the webhook endpoint. Without it every webhook is
    # rejected, which is correct - an unverified webhook is an unauthenticated
    # stranger telling you someone paid.
    stripe_webhook_secret: str | None = None

    # Stripe Price IDs, one per paid plan. Prices live in Stripe rather than
    # here so amounts, currencies and intervals can change without a deploy.
    stripe_price_starter: str | None = None
    stripe_price_pro: str | None = None
    stripe_price_agency: str | None = None

    # One-off pack of lead unlocks, for someone who needs more this week but
    # does not want a monthly bill. A one-time price, not a recurring one.
    stripe_price_credit_pack: str | None = None
    # How many unlocks that price grants. Kept here rather than read from the
    # Stripe product so the amount granted is decided by this application,
    # which is what the webhook must be able to trust.
    credit_pack_size: int = 50

    # --- Abuse ---------------------------------------------------------
    # How many accounts one origin may create inside the window. The free
    # plan's weekly allowance is what this protects: the cheapest way to get
    # more of it is to make more accounts.
    #
    # One, by the product owner's decision. The cost of that is real and worth
    # knowing: an office, a coworking space and every mobile carrier behind
    # CGNAT put many genuine people on one address, and the second of them to
    # sign up is refused. They are told to contact support, and raising this
    # value is how support fixes it. Set 0 to disable the limit entirely.
    max_accounts_per_ip: int = 1
    # Rolling window, in hours. 0 means no window at all: every account the
    # origin has ever opened is counted, so the limit above is for all time
    # rather than per week. That is the configured rule - one network, one
    # account, ever.
    #
    # It never expires, so it only gets stricter as the table grows: an
    # address reassigned by an ISP to a new customer carries the old one's
    # signup with it, and that person cannot register at all. Support raising
    # MAX_ACCOUNTS_PER_IP is the only way past it.
    accounts_per_ip_window_hours: int = 0
    # How many proxies sit in front of this application. Render puts exactly
    # one there. The signup guard counts X-Forwarded-For entries from the
    # right by this many, so a caller cannot choose their own apparent
    # address by sending the header themselves. Raise it only if you add
    # another proxy (a CDN in front of Render, say) - too high reads a value
    # the caller controls, too low reads the proxy and groups everyone
    # together.
    trusted_proxy_hops: int = 1

    cors_origins: list[str] = [
        "http://localhost:3000",
        "https://leadforge-wheat-seven.vercel.app",
        "https://leadforge-leadforge3.vercel.app",
    ]

    @field_validator("database_url")
    @classmethod
    def _normalise_database_url(cls, value: str) -> str:
        """Accept the `postgres://` URLs several hosts hand out.

        Heroku, Render and others print connection strings beginning with
        `postgres://`, but SQLAlchemy only registers the `postgresql://`
        scheme and raises on the shorter one. Pasting the string a provider
        gives you is the obvious thing to do, so it is normalised here rather
        than left as a deployment-time surprise.
        """
        if value.startswith("postgres://"):
            return "postgresql://" + value[len("postgres://"):]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
