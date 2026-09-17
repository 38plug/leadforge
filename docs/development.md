# Development Guide

## Local setup

See the Quick Start in the root [README.md](../README.md). Backend defaults to SQLite (zero setup); the frontend has no mock/demo data of its own — `python -m app.db.seed` populates a real workspace through the normal tables so there's something to look at locally.

## Repository layout

```
apps/
  web/     Next.js app. src/app/* = routes ((app) group = authenticated shell, marketing
           page + /login + /register are outside it), src/components/* = UI,
           src/lib/api.ts = the one place that talks to the backend, src/lib/auth-context.tsx
           = session state, src/types/* = shared TS types mirroring the API schemas
  api/     FastAPI app. app/routers, app/services, app/providers, app/models, app/schemas.
           app/core/security.py = password hashing + JWT. alembic/ = migrations.
  worker/  Background job definitions (RQ), run separately from the API process
docs/      This documentation set
```

## Conventions

- **No business logic in routers.** Routers validate input, resolve the workspace, call a service, and shape the response. Scoring lives in `LeadScoreService`; AI orchestration in `AIService`; compliant sending in `CampaignService`.
- **No business logic in UI components.** The frontend calls the API for everything — there is no client-side score computation or mock dataset to keep in sync with the backend.
- **Workspace scoping is mandatory.** Every new model that stores workspace-owned data needs a `workspace_id` column, and every new router must filter by `get_current_workspace()`.
- **Providers, not vendors.** Never call a third-party SDK directly from a router or service — go through `app/providers/`.
- **Schema changes go through Alembic.** `Base.metadata.create_all()` only runs when `ENVIRONMENT=development`, for zero-setup local SQLite. Any model change needs `alembic revision --autogenerate -m "..."` and a review of the generated migration before it's committed.

## Phase roadmap

- **Phase 1 — Foundation** ✅ Monorepo, Next.js + FastAPI + SQLAlchemy, UI shell, dashboard, environment config, README.
- **Phase 2 — Lead system** ✅ Companies/contacts/leads models, Lead Finder UI + search pipeline (wired to the live API), mock business provider, real website detection, lead scoring, lead details page, saved searches / search history routers.
- **Phase 3 — CRM** ✅ Kanban pipeline UI (drag-and-drop, wired to `PATCH /api/leads/{id}`), lead activity timeline, notes and tasks — both the routers and the lead-detail UI.
- **Phase 4 — AI** ✅ AI provider abstraction, lead analysis, email/call-script generation, and an AI Assistant UI wired to `/api/ai/assistant`.
- **Phase 5 — Outreach** ✅ Campaign CRUD, email templates (CRUD, editable in the UI), and a `CampaignService` that enforces suppression, per-campaign duplicate prevention, and `daily_send_limit` before every send; a public `/api/campaigns/unsubscribe` endpoint. *Remaining: a follow-up sequence scheduler (Day 0/3/7/14 automation) as a background job — the model (`CampaignRecipient.sequence_step`) is ready for it.*
- **Phase 6 — Real data providers** ✅ `OSMBusinessProvider` returns real, public businesses from OpenStreetMap (Nominatim + Overpass) with no API key or cost, and is the default; `BUSINESS_PROVIDER=mock` is refused outright in production so fabricated businesses can't reach a real workspace. Mirror outages are handled with a shared time budget, rotation, and a retryable error rather than a misleading empty result — see [providers.md](providers.md). *Optional later: a paid Places API behind the same interface, which is the only way to get star ratings and review counts (OSM has neither).*
- **Phase 7 — Billing** 🚧 Real usage tracking exists (`GET /api/workspace/usage`) and the Settings → Billing UI reads it live; no live Stripe integration yet (`Subscription`/`UsageRecord` models are ready for it).
- **Phase 8 — Production hardening** 🚧 Real auth ✅ (self-contained JWT, see `docs/api.md`), Alembic migrations ✅, Docker images for web/api/worker ✅, `docker-compose.yml` for a full local-prod-like stack ✅. *Remaining: rate limiting, structured log shipping/monitoring, CI pipeline.*

## Testing

```bash
cd apps/api && ./.venv/Scripts/python.exe -m pytest -q
```

Covers: lead scoring math, website status classification (including the "one failed request ≠ no website" rule), AI output schema validation, full auth flow (register/login/me/token rejection), campaign compliance rules (suppression, dedup, daily limits, pause), CRM (notes/tasks/activity), saved searches, and workspace isolation.

```bash
cd apps/web
npx tsc --noEmit   # typecheck
npx eslint .       # lint
npx next build     # production build
```

## Database migrations

```bash
cd apps/api
# after changing a model:
./.venv/Scripts/python.exe -m alembic revision --autogenerate -m "describe the change"
# review the generated file in alembic/versions/, then:
./.venv/Scripts/python.exe -m alembic upgrade head
```

The Docker image runs `alembic upgrade head` automatically on every boot (see `apps/api/Dockerfile`), so deploying a new migration is just deploying the new image.

## Known environment notes

- Some sandboxes/CI runners have no outbound access to Google Fonts; the layout intentionally uses a system-font stack instead of `next/font/google` to avoid a network-dependent build step.
- `psycopg2-binary` has no prebuilt wheel yet for very new Python versions on some platforms — install it separately from `apps/api/requirements-postgres.txt` only when connecting to real Postgres, and prefer Python 3.11–3.12 for local development.
- `passlib`'s bcrypt backend is incompatible with `bcrypt>=4.1` (a real, easy-to-hit bug — it raises on hash instead of just failing verification). `requirements.txt` pins `bcrypt==4.0.1`; don't bump it without confirming passlib has fixed this upstream.
- Docker was not available in the environment this was built in, so the Compose stack is verified by config validation (YAML syntax, image build logic reviewed by hand) and by running each service's build steps individually (Next.js standalone output, Alembic migration apply) rather than a full `docker compose up`. Run it once yourself before a real deploy.
