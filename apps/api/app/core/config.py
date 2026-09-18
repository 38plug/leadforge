from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Central application configuration.

    Every external integration is optional: when its API key env var is
    absent, the corresponding provider factory (see app/providers) falls
    back to a mock implementation so the app always runs locally.
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

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
    business_provider: str = "osm"
    business_provider_api_key: str | None = None
    # Optional contact (email or project URL) included in the User-Agent
    # sent to OpenStreetMap's Nominatim service, per its usage policy. Not
    # required, but recommended if you start running many searches.
    osm_contact: str | None = None

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
    # a VPS), and otherwise records outbound mail without sending it.
    email_provider: str = "auto"
    email_from_address: str = "outreach@leadforge.dev"
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_use_tls: bool = True

    # Browsers block a cross-origin call unless the API names the calling
    # origin here, so the deployed frontend's own domains are defaults rather
    # than something a deployment has to remember to set. CORS_ORIGINS
    # overrides this entirely — set it to just your domain(s) if you want the
    # local development origin closed off in production.
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
