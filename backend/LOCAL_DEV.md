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

`backend/.env` is the backend source of truth. The repo root `.env` may exist for other
tooling, but backend runtime and backend tests should be aligned to `backend/.env`.

## 2. Prerequisites

- Python 3.13
- Backend virtual environment at `backend/.venv`
- Local PostgreSQL running on `localhost:5432` for the test database
- Cloud database access configured only if you intend to use the cloud `DATABASE_URL`

If your machine does not provide a working `python` command, use the full path to an
installed interpreter when creating the virtual environment, for example:

```powershell
D:\ANACONDA\python.exe -m venv .venv
```

After `.venv` has been created successfully, do not switch back to bare `python` on
this machine. Use:

```powershell
.\.venv\Scripts\python.exe
```

for installs, seeding, uvicorn, and pytest.

## 3. Create the Local Test Database

From PowerShell, if `createdb` is already on your `PATH`:

```powershell
createdb -h localhost -p 5432 -U postgres tripsync_test
```

If `createdb` is not on your `PATH`, call the executable from your local PostgreSQL
installation directory instead.

If `tripsync_test` already exists, keep it.

Important:

- `TEST_DATABASE_URL` must point at an explicitly test-only database name such as
  `tripsync_test`, `test_*`, or `*_test`
- pytest may drop and recreate that database as a clean UTF-8 disposable database before
  running schema setup
- never point `TEST_DATABASE_URL` at `tripsync`, `postgres`, or any shared or non-test
  database

Create a local `tripsync` database too only if you want to switch `DATABASE_URL` back to
local development for seeding or offline backend work:

```powershell
createdb -h localhost -p 5432 -U postgres tripsync
```

Before seeding, running uvicorn, or running pytest, make sure PostgreSQL itself is
already accepting connections on `localhost:5432`.

Quick verification:

```powershell
pg_isready -h localhost -p 5432
```

If `pg_isready` is not on `PATH`, run the executable from your PostgreSQL installation
folder instead. The expected healthy result is:

```text
localhost:5432 - accepting connections
```

## 4. Configure `backend/.env`

Create `backend/.env` from `backend/.env.example`.

Use URL-encoded PostgreSQL password characters in both URLs.

Current example:

```env
DATABASE_URL=postgresql+psycopg://<RDS_USER>:<URL_ENCODED_PASSWORD>@<RDS_HOST>:5432/tripsync
TEST_DATABASE_URL=postgresql+psycopg://postgres:<URL_ENCODED_PASSWORD>@localhost:5432/tripsync_test
UNSPLASH_ACCESS_KEY=
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
MOCK_AI=1
SETTLE_TICK_SECONDS=60
DISABLE_SCHEDULER=0
DEV_ALLOW_MEMBERSHIP_HEADER=1
FRONTEND_BASE_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000
```

Notes:

- `DATABASE_URL` may point at cloud RDS, but the backend can only start if that database
  is reachable from this machine
- `TEST_DATABASE_URL` should stay local and disposable because tests rebuild schema
- keep `DATABASE_URL` and `TEST_DATABASE_URL` on different databases
- runtime AI is now DeepSeek-only through `DEEPSEEK_*`
- `chat`, `planner`, and `explainer` all use the same DeepSeek provider path
- on Windows, pytest now forces the PostgreSQL test database and client connection to
  UTF-8 so non-ASCII fixtures stay valid
- on this machine, the local AWS CLI credential copy also lives in `backend/.env`
  under keys such as `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_REGION`
- AWS CLI does not automatically read `backend/.env`, so load those variables into
  the current shell before treating `aws sts get-caller-identity` `NoCredentials`
  as a real missing-credential problem

`DEV_ALLOW_MEMBERSHIP_HEADER=1` keeps the local `X-Membership-Id` demo flow available
while login is still evolving.

## 5. Install Dependencies

Run from the backend directory:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

## 6. Seed Demo Data

`python -m app.db.seed` targets `DATABASE_URL`, not `TEST_DATABASE_URL`.

```powershell
cd backend
.\.venv\Scripts\python.exe -m app.db.seed
```

Important:

- the seed script resets demo tables
- it is for local or explicitly disposable demo databases only
- it should not be used against shared or production-like cloud databases
- the current code refuses destructive seed against a non-local `DATABASE_URL` unless
  `ALLOW_DESTRUCTIVE_SEED=1` is explicitly set

If you already have local data and only need to enable password login without reseeding,
run:

```powershell
cd backend
.\.venv\Scripts\python.exe -m app.db.enable_auth
```

The seeded organizer demo login is:

```text
email: organizer@cadensy.local
password: 12345678
```

## 7. Start the Backend

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.api.main:app --host 127.0.0.1 --port 8000 --reload
```

Keep this terminal open while using the frontend. The login page calls:

```text
http://127.0.0.1:8000/api/auth/login
```

The create-account page calls `POST /api/auth/register`. Successful registration
returns a bearer token immediately. An account with no memberships can use that token
to read `/api/account`, list an empty `/api/trips`, and create its first trip.

The API should be available at:

```text
http://127.0.0.1:8000/api/health
http://127.0.0.1:8000/docs
```

Expected health response:

```json
{"ok": true}
```

If `DATABASE_URL` points at cloud RDS and that host is not reachable from this machine,
uvicorn startup or the first request may fail or time out. In that case, either fix
network access to the cloud database or temporarily point `DATABASE_URL` back to a local
PostgreSQL database for local-only work.

## 7.5 Login Checklist

For `http://localhost:3000/login` to enter the post-login Trip workspace, we need all of
these to be true:

- the frontend is running
- the backend is running on `127.0.0.1:8000`
- `DATABASE_URL` points at the database the backend is actually using
- that database contains the demo organizer login and a real trip membership

The frontend login page posts to:

```text
http://127.0.0.1:8000/api/auth/login
```

The default demo login is:

```text
email: organizer@cadensy.local
password: 12345678
```

This is the fastest verification flow:

```powershell
cd backend
.\.venv\Scripts\python.exe -m app.db.seed
.\.venv\Scripts\python.exe -m uvicorn app.api.main:app --host 127.0.0.1 --port 8000 --reload
```

Then open another terminal:

```powershell
cd frontend
npm run dev
```

Then log in at:

```text
http://localhost:3000/login
```

If the backend already has local data you want to keep, use this instead of reseeding:

```powershell
cd backend
.\.venv\Scripts\python.exe -m app.db.enable_auth
```

What the login errors usually mean:

- `Invalid email or password.`: the database does not contain the demo organizer password login yet
- `Could not log in. Try again.`: the backend replied, but not with a valid login success response
- `Could not reach the backend. Make sure the API is running.`: the frontend could not complete the request; this may be a real connection problem or a backend 500, so always check the uvicorn terminal

One subtle but important point:

- being able to open `http://127.0.0.1:8000/docs` is not enough by itself
- `/docs` proves the API server started
- it does not prove the runtime database has the organizer account, password hash, or trip membership

## 8. Start the Frontend

Open a second PowerShell window:

```powershell
cd frontend
npm install
npm run dev
```

Use the URL printed by Vite. If the frontend is not running on one of the origins in
`CORS_ORIGINS`, add the actual origin to `backend/.env` and restart the backend.

## 9. Run Backend Tests

Pytest now loads `backend/.env` automatically and forces test runtime onto
`TEST_DATABASE_URL`, so tests do not hit the cloud `DATABASE_URL`.

```powershell
cd backend
$env:DISABLE_SCHEDULER='1'
$env:MOCK_AI='1'
.\.venv\Scripts\python.exe -m pytest -q
```

Test safety rules:

- `TEST_DATABASE_URL` must exist and be password-bearing if local PostgreSQL requires auth
- `TEST_DATABASE_URL` must not point at the same database as `DATABASE_URL`
- `TEST_DATABASE_URL` must be clearly test-only by name, or pytest will fail loudly
  before any destructive setup
- pytest may recreate the PostgreSQL test database itself to guarantee a clean UTF-8
  test environment

If you already have a local `tripsync_test` database that you do not want to touch, use
another disposable test database name for the current shell instead of dropping it:

```powershell
cd backend
$env:TEST_DATABASE_URL='postgresql+psycopg://postgres:postgres@localhost:5432/tripsync_test_codex'
$env:DISABLE_SCHEDULER='1'
$env:MOCK_AI='1'
.\.venv\Scripts\python.exe -m pytest tests/test_plan_generation.py -q
```

## 10. Common Problems

`Could not reach the backend.`

The frontend cannot reach `http://localhost:8000` or `http://127.0.0.1:8000`. Start
uvicorn and verify `/api/health`. If the backend is running on `127.0.0.1`, set
frontend API config to that same host or use the default fallback.

`Invalid email or password`

The active runtime database may not have the seeded organizer account, or the password
hash may not exist on older local data. Run `python -m app.db.seed` only against an
approved local or demo `DATABASE_URL`, or `python -m app.db.enable_auth` if you want to
keep existing local rows.

`fe_sendauth: no password supplied`

The process did not read a password-bearing PostgreSQL URL. Check that `backend/.env`
exists, is UTF-8 without BOM, and contains a valid password-bearing URL for whichever
command you are running.

`connection timeout expired`

The cloud `DATABASE_URL` host is not reachable from this machine. Typical causes are
private RDS networking, missing security-group ingress for your public IP, or the need
to connect from inside AWS or VPN instead of directly from a laptop.

`relation ... does not exist`

The active runtime database exists but tables were not created. Run `python -m app.db.seed`
only against a safe local or demo `DATABASE_URL`, or apply the appropriate schema
initialization path for the target database.

`duplicate key value violates unique constraint "pg_database_datname_index"`

Pytest tried to recreate a test database name that already exists in a conflicting local
state. The safest local workaround is usually not to drop that database blindly. Instead,
point `TEST_DATABASE_URL` at a new disposable test-only database name such as
`tripsync_test_codex` for the current shell and rerun pytest.

`AI provider` key errors

Use `MOCK_AI=1` for local development and demos that should not call a paid model API.
For the current runtime, make sure `DEEPSEEK_API_KEY` exists in `backend/.env`.
If a real AI call still fails, check backend traceback first; all three AI surfaces now
share the same DeepSeek provider path.

## 11. Verify Geoapify With a Real Tokyo Trip

1. Put the real key in `backend/.env` as `GEOAPIFY_API_KEY=...`.
2. Start PostgreSQL and confirm `DATABASE_URL` targets the intended development database.
3. Create/upgrade the additive schema:

```powershell
cd backend
.\.venv\Scripts\python.exe -m app.db.init_schema
```

4. Start the backend, frontend, and Trip workspace using the commands above.
5. Create a trip whose destination is `Tokyo, Japan`, submit organizer preferences,
   and generate the itinerary.
6. Verify the cached rows:

```sql
SELECT
    name,
    city,
    country,
    latitude,
    longitude,
    category,
    address,
    image_url,
    opening_hours
FROM place
WHERE provider = 'geoapify'
ORDER BY created_at DESC;
```

7. Create another new Tokyo trip and generate it. When at least 12 Tokyo rows are
   cached, the Place Service reads PostgreSQL without another Geoapify fetch.

Geoapify places commonly have null image, price, duration, and walking metadata.
The Plan page shows its existing `PHOTO` placeholder for a null image. Null price is
not free, null hours are not all-day availability, and null duration/walking values
are not silently converted into planning facts.

Important:

- enabling real AI with `MOCK_AI=0` still requires real place candidates
- Planner first reads PostgreSQL `place` cache, then Geoapify
- if `place` has no usable rows for the destination and Geoapify cannot fill it, plan
  generation becomes `blocked` before DeepSeek can choose anything
- Unsplash only affects Trip cover images; it does not supply Planner places
