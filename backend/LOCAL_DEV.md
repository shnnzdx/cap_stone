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

The seeded organizer demo login is:

```text
email: organizer@cadensy.local
password: 12345678
```

If you already have local data and only need to enable password login without reseeding, run:

```powershell
cd C:\Users\ROG\Desktop\capstone\cap_stone-main\backend
.\.venv\Scripts\python.exe -m app.db.enable_auth
```

## 6. Start the Backend

```powershell
cd C:\Users\ROG\Desktop\capstone\cap_stone-main\backend
.\.venv\Scripts\uvicorn.exe app.api.main:app --host 127.0.0.1 --port 8000 --reload
```

Keep this terminal open while using the frontend. The login page calls:

```text
http://127.0.0.1:8000/api/auth/login
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

## 7. Start the Frontend

Open a second PowerShell window:

```powershell
cd C:\Users\ROG\Desktop\capstone\cap_stone-main\frontend
npm install
npm run dev
```

Use the URL printed by Vite. If the frontend is not running on one of the origins in `CORS_ORIGINS`, add the actual origin to `backend/.env` and restart the backend.

## 8. Run Backend Tests

```powershell
cd C:\Users\ROG\Desktop\capstone\cap_stone-main\backend
$env:DISABLE_SCHEDULER='1'
$env:MOCK_AI='1'
.\.venv\Scripts\python.exe -m pytest -q
```

If `TEST_DATABASE_URL` is not in `.env`, set it temporarily in the shell before running tests.

## 9. Common Problems

`Could not reach the backend.`

The frontend cannot reach `http://localhost:8000` or `http://127.0.0.1:8000`. Start uvicorn and verify `/api/health`. If the backend is running on `127.0.0.1`, set frontend API config to that same host or use the default fallback.

`Invalid email or password`

The database may not have the seeded organizer account, or the password hash may not exist on older local data. Run `python -m app.db.seed` for a full local reset, or `python -m app.db.enable_auth` if you want to keep existing local rows.

`fe_sendauth: no password supplied`

The backend did not read a password-bearing `DATABASE_URL`. Check that `backend/.env` exists, is UTF-8 without BOM, and uses a URL-encoded password.

`relation ... does not exist`

The local database exists but tables were not created. Run `python -m app.db.seed` against the local development database.

`OpenAI` or compatible model key errors

Use `MOCK_AI=1` for local development and demos that should not call a paid model API. For DeepSeek or another OpenAI-compatible provider, set `OPENAI_BASE_URL` and `OPENAI_MODEL` in `backend/.env`.
