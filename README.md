# LeadForge

**Your AI-powered client acquisition command center for web design.**

> Find businesses that are ready for a better website.

LeadForge helps web designers, freelancers, and agencies discover local businesses that are strong potential website clients — then takes them from discovery through scoring, AI-assisted outreach, and a CRM pipeline to close.

```
DISCOVER → FILTER → DETECT WEBSITE STATUS → ENRICH → SCORE → SAVE AS LEAD
  → AI ANALYSIS → OUTREACH (email/call/social) → CRM PIPELINE → CLOSE
```

## Product overview

- **Lead Finder** — search businesses by country/city/niche and a rich filter set (website status, ratings, reviews, contact availability, opportunity score).
- **Opportunity Score (0–100)** — a transparent, configurable scoring service (`apps/api/app/services/lead_scoring.py`) explains *why* a lead is a good fit.
- **CRM** — a 9-stage Kanban pipeline (New → Researched → Contacted → Replied → Interested → Meeting → Proposal → Won/Lost).
- **AI Assistant** — lead analysis, email/call-script/DM generation, proposal outlines, and pricing suggestions, all validated against Pydantic schemas so raw AI output is never trusted blindly.
- **Campaigns** — compliant outreach with unsubscribe handling, a suppression list, bounce tracking, and editable follow-up sequences.
- **Analytics** — full-funnel metrics: leads by niche/country, conversion funnel, campaign performance, revenue.

## Architecture

A monorepo with a clear separation between UI, API, business logic, data providers, background jobs, and the database. See [docs/architecture.md](docs/architecture.md) for the full breakdown.

```
apps/
  web/      Next.js 15 + TypeScript + Tailwind — the SaaS frontend
  api/      FastAPI + SQLAlchemy + Pydantic — the backend API
  worker/   Background job definitions (RQ + Redis)
docs/       Architecture, API, provider, development, and compliance docs
.env.example
```

Every external integration (business data, website checks, social discovery, AI, email) sits behind a **provider interface**, so the whole app runs locally with zero API keys — business search is backed by real OpenStreetMap data for free, and the rest fall back to mocks until keys are supplied. See [docs/providers.md](docs/providers.md).

## Quick start

### Prerequisites

- Node.js 18+
- Python 3.11–3.12 (3.13+ may lack prebuilt wheels for some dependencies; this repo was verified against 3.12)
- (Optional) PostgreSQL + Redis for a production-like setup — SQLite is the zero-config local default

### 1. Backend (FastAPI)

```bash
cd apps/api
python -m venv .venv
./.venv/Scripts/activate        # Windows
# source .venv/bin/activate     # macOS/Linux

pip install -r requirements.txt
cp .env.example .env

python -m app.db.seed           # seeds a demo workspace with 35 businesses
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

### 2. Frontend (Next.js)

```bash
cd apps/web
npm install
cp .env.example .env.local
npm run dev
```

App: http://localhost:3000 — a marketing landing page. Click "Open app" / "Sign up" to create an account (calls the real `/api/auth/register` endpoint) and land in the live dashboard.

The frontend has no demo/mock data of its own — every page (dashboard, leads, CRM, campaigns, templates, AI assistant, analytics, settings/billing/team) reads and writes through the API client in `apps/web/src/lib/api.ts`. If the backend is unreachable, pages show a real error state with a retry button rather than falling back to fake data. `python -m app.db.seed` is what populates a workspace with realistic sample data for local exploration — that data still goes through the same tables and endpoints as anything a real user creates.

### 3. Worker (optional — background jobs)

Requires Redis:

```bash
cd apps/worker
pip install -r requirements.txt
python run.py
```

### Running tests / lint / typecheck

```bash
# Backend
cd apps/api && ./.venv/Scripts/python.exe -m pytest -q

# Frontend
cd apps/web
npx tsc --noEmit
npx eslint .
npx next build
```

## Documentation

- [docs/architecture.md](docs/architecture.md) — system design, data flow, multi-tenancy
- [docs/api.md](docs/api.md) — REST API reference
- [docs/providers.md](docs/providers.md) — provider interfaces and how to plug in real integrations
- [docs/development.md](docs/development.md) — local dev workflow, phases, roadmap
- [docs/compliance.md](docs/compliance.md) — responsible data use and outreach compliance

## Deployment

### Option A — Docker Compose (self-hosted, one command)

Builds and runs Postgres, Redis, the API, a background worker, and the web app together:

```bash
cp .env.example .env   # then set JWT_SECRET at minimum
docker compose up --build
```

- Web: http://localhost:3000
- API: http://localhost:8000/docs
- The API container runs `alembic upgrade head` before starting — Postgres gets real, versioned migrations, not `create_all()`.

Set `AI_PROVIDER_API_KEY` / `BUSINESS_PROVIDER_API_KEY` / `EMAIL_PROVIDER_API_KEY` (and their `*_PROVIDER` name) in `.env` to move off mock providers; see [docs/providers.md](docs/providers.md).

### Option B — Free managed hosting (Neon + Render + Vercel)

This runs the whole product at $0 with no credit card on any of the three
accounts. Each piece is on a free tier that is permanent rather than a trial:

| Piece | Host | Free-tier caveat |
| --- | --- | --- |
| Postgres | [Neon](https://neon.com) | 0.5 GB storage, 100 compute-hours/month. Permanent — no card, no clock. |
| API | [Render](https://render.com) | Spins down after 15 min idle and takes ~1 min to wake; 750 instance-hours/month per workspace. |
| Frontend | [Vercel](https://vercel.com) | Hobby plan; no spin-down. |

> **Why not Render's own Postgres?** Its free database *expires 30 days after
> creation* (then a 14-day grace period before deletion). Neon's free tier has
> no such clock, so the database lives there.

1. **Database (Neon)** — create a project and copy the connection string. It
   already looks like `postgresql://…?sslmode=require`, which is what the API
   expects; a `postgres://` string from any other host is normalised
   automatically (see `Settings._normalise_database_url`).
2. **API (Render)** — "New → Blueprint", point it at this repo. `render.yaml`
   defines the service; Render prompts for the `sync: false` values:
   - `DATABASE_URL` — the Neon string
   - `JWT_SECRET` and `SECRET_ENCRYPTION_KEY` — see the checklist below
   - `CORS_ORIGINS` — `["https://your-app.vercel.app"]` (fill in after step 3,
     then redeploy)
   - `OSM_CONTACT` — your email, per OpenStreetMap's usage policy

   Render **Secret Files** work too, and the filename does not matter: every
   file mounted in `/etc/secrets` is read as an env file. Paste the same
   `KEY=value` lines into one and the API picks them up.
3. **Frontend (Vercel)** — import the repo with **Root Directory `apps/web`**.
   Set `NEXT_PUBLIC_API_URL` to the Render URL. Next.js inlines `NEXT_PUBLIC_*`
   at build time, so changing it later needs a rebuild, not just a restart.

Expect the first search after an idle period to be slow: Render's ~1 min wake
plus up to 60s for the OpenStreetMap query. Moving the API to Render's paid
Starter plan removes the spin-down.

### Pre-deploy checklist

With `ENVIRONMENT=production`, the API refuses to start when `JWT_SECRET` is
still the built-in default or `DATABASE_URL` still points at SQLite — see
`app/core/startup_checks.py`. Both states are invisible from outside (the
health check passes either way) while leaving tokens forgeable or discarding
every account on restart, so the deploy fails loudly instead.

- [ ] `JWT_SECRET` is a real random value, not the placeholder
- [ ] `SECRET_ENCRYPTION_KEY` is set to a real Fernet key (required in production — without it, saving a workspace's email settings fails)
- [ ] `DATABASE_URL` points at managed Postgres, not SQLite
- [ ] `CORS_ORIGINS` lists only your real frontend domain(s)
- [ ] `ENVIRONMENT=production` (disables the dev-only `create_all()` auto-schema and the demo-user auth fallback path becomes irrelevant once real accounts exist)
- [ ] Backend tests pass: `cd apps/api && python -m pytest -q`
- [ ] Frontend builds clean: `cd apps/web && npx tsc --noEmit && npx eslint . && npx next build`

## Current status

Built and verified — **this is a real, working application, not a demo shell**:

- **Auth**: self-contained JWT registration/login (`/api/auth/*`), no external identity provider required. Passwords are bcrypt-hashed; every workspace-scoped endpoint checks the caller's membership.
- **Frontend**: every page (dashboard, lead finder, leads, lead detail, CRM, campaigns, templates, AI assistant, analytics, settings/billing/team) fetches and mutates through the real API — loading, error, and empty states throughout, no hardcoded sample arrays left in the app.
- **Backend**: normalized SQLAlchemy models, Alembic migrations, lead scoring service, business/website/social/AI/email provider interfaces (business search returns **real** OpenStreetMap data out of the box, with no API key; social/AI/email stay mock-backed until real keys are supplied), full CRM (notes/tasks/activity), saved searches, notifications, and a compliant campaign engine (suppression list, duplicate prevention, daily send limits, public unsubscribe endpoint).
- **Marketing landing page**: pricing, features, and the brand system, separate from the authenticated app shell.
- **Deployment**: Dockerfiles for web/api/worker, a `docker-compose.yml` for the full local-prod-like stack, and Alembic-driven schema migrations.
- **Verified, not assumed**: 86 passing backend tests (scoring, website detection, OSM search and its mirror-failure handling, workspace isolation, AI schema validation, campaign compliance rules, full auth flow, API contracts) and a clean `tsc --noEmit` / `eslint` / `next build` on the frontend.

See [docs/development.md](docs/development.md) for the phase-by-phase roadmap and what's next.
