# TripSync Backend Local Development

This backend runs with FastAPI, PostgreSQL, and `backend/.env`.

Do not commit real credentials. `backend/.env` is ignored by Git.

## 1. Current Configuration Model

The current expected setup is mixed:

- `DATABASE_URL`: primary runtime database for the backend. This may point to cloud RDS.
- `TEST_DATABASE_URL`: disposable local PostgreSQL database for pytest.

Today that means:

```text
runtime app / uvicorn -> DATABASE_URL
pytest               -> TEST_DATABASE_URL
```

`backend/.env` is the backend source of truth. The repo root `.env` may exist for other tooling, but backend runtime and backend tests should be aligned to `backend/.env`.

## 2. Prerequisites

- Python 3.13
- Backend virtual environment at `backend/.venv`
- Local PostgreSQL running on `localhost:5432` for the test database
- Cloud database access configured only if you intend to use the cloud `DATABASE_URL`

The current Windows PostgreSQL setup is documented outside the repository:

```text
C:\Users\ROG\Desktop\PostgreSQL_Database_Setup.md
```

Use that document for the local PostgreSQL password. Do not copy that password into committed docs.

## 3. Create the Local Test Database

From PowerShell:

```powershell
D:\PostgreSQL\18\bin\createdb.exe -h localhost -p 5432 -U postgres tripsync_test
```

If `tripsync_test` already exists, keep it.

Create a local `tripsync` database too only if you want to switch `DATABASE_URL` back to local development for seeding or offline backend work:

```powershell
D:\PostgreSQL\18\bin\createdb.exe -h localhost -p 5432 -U postgres tripsync
```

## 4. Configure `backend/.env`

Create `backend/.env` from `backend/.env.example`.

Use URL-encoded PostgreSQL password characters in both URLs.

Current mixed example:

```env
DATABASE_URL=postgresql+psycopg://<RDS_USER>:<URL_ENCODED_PASSWORD>@<RDS_HOST>:5432/tripsync
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

Notes:

- `DATABASE_URL` may point at cloud RDS, but the backend can only start if that database is reachable from this machine.
- `TEST_DATABASE_URL` should stay local and disposable because tests rebuild schema.
- Keep `DATABASE_URL` and `TEST_DATABASE_URL` on different databases.

`DEV_ALLOW_MEMBERSHIP_HEADER=1` keeps the local `X-Membership-Id` demo flow available while login is still evolving.

## 5. Install Dependencies

```powershell
cd C:\Users\ROG\Desktop\capstone\cap_stone-main\backend
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

## 6. Seed Demo Data

`python -m app.db.seed` targets `DATABASE_URL`, not `TEST_DATABASE_URL`.

```powershell
cd C:\Users\ROG\Desktop\capstone\cap_stone-main\backend
.\.venv\Scripts\python.exe -m app.db.seed
```

Important:

- The seed script resets demo tables.
- It is for local or explicitly disposable demo databases only.
- It should not be used against shared or production-like cloud databases.
- The current code refuses destructive seed against a non-local `DATABASE_URL` unless `ALLOW_DESTRUCTIVE_SEED=1` is explicitly set.

If you already have local data and only need to enable password login without reseeding, run:

```powershell
cd C:\Users\ROG\Desktop\capstone\cap_stone-main\backend
.\.venv\Scripts\python.exe -m app.db.enable_auth
```

The seeded organizer demo login is:

```text
email: organizer@cadensy.local
password: 12345678
```

## 7. Start the Backend

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

If `DATABASE_URL` points at cloud RDS and that host is not reachable from this machine, uvicorn startup or the first request may fail or time out. In that case, either fix network access to the cloud database or temporarily point `DATABASE_URL` back to a local PostgreSQL database for local-only work.

## 8. Start the Frontend

Open a second PowerShell window:

```powershell
cd C:\Users\ROG\Desktop\capstone\cap_stone-main\frontend
npm install
npm run dev
```

Use the URL printed by Vite. If the frontend is not running on one of the origins in `CORS_ORIGINS`, add the actual origin to `backend/.env` and restart the backend.

## 9. Run Backend Tests

Pytest now loads `backend/.env` automatically and forces test runtime onto `TEST_DATABASE_URL`, so tests do not hit the cloud `DATABASE_URL`.

```powershell
cd C:\Users\ROG\Desktop\capstone\cap_stone-main\backend
$env:DISABLE_SCHEDULER='1'
$env:MOCK_AI='1'
.\.venv\Scripts\python.exe -m pytest -q
```

Test safety rules:

- `TEST_DATABASE_URL` must exist and be password-bearing if local PostgreSQL requires auth.
- `TEST_DATABASE_URL` must not point at the same database as `DATABASE_URL`.
- Tests drop and recreate schema in the test database.

## 10. Common Problems

`Could not reach the backend.`

The frontend cannot reach `http://localhost:8000` or `http://127.0.0.1:8000`. Start uvicorn and verify `/api/health`. If the backend is running on `127.0.0.1`, set frontend API config to that same host or use the default fallback.

`Invalid email or password`

The active runtime database may not have the seeded organizer account, or the password hash may not exist on older local data. Run `python -m app.db.seed` only against an approved local/demo `DATABASE_URL`, or `python -m app.db.enable_auth` if you want to keep existing local rows.

`fe_sendauth: no password supplied`

The process did not read a password-bearing PostgreSQL URL. Check that `backend/.env` exists, is UTF-8 without BOM, and contains a valid password-bearing URL for whichever command you are running.

`connection timeout expired`

The cloud `DATABASE_URL` host is not reachable from this machine. Typical causes are private RDS networking, missing security-group ingress for your public IP, or the need to connect from inside AWS/VPN instead of directly from a laptop.

`relation ... does not exist`

The active runtime database exists but tables were not created. Run `python -m app.db.seed` only against a safe local/demo `DATABASE_URL`, or apply the appropriate schema initialization path for the target database.

`OpenAI` or compatible model key errors

Use `MOCK_AI=1` for local development and demos that should not call a paid model API. For DeepSeek or another OpenAI-compatible provider, set `OPENAI_BASE_URL` and `OPENAI_MODEL` in `backend/.env`.
