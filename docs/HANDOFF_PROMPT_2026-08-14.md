# Handoff Prompt

Last refreshed: August 14, 2026

Use this when handing the current repository to another engineer or AI agent.

```text
You are taking over `C:\Users\zdxzh\Desktop\capstone\New`.

Treat the following as the current baseline unless you re-check the code and find stronger
new evidence.

1. Read these first:

- `AGENTS.md`
- `README.md`
- `INTEGRATION-ROADMAP.md`
- `HANDOFF.md`
- `backend/README.md`
- `backend/LOCAL_DEV.md`
- `docs/HANDOFF_PROMPT_2026-08-14.md`
- `docs/navigation-known-wrong-behavior.md`

2. Current branch baseline:

- `origin/main` currently points to `f503911`
- that pushed state includes:
  - `295dc237e2cefcc7219f5f9d1e790dda93c5b631` from `main`
  - `47ee52eabafaaf8d9b6709e581ecf65d8134b498` from `jiayi`
- the merge chain that produced the current baseline is:
  - `5c1bacc` local sync of the `295dc23` workspace UI update
  - `034e098` resolved `jiayi` merge
  - `f503911` merge of latest `origin/main` before push

3. Source-of-truth directories:

- `frontend/`
- `trip/`
- `backend/`
- `shared/`
- `docs/`
- `AWS/`

Do not treat these as primary source files:

- `frontend/public/trip-app/assets/`
- `trip/dist/`
- `frontend/dist/`

4. Current repo shape:

- `frontend/` is the main site, login/signup flow, and `/trip` host shell
- `/trip` is still an embedded workspace, not a direct source page
- `trip/` is still the source of the embedded Trip workspace
- `backend/` owns auth, membership, trip facts, planner, places, and decision paths
- `shared/` owns the frozen navigation/session seams

5. Important frozen boundaries:

- `shared/trip-navigation-policy/` owns workspace destination policy
- `shared/session-runtime/` owns technical session persistence and request identity
- `trip/src/final/plan-feature/PlanFeature.jsx` is the public Plan feature boundary
- `usePlanInteractionRuntime` owns Plan interaction state
- `useAssistantChangeRequestFlow` owns drawer-local assistant and change-request flow

Do not casually move these responsibilities back into UI components or `FinalApp`.

6. The most recent merge changed these areas:

- backend place-library flow for non-Chicago destinations
- Geoapify-backed cache and planner candidate sourcing
- login/signup-related frontend pages
- post-login Trip workspace behavior and UI
- `trip/src/final/FinalApp.jsx`
- `trip/src/final/final.css`
- embedded `/trip` preview bundle under `frontend/public/trip-app/`

7. Current merged truths already in `main`:

- `main` now contains the requested `main + jiayi` merge work
- organizer and member post-login behavior should be evaluated from the current code, not from older docs
- the embedded Trip preview was rebuilt after conflict resolution
- the latest synced preview manifest currently points at:
  - `assets/index-BXpE02Us.js`
  - `assets/index-CIPog_Ng.css`
- those hash names are build output and can change again after the next `build:trip-preview`

8. Embedded Trip reminder:

- changing `trip/` does not automatically update visible `/trip`
- after changing `trip/`, run:
  `cd frontend && npm run build:trip-preview`
- if `/trip` still looks old, check `frontend/public/trip-app/embed-manifest.json`
- do not hand-edit generated bundle files to “fix” UI behavior

9. Windows local runtime gotchas:

- on this machine, bare `python` may fail with:
  `Python was not found`
- if that happens, create the venv once with a real interpreter path, for example:
  `D:\ANACONDA\python.exe -m venv .venv`
- after the venv exists, use:
  `.\.venv\Scripts\python.exe`
  for install, seed, uvicorn, and pytest
- do not switch back to bare `python` after that on this machine

10. Backend startup reality:

- opening `http://127.0.0.1:8000/docs` is not enough
- real login requires all three:
  - backend running
  - `DATABASE_URL` reachable
  - database contains a valid account and membership/trip state
- demo organizer login:
  - email: `organizer@cadensy.local`
  - password: `12345678`
- if the demo password login does not work:
  - `cd backend`
  - `.\.venv\Scripts\python.exe -m app.db.seed`
  or
  - `.\.venv\Scripts\python.exe -m app.db.enable_auth`

11. PostgreSQL / seed gotchas:

- if `.\.venv\Scripts\python.exe -m app.db.seed` appears to hang, first verify PostgreSQL is actually running
- quick check:
  `pg_isready -h localhost -p 5432`
- seed targets `DATABASE_URL`, not `TEST_DATABASE_URL`
- do not destructively seed a shared or cloud-like database unless explicitly intended
- tests require a disposable test database and must not reuse `DATABASE_URL`

12. AI provider realities:

- current runtime shape is dual-provider, not single-provider
- recommended routing:
  - `CHAT_AI_PROVIDER=ollama_cloud`
  - `PLANNER_AI_PROVIDER=deepseek`
  - `EXPLAINER_AI_PROVIDER=deepseek`
- `MOCK_AI=1` is still the safest local default
- do not assume “AI is broken” before checking provider env vars and backend traceback

13. Recent conflict-resolution details that matter:

- repeated merge conflicts happened in:
  - `frontend/public/trip-app/embed-manifest.json`
  - `frontend/public/trip-app/index.html`
  - `trip/src/final/FinalApp.jsx`
  - `trip/src/final/final.css`
- the kept resolution is the newer local rebuilt preview plus the merged `jiayi` behavior
- if those four files conflict again during future sync work, compare against the pushed `main` baseline before reusing old bundle references

14. Current UI / Trip behavior worth preserving unless intentionally changing it:

- Preferences now distinguish Trip Dates from My Availability
- Create Trip keeps required name/destination markers
- Create Trip group size input is sanitized as numeric text input
- date pickers use the newer month-navigation calendar behavior
- constraint date inputs are range-limited by the trip window

15. Do not do these:

- do not edit generated frontend or trip assets by hand
- do not rename `tripsync:*` storage keys casually
- do not reintroduce navigation policy inline in UI components
- do not assume `/signup` is fully identical to the old static-only version
- do not assume `/docs` means login is correctly wired
- do not let AI choose decision paths

16. Before changing anything, answer:

- Is this a `frontend`, `trip`, `shared`, `backend`, `docs`, or `AWS` task?
- Does it touch a frozen boundary?
- If it touches `trip/`, have you rebuilt and resynced the embedded preview?
- If login fails, did you verify backend traceback, database contents, and membership state instead of only checking `/docs`?
```

## Fast Local Checklist

If another AI only needs the minimum working loop, use this:

1. `cd C:\Users\zdxzh\Desktop\capstone\New\backend`
2. If bare `python` fails, create the venv once with a real interpreter path such as:
   `D:\ANACONDA\python.exe -m venv .venv`
3. `.\.venv\Scripts\python.exe -m pip install -r requirements.txt`
4. `Copy-Item .env.example .env`
5. Verify PostgreSQL is running with `pg_isready -h localhost -p 5432`
6. `.\.venv\Scripts\python.exe -m app.db.seed`
7. `.\.venv\Scripts\python.exe -m uvicorn app.api.main:app --host 127.0.0.1 --port 8000 --reload`
8. In another terminal:
   `cd C:\Users\zdxzh\Desktop\capstone\New\frontend`
9. `npm run dev`
10. If `/trip` UI changes were made in `trip/`, also run:
    `npm run build:trip-preview`

## Why This Prompt Exists

The older `2026-08-11` prompt no longer captured:

- the `295dc23 + 47ee52e` merge state
- the pushed `f503911` baseline
- the Windows interpreter/PATH issue
- the rebuilt embedded Trip bundle
- the recurring confusion that FastAPI `/docs` does not mean login will work
