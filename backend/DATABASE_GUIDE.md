# TripSync Database Guide

TripSync uses one active application database:

```text
PostgreSQL
```

The database is owned by the FastAPI backend in `backend/`. The frontend and
Trip workspace do not create their own application database. They call the
backend REST API, and the backend reads and writes PostgreSQL through SQLAlchemy.

## Important Files

- `app/db/models.py`: SQLAlchemy table definitions
- `app/db/session.py`: database engine and session setup
- `app/db/seed.py`: resets local tables and loads demo data
- `app/api/main.py`: REST API endpoints used by the frontend
- `.env`: local database URLs and runtime settings, not committed to Git

## Configure The Database

Create `backend/.env` from `backend/.env.example`.

Use your local PostgreSQL username, password, host, port, and database names:

```env
DATABASE_URL=postgresql+psycopg://postgres:<URL_ENCODED_PASSWORD>@localhost:5432/tripsync
TEST_DATABASE_URL=postgresql+psycopg://postgres:<URL_ENCODED_PASSWORD>@localhost:5432/tripsync_test
MOCK_AI=1
DEV_ALLOW_MEMBERSHIP_HEADER=1
FRONTEND_BASE_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000
```

Do not commit real passwords or API keys.

## Create Local Databases

On macOS or Linux, if PostgreSQL command line tools are on your PATH:

```bash
createdb tripsync
createdb tripsync_test
```

If those databases already exist, keep them.

## Seed Demo Data

From the backend folder:

```bash
cd backend
.venv/bin/python -m app.db.seed
```

This command creates the tables and loads the demo trip:

```text
Mia's 30th in Chicago
```

Important: the seed script resets local demo tables. Use it only for local
development or a demo database.

## Start The Backend

```bash
cd backend
.venv/bin/uvicorn app.api.main:app --host 127.0.0.1 --port 8000 --reload
```

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

Use `psql` to inspect the local database:

```bash
psql postgresql://postgres@localhost:5432/tripsync
```

If your user or password is different, use the same connection values from
`DATABASE_URL`.

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
