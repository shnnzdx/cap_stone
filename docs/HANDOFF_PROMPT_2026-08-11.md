# Handoff Prompt

Last refreshed: August 13, 2026

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
- `docs/AGENTS.md`
- `docs/PRODUCT.md`
- `docs/navigation-known-wrong-behavior.md`

2. Source-of-truth directories:

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

3. Current repo shape:

- `frontend/` is the main site and host shell
- `/login` calls the real backend login API
- `/signup` is still not a fully real backend registration flow
- `/trip` is an iframe shell that loads the built Trip workspace
- `trip/` is still the source of that embedded workspace
- `backend/` owns the real decision engine behavior

4. Important frozen boundaries:

- `shared/trip-navigation-policy/` owns workspace destination policy
- `shared/session-runtime/` owns technical session persistence and request identity
- `trip/src/final/plan-feature/PlanFeature.jsx` is the public Plan feature boundary
- `usePlanInteractionRuntime` owns Plan interaction state
- `useAssistantChangeRequestFlow` owns drawer-local assistant and change-request flow

Do not casually move these responsibilities back into UI components or `FinalApp`.

5. Embedded Trip reminder:

- changing `trip/` does not automatically update visible `/trip`
- after changing `trip/`, run:
  `cd frontend && npm run build:trip-preview`

6. Backend realities:

- bearer login is real
- decision paths are backend-owned
- current path set is `notice`, `round`, `reopen_round`, `confirm`
- PostgreSQL is required for real backend flows
- tests require a disposable `TEST_DATABASE_URL`
- `MOCK_AI=1` remains the default-safe local AI mode

7. Current product truths already merged:

- account-backed users landing on workspace home stay on `My Trips`
- guest-backed sessions still return into their trip
- dashboard uses real trip summaries instead of fake default trips
- per-activity history comes from real `PlanChange` rows
- initial generation history is filtered out of user-facing activity history
- vote rounds auto-settle when every member has voted
- single-member trips no longer treat budget ceiling as a group blocker
- preference dates are validated against the trip date window

8. Do not do these:

- do not edit generated frontend or trip assets by hand
- do not rename `tripsync:*` storage keys casually
- do not make private cloud RDS public for convenience
- do not assume `/signup` is already a real registration system
- do not let AI decide which path a change uses

9. Before changing anything, answer:

- Is this a `frontend`, `trip`, `shared`, `backend`, `docs`, or `AWS` task?
- Does it touch a frozen boundary?
- If it touches `trip/`, have you rebuilt and resynced the embedded preview?
```

## Local AWS Note

As of Thursday, August 13, 2026:

- local AWS CLI credential copies may still be stored in `backend/.env`
- AWS CLI does not automatically read `backend/.env`
- a shell may need to import those variables before `aws sts get-caller-identity` works

Do not print or commit secret values.
