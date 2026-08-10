# TripSync Database Guide

TripSync uses one active application database:

```text
PostgreSQL
```

The database is owned by the FastAPI backend in `backend/`. The frontend and
Trip workspace do not create their own application database. They call the
backend REST API, and the backend reads and writes PostgreSQL through SQLAlchemy.

The current working setup is mixed:

```text
DATABASE_URL      -> primary runtime database (currently allowed to be cloud RDS)
TEST_DATABASE_URL -> disposable local PostgreSQL test database
```

This split is intentional. Normal backend runtime and pytest do not have the same safety requirements.

## Important Files

- `app/db/models.py`: SQLAlchemy table definitions
- `app/db/session.py`: database engine and session setup
- `app/db/seed.py`: resets local tables and loads demo data
- `app/api/main.py`: REST API endpoints used by the frontend
- `.env`: local database URLs and runtime settings, not committed to Git

## Source Of Truth

`backend/.env` is the backend runtime source of truth.

The repo root `.env` may exist for other tooling, but backend commands should be aligned to `backend/.env` to avoid configuration drift.

## Configure The Database

Create `backend/.env` from `backend/.env.example`.

Current mixed example:

```env
DATABASE_URL=postgresql+psycopg://<RDS_USER>:<URL_ENCODED_PASSWORD>@<RDS_HOST>:5432/tripsync
TEST_DATABASE_URL=postgresql+psycopg://postgres:<URL_ENCODED_PASSWORD>@localhost:5432/tripsync_test
MOCK_AI=1
DEV_ALLOW_MEMBERSHIP_HEADER=1
FRONTEND_BASE_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000
```

Do not commit real passwords or API keys.

Rules:

- `DATABASE_URL` may point at cloud RDS if this machine can reach it.
- `TEST_DATABASE_URL` should stay local and disposable.
- `DATABASE_URL` and `TEST_DATABASE_URL` must not point at the same database.

## Create Local Test Databases

At minimum, create the local test database:

```bash
createdb tripsync_test
```

Create local `tripsync` too only if you want to run the main backend against localhost instead of cloud RDS:

```bash
createdb tripsync
```

If those databases already exist, keep them.

## Seed Demo Data

From the backend folder:

```bash
cd backend
.venv/bin/python -m app.db.seed
```

Important:

- `seed` uses `DATABASE_URL`, not `TEST_DATABASE_URL`.
- `seed` is destructive and meant only for local/demo databases.
- The current code refuses destructive seed against a non-local `DATABASE_URL` unless `ALLOW_DESTRUCTIVE_SEED=1` is set explicitly.

This command creates the tables and loads the demo trip:

```text
Mia's 30th in Chicago
```

Use it only for local development or a demo database.

## Start The Backend

```bash
cd backend
.venv/bin/uvicorn app.api.main:app --host 127.0.0.1 --port 8000 --reload
```

This command uses `DATABASE_URL`. If that URL points to cloud RDS and the host is not reachable from this machine, backend startup or the first request will fail or time out.

Open the API docs:

```text
http://127.0.0.1:8000/docs
```

Check health:

```bash
curl http://127.0.0.1:8000/api/health
```

Expected response:

```json
{"ok":true}
```

## Enter PostgreSQL From Terminal

Use `psql` to inspect whichever database is active for the command you are debugging.

For the local test database:

```bash
psql postgresql://postgres@localhost:5432/tripsync_test
```

For a local runtime database:

```bash
psql postgresql://postgres@localhost:5432/tripsync
```

If your user, password, host, or database name differ, use the same connection values from the relevant URL in `backend/.env`.

Useful commands inside `psql`:

```sql
\dt
\d trip
SELECT id, name, destination, status FROM trip;
SELECT id, title, place, settledness FROM plan_item ORDER BY day_date, start_hour;
SELECT id, origin, reason, applied_at FROM plan_change ORDER BY applied_at DESC;
\q
```

## REST API Checks

Use the FastAPI docs at `/docs`, or test with curl.

First log in with the seeded organizer account:

```bash
curl -X POST http://127.0.0.1:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"organizer@cadensy.local","password":"12345678"}'
```

The response returns a bearer token and trip membership context. Use those values
for authenticated requests:

```bash
curl http://127.0.0.1:8000/api/trips \
  -H "Authorization: Bearer <TOKEN>" \
  -H "X-Trip-Id: <TRIP_ID>"
```

For local development, `DEV_ALLOW_MEMBERSHIP_HEADER=1` also allows the demo
`X-Membership-Id` flow.

## Tests

Pytest now loads `backend/.env` automatically and forces test runtime to use `TEST_DATABASE_URL` for both schema rebuilds and app startup paths. This prevents test runs from accidentally touching a cloud `DATABASE_URL`.

Run:

```bash
cd backend
DISABLE_SCHEDULER=1 MOCK_AI=1 .venv/bin/python -m pytest -q
```

Safety requirement:

```text
TEST_DATABASE_URL must point at a disposable database.
```

## What To Show In The Module 7 Video

Record a short full-stack flow:

1. Show the repository structure: `trip/`, `backend/`, and `backend/app/db/models.py`.
2. Open `backend/.env` enough to show that `DATABASE_URL` points to PostgreSQL, without showing real secrets.
3. Run or mention `.venv/bin/python -m app.db.seed` to create tables and demo data.
4. Start the backend and open `http://127.0.0.1:8000/docs`.
5. Start the Trip workspace frontend and perform a user action, such as creating a trip, saving preferences, voting, commenting, or changing an itinerary item.
6. Open browser DevTools Network and show the frontend calling `/api/...` successfully.
7. Return to Terminal and use `psql` to query the affected table, proving that the frontend action changed PostgreSQL data.
8. Briefly explain one issue you handled, such as CORS, backend URL configuration, seeded demo data, or authentication headers.

The key message is:

```text
Trip workspace frontend -> FastAPI REST API -> PostgreSQL database
```

## Database Boundary

Cloudflare D1, Drizzle, and SQLite starter files are not part of the current
TripSync application database. They were removed from `frontend/` so the
capstone submission has one clear database story: PostgreSQL through the backend.
