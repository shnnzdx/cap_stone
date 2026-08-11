# TripSync Capstone Workspace

## AI First Step

If an AI agent starts work in this repository, read `AGENTS.md` first before making architecture, session, navigation, or Trip workspace behavior changes.

TripSync currently lives in one repository, but it still has two frontend surfaces:

- `frontend/`: the main marketing site and product shell
- `trip/`: the standalone Trip workspace prototype
- `backend/`: the FastAPI + PostgreSQL backend that supports the Trip workspace

The repo is usable as one workspace, but the apps are not fully merged yet. The current setup focuses on keeping the integration boundary stable while the product continues to evolve.

## At a glance

Today the product works like this:

- `frontend/app/` owns the public-facing site and the `/trip` shell
- `trip/` builds the standalone workspace app
- `frontend/public/trip-app/` stores the built Trip workspace that `frontend` embeds
- `shared/` holds cross-app contracts and shared integration tokens
- `AWS/` stores deployment planning and AWS context documents

Shared files you will touch most often:

- `shared/tripsync-preview-theme.css`
- `shared/tripsync-preview-contract.js`
- `shared/trip-navigation-route/`
- `shared/trip-navigation-policy/`
- `shared/session-runtime/`
- `shared/tripsync-product-content.js`
- `shared/tripsync-demo-data.js`

## What is already unified

Recent work was aimed at making `frontend` and `trip` cooperate cleanly, not forcing them into one codebase too early.

Completed:

- Shared embed theme between the shell and the Trip workspace
- Shared embed path contract for `/trip-app` and the default `#/` workspace route
- Shared workspace route codec and Trip navigation policy seams
- Shared technical session runtime for browser persistence, invite adoption cache, and logout/invalidation sequencing
- Extracted Plan workspace orchestration behind one public `PlanFeature` boundary with deep interaction and assistant/change-request seams
- Shared request identity derivation for `Authorization`, `X-Trip-Id`, and `X-Membership-Id`
- Automated sync from `trip/dist` into `frontend/public/trip-app`
- Embed manifest output for the mounted Trip build
- Compatibility tests around the integration contract
- Shared product workflow and principle content for `frontend`
- Shared Trip demo fallback data for `trip`
- Windows-compatible `npm run build:trip-preview`

Still not done:

- Full component-library unification
- One typed data model across both apps
- Moving Trip workspace pages into `frontend/app`
- Replacing the static embed with one shared runtime
- Production AWS deployment beyond identity validation

## Current runtime ownership

The two deepest shared seams are now:

- `shared/trip-navigation-policy/`
  - owns workspace-level destination policy, route reachability, restoration fallback, and invite/join destination decisions
- `shared/session-runtime/`
  - owns raw `tripsync:*` storage keys, bearer-token mechanics, request identity headers, invite adoption cache persistence, and logout / invalid-session clear sequencing

Runtime ownership around those seams is intentionally split:

- `frontend/app/trip/` owns the host `/trip` shell and iframe handoff
- `trip/src/final/FinalApp.jsx` owns workspace rendering, route composition, and browser navigation execution
- `trip/src/final/plan-feature/PlanFeature.jsx` owns the public Plan workspace feature boundary
- `trip/src/final/plan-feature/usePlanInteractionRuntime.js` owns Plan selection, comments, map/list coordination, menu state, and booking interactions
- `trip/src/final/plan-feature/useAssistantChangeRequestFlow.js` owns drawer-local Cadensy conversation and change-request orchestration
- `trip/src/final/TripAppState.jsx` owns Trip domain hydration, polling, and endpoint scope classification
- `backend/` owns membership, invite, and trip facts, not frontend destination policy

## Project structure

```text
/
|-- .github/                     GitHub Actions workflows
|-- frontend/                    Main site and `/trip` shell
|-- trip/                        Standalone Trip workspace app
|-- backend/                     FastAPI backend for the Trip workspace
|-- shared/                      Shared integration contracts and tokens
|-- docs/                        Project notes and supporting documents
|-- AWS/                         AWS deployment source-of-truth and archived phase notes
|-- AGENTS.md                    Primary working rules for AI agents in this repo
|-- AI.md                        Compatibility pointer for older AI workflows
|-- INTEGRATION-ROADMAP.md       Compatibility summary and future plan
`-- README.md
```

## Prerequisites

- Node.js `>= 22.13.0`
- npm

## Install dependencies

Install each frontend app in its own directory.

For `frontend`:

```bash
cd frontend
npm install
```

For `trip`:

```bash
cd trip
npm install
```

## Local development

Run the main site:

```bash
cd frontend
npm run dev
```

Default URL:

```text
http://localhost:3000
```

Run the Trip workspace directly:

```bash
cd trip
npm run dev
```

Default URL:

```text
http://localhost:5173
```

## Sync the embedded Trip workspace

Recommended flow:

```bash
cd frontend
npm run build:trip-preview
```

That command:

1. builds `trip/`
2. copies `trip/dist` into `frontend/public/trip-app/`
3. writes `frontend/public/trip-app/embed-manifest.json`

If `trip/` is already built and you only want to refresh the copied assets:

```bash
cd frontend
npm run sync:trip-preview
```

## Main routes

From `frontend`:

- `/` - landing page
- `/login` - login page
- `/signup` - signup page
- `/how-it-works` - workflow page
- `/faq` - FAQ page
- `/privacy` - privacy page
- `/trip` - embedded Trip workspace shell
- `/trip-app/` - direct static Trip workspace output

From `trip`:

- `#/`
- `#/create`
- `#/account/profile`
- `#/account/travel`
- `#/account/notifications`
- `#/account/settings`
- `#/trip/:tripId/plan`
- `#/trip/:tripId/chat`
- `#/trip/:tripId/conflict`
- `#/trip/:tripId/updates`
- `#/trip/:tripId/preferences`
- `#/trip/:tripId/members`
- `#/trip/:tripId/invite`
- `#/join/:token`

## Build and verification

Build `frontend`:

```bash
cd frontend
npm run build
```

Build `trip`:

```bash
cd trip
npm run build
```

Run the integration test for the compatibility layer:

```bash
cd frontend
node --test tests/trip-preview-integration.test.mjs
```

Run the full frontend verification suite:

```bash
cd frontend
npm test
```

Expected result:

- `frontend` build succeeds
- `trip` build succeeds through `npm run build:trip-preview`
- frontend tests pass
- Vite may print a chunk-size warning; that is not currently treated as a build failure

## Important notes

- `frontend` and `trip` are still separate apps
- the current compatibility approach is intentional
- `/trip` loads static output built from `trip`
- the deeper Phase 3 frontend/runtime merge is paused for now
- AWS deployment has reached the Phase 10 HTTPS/custom domain pause point; Phase 10 is prepared but not run yet

Local agent and skill installation artifacts are kept outside this repository under:

`C:\Users\ROG\Desktop\capstone\TripSync-Skills-Summary`

## Related docs

- [AGENTS.md](./AGENTS.md)
- [INTEGRATION-ROADMAP.md](./INTEGRATION-ROADMAP.md)
- [AWS/README.md](./AWS/README.md)
- [AWS/TRIPSYNC_AWS_MASTER_CONTEXT_FINAL.md](./AWS/TRIPSYNC_AWS_MASTER_CONTEXT_FINAL.md)
- [docs/HANDOFF_PROMPT_2026-08-11.md](./docs/HANDOFF_PROMPT_2026-08-11.md)
- [docs/HANDOFF_PROMPT_NEXT_BACKEND_AND_REPO_REFACTOR_2026-08-11.md](./docs/HANDOFF_PROMPT_NEXT_BACKEND_AND_REPO_REFACTOR_2026-08-11.md)
- [docs/PRODUCT.md](./docs/PRODUCT.md)
- [docs/PROPOSAL.md](./docs/PROPOSAL.md)
- [docs/PROPOSAL_EN.md](./docs/PROPOSAL_EN.md)
- [docs/AGENTS.md](./docs/AGENTS.md)
- [docs/frontend/3d-collaborative-idea-sphere-design.md](./docs/frontend/3d-collaborative-idea-sphere-design.md)
- [docs/frontend/ai-travel-hero-scroll-storytelling-final.md](./docs/frontend/ai-travel-hero-scroll-storytelling-final.md)
- [AI.md](./AI.md)
