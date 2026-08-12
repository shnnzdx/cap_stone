# TripSync Backend

Python + FastAPI + PostgreSQL. This backend owns the decision paths, itinerary data,
and decision ledger for the Trip workspace.

Product behavior is defined by:

- [`../README.md`](../README.md)
- [`../trip/BACKEND.md`](../trip/BACKEND.md)

Local environment and PostgreSQL setup are documented in:

- [`LOCAL_DEV.md`](LOCAL_DEV.md)

Recent backend handoff notes live in:

- [`../trip/交接.md`](../trip/%E4%BA%A4%E6%8E%A5.md)

---

## Quick Start

Requirements:

- Python 3.13
- PostgreSQL

Run everything from the `backend/` directory.

```powershell
cd backend

# If `python` is not available on your machine, replace it with your installed
# interpreter path, for example:
# D:\ANACONDA\python.exe -m venv .venv
python -m venv .venv

.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
createdb tripsync
createdb tripsync_test
.\.venv\Scripts\python.exe -m app.db.seed
.\.venv\Scripts\python.exe -m uvicorn app.api.main:app --port 8000 --reload
```

If you see `Python was not found` after creating `.venv`, that usually means the
Windows `python` command is not on `PATH`. That is fine. After `.venv` exists, stop
using bare `python` commands and use:

```powershell
.\.venv\Scripts\python.exe
```

for every backend step instead.

Open:

- [http://localhost:8000/docs](http://localhost:8000/docs)
- [http://localhost:8000/api/health](http://localhost:8000/api/health)

Run tests:

```powershell
cd backend
$env:DISABLE_SCHEDULER='1'
.\.venv\Scripts\python.exe -m pytest -q
```

`.\.venv\Scripts\python.exe -m app.db.seed` will reset and rebuild demo data, so only
use it for local development or disposable demo databases.

## Login Works Only When These Three Things Are True

For the `frontend` login page to enter the Trip workspace successfully, all three must
be true at the same time:

1. The backend is running on `http://127.0.0.1:8000`
2. `backend/.env` points at a reachable PostgreSQL database
3. That database already contains the demo organizer login and its trip membership

The default demo login is:

```text
email: organizer@cadensy.local
password: 12345678
```

Important:

- opening `http://127.0.0.1:8000/docs` only proves the API process started
- it does not prove the database contains the login account
- it does not prove the account is attached to a trip

If login fails with `Invalid email or password`, the usual cause is that the database
was never seeded, or an older local database exists without the password hash.

If login fails after the backend starts cleanly, run one of these:

```powershell
cd backend
.\.venv\Scripts\python.exe -m app.db.seed
```

or, if you want to keep the existing local data and only restore the demo organizer
password login:

```powershell
cd backend
.\.venv\Scripts\python.exe -m app.db.enable_auth
```

After that, restart uvicorn and try the login again.

---

## Environment Variables

Put runtime variables in `backend/.env`. Do not commit real secrets.

| Name | Purpose | Default |
| --- | --- | --- |
| `DATABASE_URL` | runtime database | `postgresql+psycopg://localhost/tripsync` |
| `TEST_DATABASE_URL` | pytest database | `.../tripsync_test` |
| `OPENAI_API_KEY` | model access | none |
| `OPENAI_BASE_URL` | OpenAI-compatible provider base URL | none |
| `OPENAI_MODEL` | model name | `gpt-4o-mini` |
| `MOCK_AI` | use local mock AI when `1` | `1` |
| `SETTLE_TICK_SECONDS` | settlement polling interval | `60` |
| `DISABLE_SCHEDULER` | disable scheduler when `1` | none |
| `DEV_ALLOW_MEMBERSHIP_HEADER` | keep `X-Membership-Id` local fallback | `1` |
| `FRONTEND_BASE_URL` | frontend base URL for redirects | `http://localhost:5173` |
| `CORS_ORIGINS` | allowed frontend origins | `http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000` |

Never hard-code real credentials into source files.

---

## Directory Layout

```text
app/
|-- domain/
|   |-- constraints/
|   |   |-- types.py
|   |   `-- engine.py
|   `-- decisions/
|       `-- orchestrator.py
|-- db/
|   |-- models.py
|   |-- session.py
|   `-- seed.py
|-- api/
|   `-- main.py
`-- jobs/
    `-- scheduler.py
tests/
```

Dependency direction is intentionally one-way:

`api -> domain -> db`

Do not pull API concerns back into `domain`.

---

## Core Architecture

### Constraint Engine

`domain/constraints/engine.py` exposes a deterministic classifier:

```python
classify(change, constraints) -> Classification
```

It does not call AI, touch the database, or make network requests.

### Decision Orchestrator

`domain/decisions/orchestrator.py` executes the decision path after classification:

- apply directly
- open a round
- reopen a round
- create a confirmation proposal

### API Layer

`api/main.py` should stay thin:

- parse request
- call domain
- return JSON

Business rules belong in domain code, not in route handlers.

---

## Privacy Model

Privacy is enforced structurally, not by hoping a filter catches everything:

1. Private raw user wording is stored separately from decision-safe constraint data.
2. Decision outputs do not carry identity fields or original wording.
3. Notice tables do not store actor identity in a way that leaks through normal reads.

The privacy regression tests protect this behavior.

---

## Database Guardrails

The database enforces key invariants directly:

- only one open round per item
- only one pending proposal per item
- one vote per member per round
- one confirmation response per member per proposal

Application code should still pre-check where possible so the user receives a clean
409 response instead of a raw 500.

---

## Change Ledger

`plan_change` is append-only. Current plan state is derived from the original plan plus
the accumulated ledger.

Each entry records its origin, for example:

- `notice`
- `round`
- `reopen_round`
- `confirm`
- `ai_generate`
- `rule_generate`

This is the main audit trail for explaining how the itinerary changed.

---

## Tests

Run:

```powershell
cd backend
$env:DISABLE_SCHEDULER='1'
$env:MOCK_AI='1'
.\.venv\Scripts\python.exe -m pytest -q
```

Important safety rules:

- `TEST_DATABASE_URL` must point to a clearly test-only database
- it must not match `DATABASE_URL`
- pytest may recreate the test database as a clean UTF-8 database

Representative test areas:

- `test_engine.py`: decision rules, privacy, determinism
- `test_schema.py`: database invariants
- `test_paths.py`: end-to-end decision flows
- `test_jobs.py`: scheduler behavior
- `test_auth.py`: login, logout, bearer session
- `test_agent*.py`: chat and agent behavior
- `test_plan_generation.py`: planner fallback behavior
- `test_comments.py` / `test_booking.py`: comments, booking, organizer actions
