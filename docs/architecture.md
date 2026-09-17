# Architecture

## Layers

```
┌─────────────────────────────────────────────────────────────┐
│  apps/web  (Next.js/React/TypeScript)                       │
│  - App Router pages per feature (dashboard, lead-finder, …) │
│  - UI primitives (components/ui) — shadcn-style, Tailwind   │
│  - No business logic; talks to the API for real data         │
└───────────────────────────┬───────────────────────────────────┘
                             │ REST (JSON)
┌───────────────────────────▼───────────────────────────────────┐
│  apps/api  (FastAPI)                                          │
│  routers/      HTTP boundary — validation, workspace scoping  │
│  services/     Business logic (LeadScoreService, AIService)   │
│  providers/    External integrations behind interfaces        │
│  models/       SQLAlchemy ORM (normalized, workspace-scoped)  │
│  schemas/      Pydantic request/response + AI-output contracts│
└───────────────────────────┬───────────────────────────────────┘
                             │
                ┌────────────┴────────────┐
                ▼                         ▼
        PostgreSQL / SQLite        Redis + apps/worker
        (source of truth)          (background jobs)
```

**Rule of thumb:** routers only orchestrate; all scoring/AI/business rules live in `services/`; all external I/O lives behind a `providers/` interface. This keeps the app testable and lets any integration be swapped without touching the rest of the codebase.

## Data flow: Lead Finder search

1. Frontend posts filters to `POST /api/leads/search`.
2. `BusinessSearchProvider.search()` returns candidate businesses (mock or real).
3. For each business, `WebsiteProvider.detect_website()` checks whether a live site exists (a missing URL → `NO_WEBSITE`; a present URL is always given a real HTTP check — a single failed request is never silently reinterpreted as "no website").
4. `LeadScoreService.score()` computes the Opportunity Score from website status, rating, reviews, social presence, and contact availability.
5. Companies + Leads are persisted, scoped to the caller's workspace.
6. The search itself is recorded in `SearchHistory` for the Search History feature.

At production scale, step 2–4 move into a background job (`apps/worker`) that streams progress back to the client instead of blocking the HTTP request — the interfaces don't change, only who calls them.

## Multi-tenancy

Every business-owned row (`Company`, `Lead`, `Campaign`, etc.) carries a `workspace_id`. `app/core/deps.py::get_current_workspace` resolves the caller's workspace from the request (dev header stub today; a real JWT/session claim once auth is wired to Supabase or similar), and every router filters by it. No query should ever read across workspaces — `tests/test_workspace_isolation.py` enforces this.

## Provider architecture

See [providers.md](providers.md) for the full contract. In short: `BusinessSearchProvider`, `WebsiteProvider`, `SocialProvider`, `AIProvider`, and `EmailProvider` are abstract interfaces with a `Mock*` implementation used whenever the corresponding API key is absent from configuration. This is what lets LeadForge run immediately with zero credentials and later swap in a real Places API, a real LLM, or a real ESP without touching routers, services, or the frontend.

## Error handling

Provider failures raise `ProviderError` (`code`, `message`, `retryable`), caught by a global FastAPI exception handler and returned as a structured JSON error (see `app/main.py::provider_error_handler`) — the app never 500s opaquely because Google Maps (or whichever provider) is briefly down. `AIService` additionally falls back to a safe, non-AI response so lead analysis always returns *something* useful rather than an error page.

## Database

SQLAlchemy 2.0 declarative models (`apps/api/app/models/`). UUID string primary keys, `created_at`/`updated_at` on every table via a shared mixin. SQLite is the zero-config local default (`DATABASE_URL=sqlite:///./leadforge.db`); switch to Postgres by changing `DATABASE_URL` and installing `apps/api/requirements-postgres.txt`. Schema changes are managed with Alembic (`apps/api/alembic/`) — `Base.metadata.create_all()` only runs when `ENVIRONMENT=development`, purely for zero-setup local SQLite; staging and production apply `alembic upgrade head` instead (the Docker image does this automatically on boot).

## Frontend

Next.js App Router, one route per major section (`/dashboard`, `/lead-finder`, `/leads`, `/leads/[id]`, `/crm`, `/campaigns`, `/templates`, `/ai-assistant`, `/analytics`, `/data-sources`, `/settings`). Shared UI primitives live in `components/ui` (Button, Card, Badge, Input, Progress) built on Radix + `class-variance-authority`, matching the shadcn/ui conventions requested in the brief without vendoring the CLI. The dark-first theme is defined entirely with CSS custom properties in `globals.css` so light mode is a first-class fallback, not an afterthought.
