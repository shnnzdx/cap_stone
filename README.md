# Cadensy Capstone Workspace

> **Handing this off to someone?** Start with [交接.md](./交接.md) — current state, the
> decisions behind the design (D1–D15), known traps, and a first-day verification script.
> This file covers repo layout and commands; that one covers *why things are the way they are*.

The product is **Cadensy**. `TripSync` still appears in package names, table prefixes, and
older documents — same project, earlier name. Don't "fix" it in code paths without checking.

Cadensy lives in one repository, with one backend database: PostgreSQL. It still has two
frontend surfaces:

- `frontend/`: the main marketing site and product shell
- `trip/`: the standalone Trip workspace prototype
- `backend/`: the FastAPI + PostgreSQL backend that supports the Trip workspace and owns all persistent data

The repo is usable as one workspace, but the apps are not fully merged yet. The current setup focuses on keeping the integration boundary stable while the product continues to evolve.

## At a glance

Today the product works like this:

- `frontend/app/` owns the public-facing site and the `/trip` shell
- `trip/` builds the standalone workspace app and calls the FastAPI REST API
- `backend/` exposes REST API endpoints and persists data in PostgreSQL through SQLAlchemy
- `frontend/public/trip-app/` stores the built Trip workspace that `frontend` embeds
- `shared/` holds cross-app contracts and shared integration tokens
- `AWS/` stores deployment planning and AWS context documents

Shared files you will touch most often:

- `shared/tripsync-preview-theme.css`
- `shared/tripsync-preview-contract.js`
- `shared/tripsync-domain.js`
- `shared/tripsync-product-content.js`
- `shared/tripsync-demo-data.js`

## What is already unified

Recent work was aimed at making `frontend` and `trip` cooperate cleanly, not forcing them into one codebase too early.

Completed:

- Shared embed theme between the shell and the Trip workspace
- Shared embed path contract for `/trip-app` and the default `#/` workspace route
- Shared domain helpers for workspace, account, trip-section, and invite paths
- Automated sync from `trip/dist` into `frontend/public/trip-app`
- Embed manifest output for the mounted Trip build
- Compatibility tests around the integration contract
- Shared product workflow and principle content for `frontend`
- Shared Trip demo fallback data for `trip`
- Windows-compatible `npm run build:trip-preview`

Still not done:

- Full component-library unification
- One typed data model across both apps
- Moving Trip workspace pages into `frontend/app`
- Replacing the static embed with one shared runtime
- Production AWS deployment beyond identity validation

## Project structure

```text
/
|-- .github/                     GitHub Actions workflows
|-- frontend/                    Main site and `/trip` shell
|-- trip/                        Standalone Trip workspace app
|-- backend/                     FastAPI backend for the Trip workspace
|-- shared/                      Shared integration contracts and tokens
|-- docs/                        Project notes and supporting documents
|-- AWS/                         AWS planning and deployment notes
|-- AI.md                        Local agent setup note for this repo
|-- INTEGRATION-ROADMAP.md       Compatibility summary and future plan
|-- 交接.md                       Handoff doc: state, decisions, traps
`-- README.md
```

## Prerequisites

- Node.js `>= 22.13.0`
- npm
- Python 3.13
- PostgreSQL running locally for backend development

## Install dependencies

Install each frontend app in its own directory.

For `frontend`:

```bash
cd frontend
npm install
```

For `trip`:

```bash
cd trip
npm install
```

For `backend`:

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env
```

Fill `backend/.env` with your local PostgreSQL `DATABASE_URL` and `TEST_DATABASE_URL`. The active database for this project is PostgreSQL; Cloudflare D1, Drizzle, and SQLite template files are not part of the current application.

## Local development

Run the main site:

```bash
cd frontend
npm run dev
```

Default URL:

```text
http://localhost:3000
```

Run the backend API:

```bash
cd backend
MOCK_AI=1 .venv/bin/uvicorn app.api.main:app --host 127.0.0.1 --port 8000 --reload
```

`--reload` is not optional. Without it the process keeps serving old code and you get
"impossible" 404s on routes you just added.

### Seeding: read this before you run it

```bash
cd backend
.venv/bin/python -m app.db.reset_demo   # day-to-day: clears test traces, KEEPS all ids
.venv/bin/python -m app.db.seed         # first setup only: drops and rebuilds, CHANGES all ids
```

**Use `reset_demo`. Only run `seed` when you actually want new ids.** `seed` rebuilds the
tables, so every trip and membership id changes — which invalidates `trip/.env`
(`VITE_TRIP_ID` / `VITE_MEMBERSHIP_ID`) and leaves every already-open browser tab polling
dead ids forever. If you do run it, the full recovery sequence is:

```bash
# 1. get the new ids
cd backend && .venv/bin/python -c "
from sqlalchemy import select
from app.db.session import SessionLocal
from app.db.models import TripMembership
with SessionLocal() as db:
    for m in db.scalars(select(TripMembership)): print(m.id, m.role, m.trip_id)"

# 2. update trip/.env, then rebuild and re-sync
cd trip && npm run build
cd frontend && npm run build:trip-preview

# 3. close every open localhost page — including embedded browsers
#    (Codex / ChatGPT.app preview panes, VS Code Simple Browser, agent preview tabs)
```

Step 3 matters as much as the others. Ids are baked into the bundle at build time, so a tab
opened before the rebuild keeps polling the old ones. If mystery requests persist, ask
who is making them: `lsof -nP -iTCP:8000` names the client process.

The API docs are available at:

```text
http://127.0.0.1:8000/docs
```

Run the Trip workspace directly:

```bash
cd trip
npm run dev
```

Default URL:

```text
http://localhost:5173
```

## Sync the embedded Trip workspace

Recommended flow:

```bash
cd frontend
npm run build:trip-preview
```

That command:

1. builds `trip/`
2. copies `trip/dist` into `frontend/public/trip-app/`
3. writes `frontend/public/trip-app/embed-manifest.json`

If `trip/` is already built and you only want to refresh the copied assets:

```bash
cd frontend
npm run sync:trip-preview
```

## Main routes

From `frontend`:

- `/` - landing page
- `/login` - login page
- `/signup` - signup page
- `/how-it-works` - workflow page
- `/faq` - FAQ page
- `/privacy` - privacy page
- `/trip` - embedded Trip workspace shell
- `/trip-app/` - direct static Trip workspace output

From `trip`:

- `#/`
- `#/create`
- `#/account/profile`
- `#/account/travel`
- `#/account/notifications`
- `#/account/settings`
- `#/trip/:tripId/plan`
- `#/trip/:tripId/chat`
- `#/trip/:tripId/conflict`
- `#/trip/:tripId/updates`
- `#/trip/:tripId/preferences`
- `#/trip/:tripId/members`
- `#/trip/:tripId/invite`
- `#/join/:token`

## Build and verification

Build `frontend`:

```bash
cd frontend
npm run build
```

Build `trip`:

```bash
cd trip
npm run build
```

Run backend tests:

```bash
cd backend
DISABLE_SCHEDULER=1 MOCK_AI=1 .venv/bin/python -m pytest -q
```

Run the integration test for the compatibility layer:

```bash
cd frontend
node --test tests/trip-preview-integration.test.mjs
```

Run the full frontend verification suite:

```bash
cd frontend
npm test
```

Expected result:

- `frontend` build succeeds
- `trip` build succeeds through `npm run build:trip-preview`
- frontend tests pass
- Vite may print a chunk-size warning; that is not currently treated as a build failure

## Gotchas worth knowing before you debug something

- **A trip can span at most 16 days.** Every place in the curated library is used at most
  once per trip, so the ceiling is `len(POIS) // len(SLOTS)`. Creating a longer trip is
  rejected at creation time with a 422 rather than failing later at generation.
- **A trip cannot be edited after creation.** There is no `PATCH /api/trips/{id}` yet, so a
  wrong date range means recreating the trip. See 交接.md section 7.
- **`/trip` serves a build, not `trip/src`.** After editing `trip/`, run
  `cd frontend && npm run build:trip-preview` or the page will not change.
- **A 500 from the backend renders as "Could not reach the backend."** That string is a
  frontend fallback for any 5xx — it does not mean the API is down. Read the uvicorn
  terminal for the traceback.
- **The backend runs the settlement scheduler in-process.** Do not deploy it anywhere that
  sleeps between requests (Vercel-style). Railway/Render are fine.
- **There is no Alembic.** Schema changes rely on `create_all` plus hand-written `ALTER`
  statements — check `backend/README.md` for the ones already applied.

## Important notes

- PostgreSQL is the only active application database
- backend tables are defined in `backend/app/db/models.py`
- local demo data is created with `backend/app/db/seed.py`
- `frontend` and `trip` are still separate apps
- the current compatibility approach is intentional
- `/trip` loads static output built from `trip`
- the deeper Phase 3 frontend/runtime merge is paused for now
- GitHub Actions includes AWS identity validation, but no AWS deployment workflow should run until build validation and deployment architecture are settled

## Related docs

- [交接.md](./交接.md) — **start here.** State, decisions (D1–D15), known traps, first-day checks
- [backend/DATABASE_GUIDE.md](./backend/DATABASE_GUIDE.md)
- [backend/README.md](./backend/README.md)
- [INTEGRATION-ROADMAP.md](./INTEGRATION-ROADMAP.md)
- [AWS/TRIPSYNC_AWS_MASTER_CONTEXT_FINAL.md](./AWS/TRIPSYNC_AWS_MASTER_CONTEXT_FINAL.md)
- [docs/PRODUCT.md](./docs/PRODUCT.md)
- [docs/PROPOSAL.md](./docs/PROPOSAL.md)
- [docs/PROPOSAL_EN.md](./docs/PROPOSAL_EN.md)
- [docs/AGENTS.md](./docs/AGENTS.md)
- [docs/frontend/3d-collaborative-idea-sphere-design.md](./docs/frontend/3d-collaborative-idea-sphere-design.md)
- [docs/frontend/ai-travel-hero-scroll-storytelling-final.md](./docs/frontend/ai-travel-hero-scroll-storytelling-final.md)
- [AI.md](./AI.md)
