# Repo Working Rules For AI Agents

Read this before changing architecture, session logic, navigation behavior, or Trip workspace behavior.

## Read Order

Default read order:

1. `README.md`
2. `AGENTS.md`
3. `AI.md` if the task touches chat, planner, prompts, or AI-adjacent backend behavior
4. `INTEGRATION-ROADMAP.md` for repo-level integration questions
5. `HANDOFF.md` only when long historical context is actually needed
6. `docs/navigation-known-wrong-behavior.md` for navigation work

If the task is backend cleanup or repo consolidation, also read:

- `docs/HANDOFF_PROMPT_NEXT_BACKEND_AND_REPO_REFACTOR_2026-08-11.md`
- `backend/README.md`
- `backend/LOCAL_DEV.md`

## Source Of Truth

Primary source directories:

- `frontend/`
- `trip/`
- `backend/`
- `shared/`
- `docs/`

Do not treat these generated outputs as primary:

- `frontend/dist/`
- `trip/dist/`
- `frontend/public/trip-app/assets/`

If you change `trip/` and the embedded `/trip` experience must reflect it, run:

```bash
cd frontend
npm run build:trip-preview
```

## Frozen Boundaries

These boundaries are already established. Do not casually redesign them.

### Navigation

- `shared/trip-navigation-policy/` owns workspace destination policy, route reachability, restoration fallback, and invite/join destination decisions.
- UI code must not reintroduce role-based or destination policy inline.

### Technical Session

- `shared/session-runtime/` owns raw `tripsync:*` storage keys, bearer-token mechanics, request identity headers, invite adoption cache persistence, invalid-session clearing, and logout sequencing.
- Runtime callers must not directly own `localStorage` session persistence policy, `Authorization`, `X-Trip-Id`, or `X-Membership-Id` assembly.

### Plan Workspace

- `trip/src/final/plan-feature/PlanFeature.jsx` is the public Plan feature boundary.
- `usePlanInteractionRuntime` owns Plan selection, focus, comments, map/list coordination, menu state, booking interactions, and drawer state.
- `useAssistantChangeRequestFlow` owns drawer-local Cadensy conversation, proposal apply flow, and confirm redirect orchestration.
- `trip/src/final/FinalApp.jsx` should only own Plan route mount, workspace composition, and command execution.

## Change Placement Rule

When deciding where a change belongs:

- visual change: update UI
- destination/routing policy change: respect `shared/trip-navigation-policy/`
- session identity/storage/header change: respect `shared/session-runtime/`
- Plan workspace behavior change: stay inside the Plan feature seam
- AI behavior change: read `AI.md` first and preserve read-only / Apply-required boundaries

## Things Not To Reintroduce

- Do not hard-code role-based destination logic inside UI components.
- Do not read or write raw `tripsync:*` keys outside `shared/session-runtime/`, except in tests and explicit compatibility fixtures.
- Do not manually assemble `Authorization`, `X-Trip-Id`, or `X-Membership-Id` outside the session runtime seam.
- Do not move Plan interaction logic back into `FinalApp`.
- Do not duplicate Plan selection, comments, drawer, map, booking, or assistant state just to support a redesign.
- Do not use `shared/` as a dumping ground for unrelated helpers.

## Refactor Rule

Before major refactors:

1. assess the current seam
2. challenge the strongest candidate
3. freeze the boundary
4. make a migration plan
5. implement in phases

Do not refactor based only on file size. Prefer locality, leverage, testability, migration risk, and the deletion test.

## Backend Default

If no newer instruction overrides this, the safest next backend move is:

1. architecture assessment first
2. implementation second

Do not start by rewriting backend modules before identifying the real seam.
