# TripSync Backend Local Development

This backend runs locally with FastAPI, PostgreSQL, and a local `.env` file.

Do not commit real credentials. `backend/.env` is ignored by Git.

## 1. Prerequisites

- Python 3.13
- PostgreSQL running on `localhost:5432`
- Backend virtual environment at `backend/.venv`

The current Windows PostgreSQL setup is documented outside the repository:

```text
C:\Users\ROG\Desktop\PostgreSQL_Database_Setup.md
```

Use that document for the local PostgreSQL password. Do not copy that password into committed docs.

## 2. Create Local Databases

From PowerShell:

```powershell
D:\PostgreSQL\18\bin\createdb.exe -h localhost -p 5432 -U postgres tripsync
D:\PostgreSQL\18\bin\createdb.exe -h localhost -p 5432 -U postgres tripsync_test
```

If the databases already exist, keep them.

## 3. Configure `backend/.env`

Create `backend/.env` from `backend/.env.example`.

Use URL-encoded PostgreSQL password characters in `DATABASE_URL` and `TEST_DATABASE_URL`.

Required local values:

```env
DATABASE_URL=postgresql+psycopg://postgres:<URL_ENCODED_PASSWORD>@localhost:5432/tripsync
TEST_DATABASE_URL=postgresql+psycopg://postgres:<URL_ENCODED_PASSWORD>@localhost:5432/tripsync_test
OPENAI_API_KEY=
OPENAI_BASE_URL=
OPENAI_MODEL=gpt-4o-mini
MOCK_AI=1
SETTLE_TICK_SECONDS=60
DISABLE_SCHEDULER=0
DEV_ALLOW_MEMBERSHIP_HEADER=1
FRONTEND_BASE_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000
```

`DEV_ALLOW_MEMBERSHIP_HEADER=1` keeps the local `X-Membership-Id` demo flow available while login is still evolving.

## 4. Install Dependencies

```powershell
cd C:\Users\ROG\Desktop\capstone\cap_stone-main\backend
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

## 5. Seed Local Demo Data

This command initializes tables and demo data in the local `tripsync` database:

```powershell
cd C:\Users\ROG\Desktop\capstone\cap_stone-main\backend
.\.venv\Scripts\python.exe -m app.db.seed
```

Important: the seed script resets local demo tables. Use it for development/demo databases only.

## 6. Start the Backend

```powershell
cd C:\Users\ROG\Desktop\capstone\cap_stone-main\backend
.\.venv\Scripts\uvicorn.exe app.api.main:app --host 127.0.0.1 --port 8000 --reload
```

The API should be available at:

```text
http://127.0.0.1:8000/api/health
http://127.0.0.1:8000/docs
```

Expected health response:

```json
{"ok": true}
```

## 7. Run Backend Tests

```powershell
cd C:\Users\ROG\Desktop\capstone\cap_stone-main\backend
$env:DISABLE_SCHEDULER='1'
.\.venv\Scripts\python.exe -m pytest -q
```

If `TEST_DATABASE_URL` is not in `.env`, set it temporarily in the shell before running tests.

## 8. Common Problems

`Could not reach the backend.`

The frontend cannot reach `http://localhost:8000` or `http://127.0.0.1:8000`. Start uvicorn and verify `/api/health`.

`fe_sendauth: no password supplied`

The backend did not read a password-bearing `DATABASE_URL`. Check that `backend/.env` exists, is UTF-8 without BOM, and uses a URL-encoded password.

`relation ... does not exist`

The local database exists but tables were not created. Run `python -m app.db.seed` against the local development database.
