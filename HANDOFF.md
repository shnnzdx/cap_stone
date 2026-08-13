# Cadensy / TripSync Handoff

Last updated: 2026-08-13

This is the current root handoff for `C:\Users\zdxzh\Desktop\capstone\New`.
Read this first, then move into the narrower docs.

## Read These First

Use this order:

1. `AGENTS.md`
2. `README.md`
3. `INTEGRATION-ROADMAP.md`
4. `backend/README.md`
5. `backend/LOCAL_DEV.md`
6. `docs/PRODUCT.md`
7. `docs/AGENTS.md`
8. `docs/navigation-known-wrong-behavior.md`
9. `trip/README.md`

## Repo Shape

This is a mixed repository, not a single frontend:

- `frontend/`: the main site, marketing pages, and `/trip` host shell
- `trip/`: the standalone Trip workspace frontend source
- `backend/`: the FastAPI + PostgreSQL backend
- `shared/`: shared navigation, session, product-copy, and compatibility contracts
- `docs/`: product, AI, handoff, and proposal docs
- `AWS/`: cloud deployment and demo-environment docs

## Frozen Boundaries

Do not casually break these three seams.

### 1. Navigation

- `shared/trip-navigation-policy/` owns workspace destination policy
- it also owns route reachability, restoration fallback, and invite/join destination decisions
- do not reintroduce role-based destination logic inside UI components

### 2. Technical Session

- `shared/session-runtime/` owns `tripsync:*`
- it owns bearer-token handling, request identity headers, and invite adoption cache persistence
- it owns invalid-session clear and logout sequencing
- do not manually assemble `Authorization`, `X-Trip-Id`, or `X-Membership-Id` in random components

### 3. Plan Workspace

- `trip/src/final/plan-feature/PlanFeature.jsx` is the single public Plan feature boundary
- `usePlanInteractionRuntime` owns selection, comments, map/list, menu, booking, and drawer behavior
- `useAssistantChangeRequestFlow` owns the Cadensy drawer conversation and change-request flow
- `trip/src/final/FinalApp.jsx` should stay limited to route mount, workspace composition, and command execution

## What The Product Is

This is not a generic itinerary generator.

It is a group-travel decision engine that:

- maintains one living Current Plan
- routes each change through a backend-owned decision path
- protects private member constraints
- keeps a decision history

Current backend path outcomes are:

- `notice`
- `round`
- `reopen_round`
- `confirm`

Path classification is owned by backend rules, not by AI and not by frontend UI.

## Important Capabilities Already Landed

The current `New` workspace already includes these real behaviors:

- email/password login with bearer session
- `/trip` embedding through `frontend/public/trip-app/`
- `My Trips` based on real trip summaries instead of fake cards
- account-backed users staying on `My Trips` when they land on workspace home
- guest-backed sessions returning into their trip
- per-activity history coming from real `PlanChange` rows
- initial generation rows filtered out of user-facing activity history
- vote rounds auto-settling when every member has voted
- self-only confirms auto-applying when appropriate
- preference date validation against the trip date window
- single-member generation no longer treating budget ceiling as a group blocker
- date moves updating both `day_date` and `day_index`
- same-day occupied-time overlap routing into the correct decision path

## Still Not Fully Done

These are still reasonable follow-up areas:

- planner AI quality is still limited
- chat history is not persisted yet
- magic-link and guest-to-account binding remain incomplete
- automatic trip state transitions are not fully finished
- Alembic migrations are not set up yet
- deeper `frontend` / `trip` absorption is still paused

## Everyday Local Commands

### Start backend

On Windows, use the venv interpreter directly:

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.api.main:app --host 127.0.0.1 --port 8000 --reload
```

### Reset demo data

This preserves the stable IDs the frontend expects:

```powershell
cd backend
.\.venv\Scripts\python.exe -m app.db.reset_demo
```

### Run backend tests

```powershell
cd backend
$env:DISABLE_SCHEDULER="1"
$env:MOCK_AI="1"
.\.venv\Scripts\python.exe -m pytest -q
```

### Run the main frontend

```powershell
cd frontend
npm run dev
```

### Rebuild and sync the embedded Trip preview

Changing `trip/` alone is not enough:

```powershell
cd frontend
npm run build:trip-preview
```

## Local Verification Facts

- PostgreSQL must be available on `localhost:5432`
- seeing FastAPI `/docs` does not mean login is working
- real login also depends on valid account, membership, and trip rows in the database
- `MOCK_AI=1` remains the default-safe local mode

## Common Pitfalls

### 1. You changed `trip/` but `/trip` did not change

Usually the code is fine and the preview bundle is stale. Run:

```powershell
cd frontend
npm run build:trip-preview
```

### 2. You see “Could not reach the backend”

Frontend often uses that text for backend `500`s too.
Check the backend traceback before assuming a network problem.

### 3. Backend behavior looks stale after code changes

Make sure you started it with `--reload`.
Without that, old behavior can look like route or logic breakage.

### 4. You reset data with the wrong script

- `app.db.seed` can rotate IDs
- `app.db.reset_demo` is the safer everyday choice

### 5. You rewrite session or navigation logic inside UI

That is the fastest way to make the architecture drift again.
If the change touches destination policy or technical session behavior, start in `shared/`.

## AI Integration Status

The backend AI framework exists, but not every capability is fully intelligent yet.

Important entry points:

- `POST /api/trips/{id}/chat`
- `POST /api/trips/{id}/plans/generate`
- `POST /api/trips/{id}/constraints`
- `POST /api/plans/items/{id}/classify`
- `POST /api/plans/items/{id}/changes`

Important files:

- `backend/app/agents/base.py`
- `backend/app/agents/chat.py`
- `backend/app/agents/explainer.py`
- `backend/app/agents/planner.py`
- `backend/app/domain/plans/generator.py`

Hard rules:

- AI must not choose the change path
- AI must not read another member's private raw wording
- AI must not bypass backend rules to mutate the Current Plan
- `MOCK_AI=1` must remain runnable

## Practical Rule

When you continue work:

- visual changes belong in UI
- destination changes start with `shared/trip-navigation-policy/`
- session, header, and storage changes start with `shared/session-runtime/`
- Plan interaction changes must stay inside the `plan-feature/` boundary
- after changing `trip/`, always resync the embedded preview
