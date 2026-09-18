import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.core.startup_checks import verify_production_safety
from app.db.session import Base, engine
from app.providers.errors import ProviderError
from app.routers import (
    account,
    admin,
    ai,
    analytics,
    auth,
    campaigns,
    companies,
    crm,
    leads,
    notifications,
    providers,
    search,
    workspace,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("leadforge")

settings = get_settings()

# Fail the deploy rather than serve a production API on development
# defaults — a forgeable signing key or a database that resets on restart
# is invisible from the outside until it is exploited or data is lost.
verify_production_safety(settings)

# Auto-creates tables for local dev convenience only (zero-setup SQLite).
# Staging/production run `alembic upgrade head` (see the Dockerfile CMD)
# before the app starts, which is the authoritative migration path.
if settings.environment == "development":
    Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.app_name,
    description="LeadForge API — AI-powered client acquisition platform for web designers and agencies.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ProviderError)
def provider_error_handler(request: Request, exc: ProviderError):
    logger.error("Provider error on %s: %s", request.url.path, exc.message)
    return JSONResponse(status_code=502, content=exc.to_dict())


@app.get("/", include_in_schema=False)
def root():
    """Explain what this host is.

    Opening the API's address in a browser is a natural thing to do, and a
    bare 404 reads as "the site is broken" rather than "this is the wrong
    address". Pointing at the app costs one route and saves the confusion.
    """
    app_url = (settings.cors_origins or ["http://localhost:3000"])[0]
    return {
        "service": "LeadForge API",
        "status": "ok",
        "message": (
            "This is the LeadForge API, not the web app. There is nothing to "
            f"see here in a browser - open {app_url} instead."
        ),
        "app": app_url,
        "docs": "/docs",
        "health": "/api/health",
    }


@app.get("/api/health")
def health():
    return {"status": "ok", "environment": settings.environment}


app.include_router(auth.router)
app.include_router(workspace.router)
app.include_router(leads.router)
app.include_router(companies.router)
app.include_router(analytics.router)
app.include_router(account.router)
app.include_router(admin.router)
app.include_router(ai.router)
app.include_router(crm.router)
app.include_router(search.router)
app.include_router(notifications.router)
app.include_router(campaigns.router)
app.include_router(campaigns.templates_router)
app.include_router(providers.router)
