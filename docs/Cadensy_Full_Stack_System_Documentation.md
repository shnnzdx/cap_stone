# Cadensy Full-Stack System Documentation

**Project:** Cadensy (formerly TripSync)  
**Document type:** Production support, setup, troubleshooting, usage, and architecture guide  
**Repository:** <https://github.com/shnnzdx/cap_stone>  
**Production application:** <https://app.cadensy.top>  
**Document date:** August 25, 2026  
**Reviewed commit:** `9deb165d63c154b735f3eb589fac4e856eb13c86`  
**Team members:** Dixin Zhang, Yuming Liu, Jiayi Chen  

> Submission note: This document consolidates the final operational documentation required by the assignment. Historical engineering handoffs remain in the project repository, but this document is the primary grading entry point.

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Production Support and Testing Scenarios](#2-production-support-and-testing-scenarios)
3. [System Setup Instructions](#3-system-setup-instructions)
4. [Issue Diagnosis, Research, Resolution, and Sharing](#4-issue-diagnosis-research-resolution-and-sharing)
5. [System Usage Guide](#5-system-usage-guide)
6. [Architecture](#6-architecture)
7. [Deployment Pipeline Overview](#7-deployment-pipeline-overview)
8. [Security Considerations](#8-security-considerations)
9. [Known Limitations](#9-known-limitations)
10. [Final Submission Validation Checklist](#10-final-submission-validation-checklist)
11. [References](#11-references)

---

## 1. System Overview

### 1.1 Purpose

Cadensy is a collaborative, AI-assisted group travel planning application. It helps small groups create a shared itinerary, collect individual preferences and hard constraints, generate a feasible plan, and handle later changes through structured group decision paths.

The product is more than a one-time itinerary generator. It supports a living Current Plan and routes changes through one of four backend-controlled outcomes:

- `notice`: the change applies immediately and members receive an update;
- `round`: members vote on a contested or previously touched item;
- `reopen_round`: a settled decision is reopened with a stronger threshold;
- `confirm`: affected members must explicitly approve the change.

### 1.2 Main technologies

| Layer | Technology | Responsibility |
| --- | --- | --- |
| Public frontend | React, Vinext, Vite, TypeScript/JavaScript | Marketing pages, login, signup, and the `/trip` host shell |
| Trip workspace | React and Vite | Logged-in trip planning, preferences, itinerary, AI drawer, voting, and updates |
| Backend | Python 3.13, FastAPI, SQLAlchemy | Authentication, trip data, constraints, decision routing, itinerary generation, and AI coordination |
| Database | PostgreSQL | Users, memberships, trips, preferences, plans, decisions, and change history |
| Cloud runtime | AWS ECS Fargate | Runs frontend and backend containers |
| Container registry | AWS ECR | Stores deployable frontend and backend images |
| Public routing | AWS ALB, ACM, Aliyun DNS | HTTPS termination and path-based request routing |
| Monitoring | Amazon CloudWatch and ECS service events | Container logs, service status, and deployment diagnostics |
| External services | DeepSeek, Geoapify, Unsplash | AI assistance, place information, and trip cover images |

### 1.3 Primary URLs

| Purpose | URL | Expected result |
| --- | --- | --- |
| Public application | <https://app.cadensy.top> | HTTP 200 and homepage renders |
| Login | <https://app.cadensy.top/login> | HTTP 200 and login form renders |
| Trip shell | <https://app.cadensy.top/trip> | Logged-in workspace shell or login redirect |
| Backend health | <https://app.cadensy.top/api/health> | `{"ok":true}` |
| Local frontend | <http://localhost:3000> | Local public site |
| Local Trip workspace | <http://localhost:5173> | Standalone workspace development server |
| Local backend | <http://127.0.0.1:8000> | FastAPI server |
| Local API documentation | <http://127.0.0.1:8000/docs> | Swagger/OpenAPI documentation |

---

## 2. Production Support and Testing Scenarios

### 2.1 Service dependency diagram

```mermaid
flowchart LR
    U["User browser"] -->|HTTPS| DNS["Aliyun DNS\napp.cadensy.top"]
    DNS --> ALB["AWS Application Load Balancer\nTLS certificate from ACM"]
    ALB -->|"/, /login, /trip, static assets"| FE["Frontend ECS Fargate service\nPort 3000"]
    ALB -->|"/api/*"| BE["Backend ECS Fargate service\nFastAPI, port 8000"]
    FE -->|REST/JSON| BE
    BE -->|PostgreSQL 5432| DB["Private AWS RDS PostgreSQL"]
    BE -->|AI requests| AI["DeepSeek API"]
    BE -->|Place search| GEO["Geoapify API"]
    BE -->|Trip cover search| IMG["Unsplash API"]
    FE --> FLOG["CloudWatch\n/ecs/tripsync-frontend"]
    BE --> BLOG["CloudWatch\n/ecs/tripsync-backend"]
    SSM["AWS Systems Manager\nParameter Store"] -->|Runtime secrets| BE
```

### 2.2 Monitoring and health checks

| Component | Monitoring location | Healthy condition | First diagnostic action |
| --- | --- | --- | --- |
| Public frontend | Browser, ALB target group, frontend CloudWatch logs | Homepage returns 200 and frontend target is healthy | Open `/`, then inspect `/ecs/tripsync-frontend` |
| Backend | `/api/health`, backend target group, backend CloudWatch logs | Health endpoint returns `{"ok":true}` | Open health endpoint, then inspect `/ecs/tripsync-backend` |
| ECS frontend service | AWS ECS console | Running task count equals desired count | Review service events and stopped-task reason |
| ECS backend service | AWS ECS console | Running task count equals desired count | Review service events, health check failures, and task logs |
| ALB | EC2 Load Balancers and Target Groups | HTTPS listener active and both target groups healthy | Check listener rules and unhealthy-target reason |
| PostgreSQL RDS | RDS console and backend logs | Backend can authenticate and execute trip queries | Inspect backend connection error and RDS status |
| AI provider | Backend CloudWatch logs and controlled test request | Valid structured response or safe fallback | Confirm runtime configuration and SSM parameter injection |
| Geoapify | Backend logs and place cache | Valid candidates or safe cache fallback | Check API response, quota, and cached `place` rows |
| Unsplash | Backend logs and Trip cover result | Provider image with attribution or neutral fallback | Check API key, rate limit, and cached cover result |
| GitHub Actions | Repository Actions page | Validation/deployment workflow completes successfully | Open failed job and identify the first failing step |

### 2.3 Important log and console locations

- Backend CloudWatch log group: `/ecs/tripsync-backend`
- Frontend CloudWatch log group: `/ecs/tripsync-frontend`
- ECS cluster: `tripsync-cluster`
- Backend service: `tripsync-backend-service`
- Frontend service: `tripsync-frontend-service`
- Backend target group: `tripsync-backend-tg`
- Frontend target group: `tripsync-frontend-tg`
- Load balancer: `tripsync-backend-alb`
- Region: `us-east-1`

### 2.4 Production support triage sequence

When a user reports that Cadensy is unavailable or behaving incorrectly:

1. Reproduce the user-visible symptom and record the exact URL, account type, trip, time, and browser.
2. Check `https://app.cadensy.top/api/health`.
3. Check the frontend page independently from the API.
4. Inspect ALB target health and listener rules.
5. Inspect ECS service events and running/desired task counts.
6. Inspect the relevant CloudWatch log group using the incident timestamp.
7. Determine whether the failure is frontend, backend, database, or external-provider related.
8. Apply the smallest recovery step.
9. Run post-recovery smoke tests.
10. Record the incident, root cause, resolution, verification, and prevention action.

### 2.5 Common incidents and recovery steps

#### Incident A: Backend health check fails

**Symptoms**

- `/api/health` returns 5xx, times out, or cannot connect.
- ALB marks backend targets unhealthy.
- Login and Trip workspace API requests fail.

**Diagnosis**

1. Check backend ECS desired and running task counts.
2. Review backend service events.
3. Review stopped-task reasons.
4. Inspect `/ecs/tripsync-backend` logs.
5. Confirm container port 8000 and ALB health path `/api/health`.

**Recovery**

1. If the current deployment is unhealthy, redeploy the last known-good task definition.
2. If the task cannot start, fix the missing runtime variable, secret, image, or network permission.
3. Force a new ECS deployment only after the configuration is corrected.

**Verification**

- `/api/health` returns `{"ok":true}`.
- Backend target group reports healthy.
- Login request reaches the backend.

#### Incident B: Database connection is lost

**Symptoms**

- Backend starts but database-backed endpoints return 500.
- Logs contain connection timeout, authentication, DNS, or missing-relation errors.

**Diagnosis**

1. Confirm the RDS instance is available.
2. Confirm the backend task uses the intended `DATABASE_URL`.
3. Confirm the backend security group can reach the RDS security group on port 5432.
4. Distinguish connection failure from missing schema or missing seed data.

**Recovery**

1. Restore network access or the correct database URL.
2. Apply the approved additive schema initialization if relations are missing.
3. Do not run destructive demo seed commands against shared or production databases.

**Verification**

- Health endpoint remains healthy.
- Login and one authenticated trip read succeed.
- Backend logs no longer show connection errors.

#### Incident C: ECS service crashes or deployment does not stabilize

**Symptoms**

- Running count never reaches desired count.
- Tasks repeatedly start and stop.
- Deployment circuit breaker reports failure.

**Diagnosis**

1. Review ECS service events.
2. Review stopped-task exit code and reason.
3. Confirm the image exists in ECR.
4. Confirm task execution role access to ECR, SSM, and CloudWatch.
5. Check CPU, memory, port, and health-check configuration.

**Recovery**

1. Roll back to the previous task definition revision or image tag.
2. Correct the task configuration in a new revision.
3. Redeploy and wait for service stability.

**Verification**

- Desired and running counts match.
- Target group is healthy.
- Public smoke tests pass.

#### Incident D: Login reports invalid email or password

**Symptoms**

- Backend is healthy, but local demo login fails.

**Diagnosis**

1. Confirm the frontend is calling the correct backend.
2. Confirm the runtime database contains the demo account.
3. Confirm the account has a valid password hash and trip membership.

**Recovery**

For an approved local/demo database only:

```bash
cd backend
.venv/bin/python -m app.db.seed
```

If existing local rows must be preserved:

```bash
cd backend
.venv/bin/python -m app.db.enable_auth
```

Never execute destructive seed against production RDS.

#### Incident E: `/trip` shows an old or incorrect UI

**Symptoms**

- Source code changed under `trip/`, but the main application still displays an older workspace.

**Cause**

The main frontend embeds the generated Trip build from `frontend/public/trip-app/`. Editing `trip/src/` does not automatically refresh the embedded copy.

**Recovery**

```bash
cd frontend
npm run build:trip-preview
```

Then rebuild or restart the frontend.

**Verification**

- `frontend/public/trip-app/embed-manifest.json` reflects the new build.
- `/trip-app/index.html#/` loads the updated workspace.

#### Incident F: AI provider fails

**Symptoms**

- AI replies fail, time out, or return a safe fallback.
- Backend logs report missing or invalid provider configuration.

**Diagnosis**

1. Check backend logs without printing secret values.
2. Confirm provider variables exist in the ECS task definition.
3. Confirm SSM parameters are present and the execution role can read them.
4. Confirm the external provider is reachable.

**Recovery**

- Restore the approved provider configuration.
- For local development and automated tests, set `MOCK_AI=1`.
- Core voting and decision logic must continue to operate when AI is unavailable.

#### Incident G: Guest invitation succeeds, then trip read returns 401

**Symptoms**

- Guest appears to join, but the next authenticated trip request returns `401 Login required`.

**Known cause**

The deployed backend runtime must preserve the guest-compatible membership-header configuration used by the current product.

**Recovery**

1. Check the backend task definition runtime configuration.
2. Restore the current approved value for `DEV_ALLOW_MEMBERSHIP_HEADER`.
3. Redeploy the backend task definition.
4. Re-test the entire invite-preview, join, and trip-read sequence.

### 2.6 Testing strategy

| Test type | Purpose | Main implementation |
| --- | --- | --- |
| Unit | Validate deterministic rules and pure behavior | Backend pytest and frontend Node tests |
| Integration | Validate API, PostgreSQL, session, embedded workspace, and shared contracts | FastAPI `TestClient`, PostgreSQL test database, frontend integration tests |
| End-to-end | Validate the deployed public browser path | Playwright public AWS E2E workflow |
| Manual | Validate full user workflows and visual behavior | Browser test cases below |
| Smoke | Validate critical services immediately after deployment | Public URL, login, Trip shell, and health endpoint |

### 2.7 Current and historical test evidence

Results are separated by date so historical evidence is not presented as a current run.

| Run | Date | Scope | Expected | Actual | Result |
| --- | --- | --- | --- | --- | --- |
| SMK-20260825-01 | 2026-08-25 | Production homepage | HTTP 200 and Cadensy page renders | HTTP 200; browser title `CADENSY - Plan a trip everyone can agree on` | Pass |
| SMK-20260825-02 | 2026-08-25 | Production login page | HTTP 200 with visible login controls | HTTP 200; `Welcome back` heading and email input visible | Pass |
| SMK-20260825-03 | 2026-08-25 | Production `/api/health` | `{"ok":true}` | `{"ok":true}` | Pass |
| SMK-20260825-04 | 2026-08-25 | Production Trip host and embedded entry | Host uses `/trip-app/index.html#/`; static entry returns 200 | Exact iframe source confirmed; entry returned 200 | Pass |
| FE-NPM-20260825 | 2026-08-25 | Repository `npm test` script | Build succeeds and configured tests pass | Build passed; 13 tests passed; 0 failed | Pass |
| FE-FULL-20260825 | 2026-08-25 | All `frontend/tests/*.test.mjs` files | All 141 pass | 134 passed, 7 failed | Fail - source-characterization assertions require reconciliation |
| BE-UNIT-20260825 | 2026-08-25 | Pure backend unit selection (`engine`, `planner`, `agents_base`, `api_config`) | All selected unit tests pass | 48 passed in 0.33s | Pass |
| BE-INT-20260825 | 2026-08-25 | Auth, invites, plan generation, and decision-path integration selection | All selected integration tests pass against isolated PostgreSQL | 89 passed in 2.12s | Pass |
| BE-FULL-20260825 | 2026-08-25 | Full backend pytest suite against isolated PostgreSQL | All tests pass | 417 passed, 5 failed | Fail - see Section 2.7.1 |
| E2E-LOCAL-20260825 | 2026-08-25 | Current public Playwright script on this workstation | Chromium launches and public E2E completes | Test could not start because Playwright Chromium is not installed locally | Environment-blocked; no product verdict |
| BE-HIST-FOCUSED | 2026-08-16 | Historical overlap/conflict/replacement focused suite | Focused cases pass | 152 passed | Historical pass |
| FE-HIST-PREVIEW | 2026-08-20 | Embedded Trip integration | Integration cases pass | 10 passed | Historical pass |
| E2E-HIST-AWS | 2026-08-10 | Public AWS browser E2E | Public pages, Trip shell, embedded app, and health endpoint render | Workflow succeeded and screenshots were uploaded | Historical pass |

All current local test commands were executed against reviewed commit `9deb165d63c154b735f3eb589fac4e856eb13c86`. The production smoke checks were repeated on August 25, 2026. The historical public E2E evidence is available from [GitHub Actions run 31355307955](https://github.com/shnnzdx/cap_stone/actions/runs/31355307955).

#### 2.7.1 Current failing regression groups

The remaining failures are reported transparently. They are primarily characterization or legacy contract mismatches rather than failures of the primary production workflow. The configured frontend test suite passes, selected backend unit and integration tests pass, production smoke checks pass, and the manual critical-path workflows pass.

Backend full-suite failures:

- three assertions concern organizer deadlock resolution and whether `clear` converts an item to `Free time`;
- one assertion expects the proposal member response without the newer `is_me` field;
- one assertion expects the older compact proposal-decision response rather than the current expanded proposal payload.

Disposition: accepted as documented regression differences for this submission. The affected assertions should be reconciled with the current backend decision-contract design before claiming a completely green backend suite.

Frontend full-regression failures:

- two Plan assistant-flow characterization assertions no longer match the current implementation shape;
- five session/navigation characterization or cutover assertions expect older source-level patterns.

Disposition: accepted as documented characterization differences for this submission. The repository's default `npm test` command is green, but it intentionally runs the production build plus three configured test files. The 141-test command is a broader source-characterization run and is reported separately.

### 2.8 Unit and integration test cases

| ID | Type | Scenario | Expected result | Evidence/status |
| --- | --- | --- | --- | --- |
| UT-01 | Unit | Untouched, conflict-free itinerary change | Decision path is `notice` | Pass in current 48-test unit selection (`test_engine.py`) |
| UT-02 | Unit | Booked item changes | Decision path is `confirm` | Pass in current unit selection (`test_engine.py`) |
| UT-03 | Unit | Private constraint findings | No member identity or raw wording is returned | Pass in current unit selection/privacy coverage |
| UT-04 | Unit | Invalid planner candidate | Candidate outside the supplied set is rejected | Pass in current unit selection (`test_planner.py`) |
| UT-05 | Unit | AI provider unavailable | Deterministic fallback preserves core behavior | Pass in current unit selection |
| IT-01 | Integration | Login and bearer session | Valid account receives a usable session | Pass in current 89-test integration selection (`test_auth.py`) |
| IT-02 | Integration | Create trip | Creator becomes organizer and receives an empty plan | Covered by full suite; related current cases pass |
| IT-03 | Integration | Guest invitation | Guest membership is created only after explicit join | Pass in current integration selection (`test_invites.py`) |
| IT-04 | Integration | Plan generation | Generated items satisfy required constraints | Pass in current integration selection (`test_plan_generation.py`) |
| IT-05 | Integration | Embedded Trip preview | Host and workspace share the expected route contract | Pass in current `npm test` run |
| IT-06 | Integration | Vote settlement | A round settles according to backend rules | Pass in current integration selection (`test_paths.py`) |

### 2.9 Manual test cases

These cases were executed against the final build. Representative screenshots are included in the System Usage Guide.

| ID | Workflow | Steps | Expected result | Actual result | Status |
| --- | --- | --- | --- | --- | --- |
| MAN-01 | Production access | Open the production URL | Homepage loads without browser error | HTTP 200; Cadensy title and homepage content visible on 2026-08-25 | Pass |
| MAN-02 | Login page | Open `/login` | Login form is visible | HTTP 200; heading and email input visible on 2026-08-25; credential submission not performed | Pass for page rendering |
| MAN-03 | Account login | Enter the approved test account | User reaches My Trips | User was redirected to My Trips after signing in on 2026-08-25 | Pass |
| MAN-04 | Create trip | Create a named trip with destination and dates | Trip appears in My Trips | New trip appeared in My Trips with the configured destination and dates | Pass |
| MAN-05 | Save preferences | Enter dates, budget, interests, and constraints | Preferences persist and Plan shows refresh state if needed | Preferences were saved, reloaded, and remained visible after navigation | Pass |
| MAN-06 | Generate itinerary | Select Generate after submitting preferences | Valid itinerary appears or an honest blocked reason is shown | A valid multi-day itinerary was displayed after generation completed | Pass |
| MAN-07 | AI change request | Request a time or place change | Assistant explains the change and requires explicit Apply | Cadensy displayed change alternatives and required review before applying | Pass |
| MAN-08 | Group decision | Submit a contested change and vote | Correct round/confirm workflow is shown | Contested change opened the expected voting/confirmation workflow | Pass |
| MAN-09 | Invite guest | Create and open an invite link | Preview loads, explicit join creates membership, Trip opens | Invite preview loaded, explicit join created membership, and Trip opened | Pass |
| MAN-10 | Logout | Select logout | Session clears and protected routes no longer expose trip data | Logout cleared the session and protected trip routes were no longer accessible | Pass |

### 2.9.1 End-to-end browser scenarios

The current Playwright script covers the unauthenticated production delivery path, including public pages, the Trip host shell, and the health endpoint. Authenticated workflows were validated manually using the approved production test account.

| ID | End-to-end scenario | Expected result | Current evidence |
| --- | --- | --- | --- |
| E2E-01 | Open `/` in Chromium | Cadensy title, login link, and homepage content render without blocking same-origin failures | Historical AWS Playwright pass; current browser smoke pass on 2026-08-25 |
| E2E-02 | Open `/login` | Welcome heading and email field are visible | Historical AWS Playwright pass; current browser smoke pass on 2026-08-25 |
| E2E-03 | Open `/trip` | Host renders iframe with exact source `/trip-app/index.html#/` | Historical AWS Playwright pass; current browser smoke pass on 2026-08-25 |
| E2E-04 | Open embedded Trip entry while unauthenticated | Workspace renders a safe unauthenticated state and sign-in action | Historical AWS Playwright pass |
| E2E-05 | Request `/api/health` from the browser test | Status 200 and JSON `{"ok":true}` | Historical AWS Playwright pass; current HTTP smoke pass on 2026-08-25 |
| E2E-06 | Login, create trip, save preferences, generate plan | Authenticated user completes the primary planning workflow | Manual authenticated validation completed on 2026-08-25; pass |
| E2E-07 | Invite another member and join | Preview does not create membership; explicit join opens the trip | Manual authenticated validation completed on 2026-08-25; pass |
| E2E-08 | Submit contested or protected change | Backend produces the correct round or confirmation workflow | Manual authenticated validation completed on 2026-08-25; pass |

### 2.10 Post-deployment smoke tests

Run immediately after every frontend or backend deployment:

1. `GET https://app.cadensy.top` returns 200.
2. `GET https://app.cadensy.top/login` returns 200.
3. `GET https://app.cadensy.top/api/health` returns `{"ok":true}`.
4. Open `/trip` and confirm the embedded workspace entry is reachable.
5. Log in with an approved test account.
6. Open one existing trip and load its Current Plan.
7. Confirm one database-backed read succeeds.
8. Perform one controlled AI request or verify the safe fallback.
9. Review frontend and backend CloudWatch logs for new errors.
10. Confirm both ALB target groups remain healthy.

---

## 3. System Setup Instructions

### 3.1 Prerequisites

Install the following before cloning the repository:

- Git;
- Node.js `22.13.0` or newer;
- npm;
- Python `3.13`;
- PostgreSQL 16 or newer;
- Docker only if building container images locally;
- an AWS account and approved project permissions only for cloud deployment.

Check versions:

```bash
git --version
node --version
npm --version
python3 --version
psql --version
```

### 3.2 Clone the repository

```bash
git clone https://github.com/shnnzdx/cap_stone.git
cd cap_stone
```

Validation:

```bash
git status
```

The working tree should be on the expected branch with no unexplained changes.

### 3.3 Database setup

Start PostgreSQL and confirm it accepts connections:

```bash
pg_isready -h localhost -p 5432
```

Expected result:

```text
localhost:5432 - accepting connections
```

Create separate runtime and test databases:

```bash
createdb tripsync
createdb tripsync_test
```

If PostgreSQL requires password authentication, either create a local role for development or replace the username and password in both connection URLs with the credentials created by your PostgreSQL administrator. Do not copy a teammate's machine-specific password into this document.

Important rules:

- `tripsync_test` must be disposable and used only by pytest.
- `TEST_DATABASE_URL` must never point to production or shared data.
- `DATABASE_URL` and `TEST_DATABASE_URL` must not identify the same database.

### 3.4 Backend installation - macOS/Linux

```bash
cd backend
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
cp .env.example .env
```

### 3.5 Backend installation - Windows PowerShell

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
```

If `python` is unavailable on `PATH`, create the environment once with the full path to the installed interpreter. After the environment exists, use `.venv`'s Python for every backend command.

### 3.6 Backend environment configuration

Edit `backend/.env`. Use local-only values and never commit the file.

```env
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/tripsync
TEST_DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/tripsync_test
MOCK_AI=1
DISABLE_SCHEDULER=0
SETTLE_TICK_SECONDS=60
DEV_ALLOW_MEMBERSHIP_HEADER=1
FRONTEND_BASE_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
GEOAPIFY_API_KEY=
UNSPLASH_ACCESS_KEY=
```

| Variable | Purpose | Local recommendation | Production handling |
| --- | --- | --- | --- |
| `DATABASE_URL` | Runtime PostgreSQL database | Local `tripsync` | ECS runtime secret/config pointing to private RDS |
| `TEST_DATABASE_URL` | Disposable test database | Local `tripsync_test` | GitHub Actions service database |
| `MOCK_AI` | Avoid paid AI calls | `1` for development and tests | Set according to approved runtime mode |
| `DEEPSEEK_API_KEY` | AI provider credential | Leave empty in mock mode | AWS SSM Parameter Store |
| `GEOAPIFY_API_KEY` | Place provider credential | Optional | AWS SSM Parameter Store |
| `UNSPLASH_ACCESS_KEY` | Trip cover provider credential | Optional | AWS SSM Parameter Store |
| `CORS_ORIGINS` | Allowed browser origins | Localhost origins | Production domain only, plus approved exceptions |
| `DEV_ALLOW_MEMBERSHIP_HEADER` | Current guest membership compatibility | `1` in current development model | Preserve the approved deployed value |

### 3.7 Initialize schema and demo data

For an approved local database:

```bash
cd backend
.venv/bin/python -m app.db.init_schema
.venv/bin/python -m app.db.seed
```

Default local demo account:

```text
Email: organizer@cadensy.local
Password: 12345678
```

This account is for local/demo testing. Production test credentials should be distributed privately by the team instead of committed to a public repository.

### 3.8 Start the backend

macOS/Linux:

```bash
cd backend
.venv/bin/python -m uvicorn app.api.main:app --host 127.0.0.1 --port 8000 --reload
```

Windows PowerShell:

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.api.main:app --host 127.0.0.1 --port 8000 --reload
```

Validation:

```bash
curl http://127.0.0.1:8000/api/health
```

Expected response:

```json
{"ok": true}
```

### 3.9 Install and run the public frontend

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:3000>.

Validation:

- homepage renders;
- `/login` renders;
- browser console has no blocking error;
- login reaches the backend when the backend is running.

### 3.10 Install and run the Trip workspace

```bash
cd trip
npm install
npm run dev
```

Open <http://localhost:5173>.

### 3.11 Build and synchronize the embedded Trip workspace

After changing `trip/` source:

```bash
cd frontend
npm run build:trip-preview
```

The command should:

1. build `trip/`;
2. copy `trip/dist/` into `frontend/public/trip-app/`;
3. write `frontend/public/trip-app/embed-manifest.json`.

### 3.12 Run tests

Backend, using a confirmed isolated test database:

```bash
cd backend
DISABLE_SCHEDULER=1 MOCK_AI=1 .venv/bin/python -m pytest -q
```

Frontend:

```bash
cd frontend
npm test
```

Trip build:

```bash
cd trip
npm run build
```

Embedded integration check:

```bash
cd frontend
node --test tests/trip-preview-integration.test.mjs
```

### 3.13 Production builds

```bash
cd trip
npm run build

cd ../frontend
npm run build:trip-preview
npm run build
```

Backend container:

```bash
cd backend
docker build -t tripsync-backend:local .
```

### 3.14 Deployment overview

The project uses GitHub Actions to:

1. check out the repository;
2. install frontend and backend dependencies;
3. run validation;
4. build Docker images;
5. push images to ECR;
6. register or update ECS task definitions;
7. update ECS services;
8. wait for service stability;
9. validate the public health endpoint.

Cloud deployment is restricted to approved workflows and the `main` release branch. Do not manually paste secret values into workflow files or documentation.

#### 3.14.1 Existing AWS production resources

The current production environment already contains:

| Resource | Current name or role |
| --- | --- |
| VPC | `tripsync-vpc` |
| ECS cluster | `tripsync-cluster` |
| Frontend service/task family | `tripsync-frontend-service` / `tripsync-frontend` |
| Backend service/task family | `tripsync-backend-service` / `tripsync-backend` |
| ECR repositories | `tripsync-frontend`, `tripsync-backend` |
| ALB | `tripsync-backend-alb` |
| Target groups | `tripsync-frontend-tg`, `tripsync-backend-tg` |
| Database | Private RDS PostgreSQL instance `tripsync-postgres` |
| Secret/configuration store | AWS Systems Manager Parameter Store |
| Certificate | AWS ACM certificate for `app.cadensy.top` |
| DNS | Aliyun-managed CNAME for `app.cadensy.top` |

#### 3.14.2 Production deployment procedure

1. Merge the approved release commit into `main`; current cloud workflows reject other branches.
2. Run **Build Validation** and confirm the frontend build, configured frontend tests, backend tests, and container health job.
3. For a frontend release, manually dispatch the current frontend ECS provisioning/deployment workflow documented under `.github/workflows/phase8-frontend-provision.yml`.
4. For a backend release, use the approved backend provisioning/runtime workflow documented in `AWS/README.md`; preserve the current AI and guest-access runtime settings.
5. Confirm the workflow builds Docker images, pushes them to ECR, registers a new task definition revision, updates the ECS service, and waits for stability.
6. Verify desired and running task counts, ALB target health, and CloudWatch logs.
7. Run the post-deployment smoke tests in Section 2.10.
8. Record the commit, workflow run URL, ECR image identifier, task definition revision, operator, and smoke-test result.

The custom domain is managed in Aliyun rather than Route 53. Do not blindly dispatch the Route-53-oriented Phase 10 workflow for `app.cadensy.top`.

#### 3.14.3 Required secret names

Production values must remain in GitHub Secrets/Variables, ECS task configuration, or SSM. Relevant configuration names include `DATABASE_URL`, `DEEPSEEK_API_KEY`, `GEOAPIFY_API_KEY`, `UNSPLASH_ACCESS_KEY`, `CORS_ORIGINS`, `FRONTEND_BASE_URL`, `MOCK_AI`, and `DEV_ALLOW_MEMBERSHIP_HEADER`. The documentation intentionally records names but never secret values.

### 3.15 Setup validation checklist

- [ ] PostgreSQL accepts local connections.
- [ ] Runtime and test databases are separate.
- [ ] `backend/.env` exists and is not tracked by Git.
- [ ] Backend health endpoint returns `{"ok":true}`.
- [ ] Local homepage loads.
- [ ] Local login reaches the backend.
- [ ] Demo account can authenticate after safe local seed/auth setup.
- [ ] Trip workspace loads.
- [ ] Embedded Trip preview has been rebuilt.
- [ ] Backend and frontend validation results are recorded.
- [ ] No real credentials appear in `git diff`.

---

## 4. Issue Diagnosis, Research, Resolution, and Sharing

### 4.1 Issue 1 - Embedded Trip returned 404 after AWS deployment

**Description**

The deployed `/trip` shell loaded, but its embedded workspace resolved to the frontend 404 route.

**Expected behavior**

The Trip iframe should load the standalone workspace entry and render its initial state.

**Actual behavior**

The iframe used `/trip-app/#/`, which did not resolve to the static `index.html` entry under the deployed frontend runtime.

**Environment**

- AWS ECS frontend behind ALB;
- Vinext/React frontend;
- embedded Vite Trip workspace;
- public E2E workflow, August 10, 2026.

**Steps to reproduce**

1. Deploy the frontend image.
2. Open the public `/trip` route.
3. Inspect the iframe source.
4. Observe that `/trip-app/#/` reaches the frontend 404 path.

**Diagnosis**

The host shell used an incomplete static path. The deployed environment required an explicit static entry document before the hash route.

**Research process**

- Reviewed the deployed browser route and iframe source.
- Compared the host route with the generated Trip build output.
- Used the public Playwright workflow to prove the failure and later the fix.
- Consulted Vite static deployment guidance: <https://vite.dev/guide/static-deploy.html>.

**Resolution**

Changed the shared embedded entry to:

```text
/trip-app/index.html#/
```

Rebuilt and redeployed the frontend.

**Outcome verification**

The Phase 9 public E2E workflow confirmed that `/trip`, the iframe source, `/trip-app/index.html`, and the backend health endpoint were reachable.

**Prevention**

Keep a shared preview contract and an integration test that verifies the exact iframe entry path.

### 4.2 Issue 2 - Backend Chat Agent worked, but frontend options were unusable

**Description**

The backend returned Chat Agent V1 payloads, including candidate options, but the real Trip chat surfaces appeared broken.

**Expected behavior**

Candidate options should remain available across turns, render in the drawer, be reclassified by the backend, and apply only after explicit user action.

**Actual behavior**

Frontend history preserved only `{role, text}`, discarded `candidate_options`, and did not forward alternatives into the final change request.

**Environment**

- Trip React workspace;
- FastAPI Chat Agent endpoint;
- embedded workspace build;
- local validation on August 15, 2026.

**Steps to reproduce**

1. Select a Plan item.
2. Ask for a fuzzy replacement or time change.
3. Receive a backend response with candidate options.
4. Attempt to select or apply a follow-up option.
5. Observe that the frontend has flattened the response.

**Diagnosis**

The backend protocol had been restored, but the frontend remained partly coupled to an older simplified response shape.

**Research process**

- Compared the actual backend JSON response with frontend message state.
- Traced `candidate_options` through the drawer hook, Trip state, and change submission API.
- Added a red/green source-level validation loop before implementation.
- Re-ran the characterization test and embedded preview build.

**Resolution**

- Preserved candidate options in assistant history.
- Rendered candidate option cards.
- Reclassified selected options through the backend.
- Forwarded alternatives into the authoritative change submission path.
- Rebuilt the embedded Trip preview.

**Outcome verification**

The targeted validation turned green, 12 characterization tests passed at the time of the repair, and the embedded workspace build completed.

**Prevention**

Treat the backend response schema as a contract and test every consumer, not only the endpoint.

### 4.3 Issue 3 - Missing duration disabled overlap detection

**Description**

Generated Plan items usually had `duration_min = NULL`. Some decision and replacement paths treated the missing value differently from the planner.

**Expected behavior**

Time overlap checks should operate consistently even when the provider does not supply a duration.

**Actual behavior**

Overlap checks skipped items without duration. A change could be classified as `notice` even when it placed two activities at the same time.

**Environment**

- FastAPI/SQLAlchemy backend;
- generated itineraries using Geoapify place data;
- local PostgreSQL test data;
- diagnosis dated August 16, 2026.

**Steps to reproduce**

1. Generate an itinerary whose Plan items have no stored duration.
2. Move one item to the start time of another item.
3. Classify the change.
4. Observe an incorrect conflict-free result in the old behavior.

**Diagnosis**

The planner assumed 90 minutes when duration was missing, but overlap detection and replacement search did not use the same fallback.

**Research process**

- Queried generated plans and measured the missing-duration rate.
- Traced duration from provider candidate to generator, safe agent payload, conflict classification, and replacement search.
- Reproduced the before/after classification using a real local trip.

**Resolution**

- Introduced a shared 90-minute default block for affected scheduling checks.
- Reported calculated end time and `duration_assumed=true` without falsifying the stored provider fact.
- Allowed replacement search to use the same fallback.

**Outcome verification**

The conflicting move changed from `notice` to `round`, and replacement search returned valid nearby candidates. A focused historical suite reported 152 passing tests.

**Prevention**

Document estimated values separately from verified provider facts and keep scheduling assumptions consistent across all decision paths.

### 4.4 Issue 4 - Python date could not be persisted in JSONB change history

**Description**

Moving a Plan item to another day returned a backend 500 error.

**Expected behavior**

The change should update the item's day and append a valid JSON-safe change record.

**Actual behavior**

A Python `date` object was passed into a JSONB payload and failed serialization.

**Environment**

- FastAPI;
- SQLAlchemy;
- PostgreSQL JSONB change ledger;
- local Trip workspace.

**Steps to reproduce**

1. Open a trip with an existing itinerary.
2. Move an activity to another date.
3. Submit the change.
4. Observe a 500 response and backend serialization traceback.

**Diagnosis**

The API/domain path preserved a Python date object instead of converting it to a JSON-compatible ISO string before writing the change ledger.

**Research process**

- Inspected the backend traceback rather than relying on the frontend's generic network message.
- Traced the submitted patch into the JSONB change payload.
- Reviewed SQLAlchemy PostgreSQL JSON/JSONB behavior: <https://docs.sqlalchemy.org/en/20/dialects/postgresql.html#json-types>.

**Resolution**

Normalized the date field into a JSON-safe representation before writing the append-only change record and aligned the day index with the trip date window.

**Outcome verification**

Regression tests were added for JSON-safe plan changes, day movement, and canonical day-date reporting.

**Prevention**

Validate every value written into JSON/JSONB at the domain boundary and keep regression tests for date-bearing patches.

### 4.5 Issue 5 - Guest invite flow returned 401 after join

**Description**

A guest could appear to join a trip but receive `401 Login required` on the next trip read.

**Expected behavior**

An accepted guest invite should produce a usable guest-backed membership session.

**Actual behavior**

The deployed backend runtime no longer accepted the current membership-header compatibility path.

**Environment**

- AWS ECS backend runtime;
- guest invitation flow;
- shared session runtime;
- production cloud configuration.

**Steps to reproduce**

1. Open a valid invitation as a guest.
2. Complete the explicit join action.
3. Request the joined trip.
4. Observe the 401 response.

**Diagnosis**

Application behavior and backend runtime configuration were inconsistent. The current guest product path depended on the approved membership-header compatibility setting.

**Research process**

- Compared successful local guest behavior with production runtime behavior.
- Reviewed request identity headers and the ECS task definition.
- Used CloudWatch/backend response evidence to distinguish authentication configuration from invitation data corruption.

**Resolution**

Restored the approved backend runtime setting and redeployed the backend service.

**Outcome verification**

The cloud runtime repair completed successfully, and regression coverage now checks that the runtime workflows preserve guest access.

**Prevention**

Add a post-deployment guest invite smoke test and treat guest-auth runtime flags as release-critical configuration.

### 4.6 Issue-sharing standard

Every future major issue should be recorded with:

- timestamp and environment;
- user-visible symptom;
- expected and actual behavior;
- exact reproduction steps;
- logs or error response;
- root-cause interpretation;
- sources consulted;
- final resolution;
- verification evidence;
- follow-up test or prevention measure.

Do not publish secret values, raw private preference wording, or production database content in issue reports.

---

## 5. System Usage Guide

This section is written for end users rather than developers.

The figures in this section illustrate the main user workflows from opening a trip through reviewing plans, requesting changes, and making group decisions.

### 5.1 Access the application

1. Open <https://app.cadensy.top> in a modern desktop browser.
2. Select **Log in**.
3. Enter the approved test-account credentials supplied by the project team.
4. After login, the application opens **My Trips**.

For local classroom testing, the seeded demo account is:

```text
Email: organizer@cadensy.local
Password: 12345678
```

Do not reuse this public demo password for a real personal account.

### 5.2 View My Trips

My Trips displays the trips associated with the signed-in account.

![My Trips dashboard](assets/figure-1-my-trips-dashboard.png)
*Figure 1. My Trips dashboard*

Users can review active and past trip workspaces from this dashboard. The page helps users quickly return to the trip that needs attention or start a new planning session.

1. Select a trip card to open its workspace.
2. Review the destination, dates, next activity, and current planning status.
3. If no trip exists, select **Create Trip**.

### 5.3 Create a trip

1. Select **Create Trip**.
2. Enter a trip name.
3. Enter the destination.
4. Choose the start and end dates.
5. Enter the expected group size and other requested details.
6. Submit the form.

Expected result: the new trip appears in My Trips and opens with an empty Current Plan.

![Create Trip form](assets/figure-2-create-trip-form.png)
*Figure 2. Create Trip form*

The organizer defines the trip name, destination, date window, group size, and planning assumptions on this screen. These details create the shared frame that guests use when adding their own preferences.

### 5.4 Invite members

Only an organizer can create invite links.

1. Open the trip.
2. Select **Invite** or **Members**.
3. Create an invitation link.
4. Share the link with the intended participant.
5. The participant opens the preview and explicitly joins the trip.

An invite preview does not create membership until the person chooses to join.

### 5.5 Enter travel preferences

1. Open **Preferences**.
2. Enter preferred dates and acceptable date range.
3. Enter ideal and maximum budget information.
4. Select interests and travel pace.
5. Add essential needs or supported constraints.
6. Review privacy/visibility choices.
7. Save the preferences.

Important: saving preferences after a plan exists does not silently rewrite the Current Plan. The application marks the plan as needing refresh.

### 5.6 Generate an itinerary

1. Confirm the organizer has submitted preferences.
2. Open **Plan**.
3. Select **Generate Itinerary**.
4. Wait for planning and validation to finish.

Expected outcomes:

- a valid multi-day plan appears; or
- the system explains why generation is blocked.

A blocked result is intentional when required constraints or place data cannot support a valid plan.

### 5.7 Review the Current Plan

![Current Plan view](assets/figure-3-current-plan-view.png)
*Figure 3. Current Plan view*

The Current Plan gives users a day-by-day itinerary with times, stops, meals, and map context. Users can scan the schedule, focus on a specific day, and review how the trip is organized before making changes.

1. Use day headings to expand or collapse daily schedules.
2. Select an activity to coordinate the list and map.
3. Review activity time, place, category, and available details.
4. Use comments for public coordination.
5. Mark an item booked only when appropriate.

### 5.8 Ask Cadensy for help or request a change

1. Select a Plan item or open the global assistant.
2. Ask a question or describe the desired change.
3. Review Cadensy's explanation and any candidate options.
4. Select an option if alternatives are available.
5. Review the proposed change.
6. Select **Apply** only when ready.

The assistant does not silently mutate the plan. The backend determines whether the request becomes a notice, vote, reopened vote, or confirmation.

![AI-assisted change alternatives](assets/figure-4-ai-change-alternatives.png)
*Figure 4. AI-assisted change alternatives*

Cadensy can draft multiple alternatives for a requested itinerary change and show the possible consequence of each option. These suggestions do not automatically modify the Current Plan; the user reviews the alternatives before proceeding.

### 5.9 Vote or confirm

If the change requires group input:

1. Open the decision card.
2. Review the options and trade-offs.
3. Submit your own vote or confirmation.
4. Do not vote on behalf of another member.

Silence is not recorded as explicit agreement.

![Group decision and voting workflow](assets/figure-5-group-decision-workflow.png)
*Figure 5. Group decision and voting workflow*

When a proposed change affects the shared itinerary or creates a conflict, Cadensy can route it into a structured group decision process. Members review the available options and vote before the shared plan is updated.

### 5.10 Review updates

Open **Updates** to review:

- applied notices;
- open actions;
- vote or confirmation status;
- change history.

The change ledger provides an audit trail showing how the Current Plan changed over time.

### 5.11 Log out

1. Open the account menu.
2. Select **Log out**.
3. Confirm that protected trip information is no longer accessible.

### 5.12 User gotchas

- The application is optimized for small-group, one-city planning.
- Place price, duration, image, or opening-hours data may be unavailable.
- Unknown data is not automatically treated as free, all-day, or verified.
- AI suggestions are checked by deterministic backend rules, but users should still review the final itinerary.
- The system does not complete booking or payment.
- Private wording is not intentionally exposed, but people in a very small group may infer who a constraint belongs to.
- If the AI provider is unavailable, core group-decision behavior should remain usable.

### 5.13 Support contact

For classroom evaluation and project support:

- GitHub repository: <https://github.com/shnnzdx/cap_stone>
- GitHub Issues: <https://github.com/shnnzdx/cap_stone/issues>
- Team contact: GitHub Issues for project defects, plus the course LMS/instructor/TA contact channel for classroom evaluation questions.

---

## 6. Architecture

### 6.1 High-level production architecture

```mermaid
flowchart TB
    subgraph Delivery["Source and delivery"]
        GH["GitHub repository"] --> GHA["GitHub Actions\nvalidation and deployment"]
        GHA --> ECRF["ECR frontend image"]
        GHA --> ECRB["ECR backend image"]
    end

    subgraph Edge["Public edge"]
        USER["User browser"] -->|HTTPS| DNS["Aliyun DNS"]
        DNS --> ACM["ACM certificate + ALB"]
    end

    subgraph AWS["AWS us-east-1"]
        ACM -->|"Default web routes"| FES["Frontend ECS Fargate service"]
        ACM -->|"/api/*"| BES["Backend ECS Fargate service"]
        ECRF --> FES
        ECRB --> BES
        FES -->|REST/JSON| BES
        BES -->|Private network, PostgreSQL 5432| RDS["Private PostgreSQL RDS"]
        SSM["SSM Parameter Store"] --> BES
        FES --> CW1["CloudWatch frontend logs"]
        BES --> CW2["CloudWatch backend logs"]
    end

    BES --> DEEP["DeepSeek"]
    BES --> GEO["Geoapify"]
    BES --> UNS["Unsplash"]
```

### 6.2 Local development architecture

```mermaid
flowchart LR
    B["Browser"] -->|http://localhost:3000| F["Public frontend"]
    B -->|http://localhost:5173| T["Standalone Trip workspace"]
    F -->|Embedded build under /trip-app| TBUILD["Generated Trip static assets"]
    F -->|REST/JSON| API["FastAPI\n127.0.0.1:8000"]
    T -->|REST/JSON| API
    API -->|PostgreSQL 5432| PG["Local PostgreSQL\ntripsync"]
    TEST["pytest"] -->|Disposable database| PGT["Local PostgreSQL\ntripsync_test"]
```

### 6.3 Communication flows

| From | To | Protocol | Purpose |
| --- | --- | --- | --- |
| Browser | ALB | HTTPS 443 | Public web and API access |
| ALB | Frontend ECS | HTTP/container port 3000 | Public routes and static assets |
| ALB | Backend ECS | HTTP/container port 8000 | `/api/*` requests |
| Frontend/Trip | Backend | REST/JSON | Authentication, trips, preferences, plans, decisions |
| Backend | RDS | PostgreSQL 5432 | Persistent application data |
| Backend | DeepSeek | HTTPS | Structured AI assistance |
| Backend | Geoapify | HTTPS | Geocoding and place candidates |
| Backend | Unsplash | HTTPS | Trip cover images and attribution |
| ECS | CloudWatch | AWS logging APIs | Runtime logs and operational evidence |
| ECS execution role | SSM/ECR | AWS APIs | Read secrets and pull images |

### 6.4 Component roles

#### Public frontend

Owns marketing pages, authentication UI, and the shell that embeds the Trip workspace.

#### Trip workspace

Owns the logged-in collaborative experience. It is built separately and copied into the public frontend's static assets.

#### Backend

Owns authoritative membership, privacy, constraints, decision classification, settlement, plan generation, and audit history.

#### Database

Stores identity, trip membership, preferences, constraints, itinerary data, decisions, and append-only plan changes.

#### External AI and data providers

Supply assistance and travel information but do not own core fairness, privacy, or settlement rules.

### 6.5 Environment comparison

| Area | Local development | Production |
| --- | --- | --- |
| Public frontend | localhost:3000 | Frontend ECS behind ALB |
| Trip workspace | localhost:5173 or embedded local build | Embedded in frontend container |
| Backend | 127.0.0.1:8000 | Backend ECS behind `/api/*` routing |
| Database | Local `tripsync` | Private AWS RDS PostgreSQL |
| Test database | Local disposable `tripsync_test` | PostgreSQL service in validation workflow |
| Secrets | Untracked `backend/.env` | AWS SSM and ECS runtime injection |
| Logs | Terminal output | CloudWatch log groups |
| TLS | Usually HTTP | HTTPS with ACM certificate |

### 6.6 Staging status

Cadensy does not currently maintain a separately provisioned staging environment. The current release path uses local development, isolated PostgreSQL test databases, manually dispatched GitHub Actions validation, and then an approved production deployment. This is a documented limitation, not an omitted or hidden environment.

```mermaid
flowchart LR
    LOCAL["Local development\nlocalhost services + local PostgreSQL"] --> CI["Validation environment\nGitHub Actions + disposable PostgreSQL 16"]
    CI --> APPROVAL["Manual release approval\nmain branch only"]
    APPROVAL --> PROD["Production\nAWS ECS + private RDS + ALB"]
    STAGE["Dedicated staging\nNot currently provisioned"] -. future improvement .-> APPROVAL
```

A future staging environment should use separate ECS services, task definitions, database, secrets, domain, and log groups so staging validation cannot mutate production data.

---

## 7. Deployment Pipeline Overview

### 7.1 Pipeline stages

```mermaid
flowchart LR
    C["Approved main commit"] --> V["Build validation"]
    V --> T["Frontend and backend tests"]
    T --> I["Build container images"]
    I --> P["Push images to ECR"]
    P --> D["Register/update ECS task definitions"]
    D --> S["Wait for ECS stability"]
    S --> H["Health and public smoke checks"]
    H --> R["Release evidence recorded"]
```

Current workflows are primarily manually dispatched. Documentation must not claim that every push automatically deploys to production.

### 7.2 Approval controls

- Cloud deployment workflows should run from `main`.
- GitHub environment controls provide a release boundary.
- AWS credentials and provider keys must come from secrets or SSM, not workflow source.
- Production database operations must use approved runbooks/workflows.

### 7.3 Rollback

If a deployment fails:

1. Stop promoting the unhealthy revision.
2. Identify the last known-good ECS task definition and ECR image.
3. Update the ECS service to the previous revision.
4. Wait for service stability.
5. Confirm ALB target health.
6. Run the post-deployment smoke suite.
7. Record the failed revision and root cause.

Do not rely only on a mutable `latest` image tag for rollback evidence.

---

## 8. Security Considerations

### 8.1 Authentication and authorization

- Accounts use backend-controlled authentication and session identity.
- Roles belong to a trip: organizer, participant, or guest.
- Organizer privileges do not increase preference weight.
- Only organizers can create invite links and access organizer-only functions.
- Backend scope checks prevent one trip's identity from reading another trip's data.

### 8.2 Privacy

- Private raw preference wording is stored separately from decision-safe structured data.
- Decision outputs should not expose member identity or private wording.
- AI context must use privacy-safe fields.
- Small-group inference remains possible and is disclosed as a limitation.

### 8.3 Secrets management

- Local secrets belong in ignored `.env` files.
- Production provider credentials belong in AWS SSM or another approved secret store.
- Never print, commit, or paste secret values into documentation.
- ECS execution roles should receive only the permissions needed to read required parameters and images.

### 8.4 Network security

- The public entry point is the ALB over HTTPS.
- RDS is not publicly accessible.
- Backend-to-database access is limited by security groups.
- Browser clients never connect directly to PostgreSQL.

### 8.5 Data and operational safety

- Destructive seed operations are limited to local or explicitly disposable demo databases.
- Test database names are validated to reduce the chance of running pytest against production data.
- The plan-change ledger is append-only to support auditability.
- Core decision behavior remains deterministic when AI is disabled or unavailable.

---

## 9. Known Limitations

- The product currently emphasizes one-city, 2-5 day, small-group trips.
- Live booking, payment, and expense splitting are outside the MVP.
- Multi-city optimization and crisis replanning are outside the current scope.
- Provider data may omit price, duration, image, or opening hours.
- Missing duration may require an explicitly labeled scheduling estimate.
- AI chat memory is primarily local to the active drawer/session rather than a durable long-term conversation store.
- External provider failure may reduce itinerary richness or produce an honest blocked result.
- Seven current frontend characterization/cutover tests expect older implementation shapes and require reconciliation.
- The full backend suite currently reports 417 passed and 5 failed; the remaining failures concern organizer deadlock behavior and proposal response contracts.
- A dedicated staging environment is not currently provisioned.
- The current GitHub Actions validation and deployment workflows are mainly manual rather than continuous on every push.
- Production test account credentials must be supplied securely instead of committed publicly.

---

## 10. Final Submission Validation Checklist

### Documentation

- [x] A single primary document exists under `/docs`.
- [x] Table of Contents is present.
- [x] Production support and dependency diagram are included.
- [x] Monitoring locations and health checks are included.
- [x] Common incidents and recovery steps are included.
- [x] Frontend, backend, and database setup are separated.
- [x] Configuration and environment variables are documented.
- [x] Deployment and validation steps are documented.
- [x] Five major issues use a consistent diagnosis template.
- [x] A non-developer usage guide is included.
- [x] Local and production architecture diagrams are embedded.
- [x] Deployment pipeline and security considerations are included.

### Final submission follow-up items

- [x] Team member names are listed on the title page.
- [x] Support contact section identifies the project issue tracker and course contact channel.
- [x] Run backend pytest against a confirmed isolated `tripsync_test` database (417 passed, 5 failed on 2026-08-25).
- [x] Formally documented and accepted the remaining backend regression differences.
- [x] Formally documented and accepted the remaining frontend characterization differences.
- [ ] Add the final GitHub Actions workflow links for the submission commit.
- [x] MAN-03 through MAN-10 have team-confirmed actual results.
- [x] Added screenshots for My Trips, Create Trip, Current Plan, AI-assisted alternatives, and group voting.
- [ ] Confirm production test credentials are delivered securely to the instructor.
- [ ] Proofread the final GitHub-rendered Markdown and Mermaid diagrams.

---

## 11. References

### Project evidence

- Project repository: <https://github.com/shnnzdx/cap_stone>
- Current production application: <https://app.cadensy.top>
- Project README: <https://github.com/shnnzdx/cap_stone/blob/main/README.md>
- AWS documentation folder: <https://github.com/shnnzdx/cap_stone/tree/main/AWS>
- Backend documentation: <https://github.com/shnnzdx/cap_stone/tree/main/backend>
- Existing project documentation: <https://github.com/shnnzdx/cap_stone/tree/main/docs>
- GitHub Actions: <https://github.com/shnnzdx/cap_stone/actions>

### Authoritative technical references

- FastAPI testing: <https://fastapi.tiangolo.com/tutorial/testing/>
- SQLAlchemy PostgreSQL JSON/JSONB: <https://docs.sqlalchemy.org/en/20/dialects/postgresql.html#json-types>
- Vite static deployment: <https://vite.dev/guide/static-deploy.html>
- Amazon ECS troubleshooting: <https://docs.aws.amazon.com/AmazonECS/latest/developerguide/troubleshooting.html>
- Amazon ECS service events: <https://docs.aws.amazon.com/AmazonECS/latest/developerguide/service-event-messages.html>
- Amazon ECS service deployment history: <https://docs.aws.amazon.com/AmazonECS/latest/developerguide/service-deployment.html>
