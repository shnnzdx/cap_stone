# TripSync Capstone Workspace

TripSync is a capstone repo for a group-travel product with:

- `frontend/`: the public product site and `/trip` host shell
- `trip/`: the embedded Trip workspace source
- `backend/`: the FastAPI + PostgreSQL backend
- `shared/`: stable cross-app contracts

This repo is intentionally not fully merged into one app yet. The current architecture keeps the integration seams explicit so product work can continue without breaking navigation, session, and Plan workspace behavior.

## Start Here

Use this table instead of opening every root file.

| If you need to... | Read this first |
| --- | --- |
| understand the repo quickly | `README.md` |
| work as an AI/code agent | `AGENTS.md` |
| understand current AI/backend-agent state | `AI.md` |
| see the broader integration status | `INTEGRATION-ROADMAP.md` |
| read the long-form handoff/history | `HANDOFF.md` |
| understand backend setup | `backend/README.md`, `backend/LOCAL_DEV.md` |

## Current Status

What is already stable:

- `frontend` hosts the main site and embeds `/trip`
- `trip` remains the source for the Trip workspace
- `shared/trip-navigation-policy/` owns workspace destination policy
- `shared/session-runtime/` owns session persistence and request identity seams
- `trip/src/final/plan-feature/PlanFeature.jsx` is the public Plan feature boundary
- Chat Agent V1 is functionally complete for the current capstone scope

What is still intentionally split:

- `frontend` and `trip` are separate apps
- `/trip` renders static output built from `trip`
- deep frontend/runtime unification is paused
- AWS production rollout is documented, not fully executed end to end

## Repo Map

```text
/
|-- frontend/     Main site and `/trip` shell
|-- trip/         Standalone Trip workspace source
|-- backend/      FastAPI backend
|-- shared/       Shared navigation/session/content seams
|-- docs/         Handoffs, system maps, class docs, design notes
|-- AWS/          Deployment notes and runbooks
|-- AGENTS.md     Working rules for AI/code agents
|-- AI.md         Current AI system entry doc
|-- HANDOFF.md    Long-form project handoff
`-- INTEGRATION-ROADMAP.md
```

## Key Architecture Boundaries

These are the current seams you should preserve unless there is a deliberate redesign:

- Navigation policy: `shared/trip-navigation-policy/`
- Technical session runtime: `shared/session-runtime/`
- Plan workspace public boundary: `trip/src/final/plan-feature/PlanFeature.jsx`
- Plan interaction runtime: `trip/src/final/plan-feature/usePlanInteractionRuntime.js`
- Assistant change-request flow: `trip/src/final/plan-feature/useAssistantChangeRequestFlow.js`

## Local Development

Prerequisites:

- Node.js `>= 22.13.0`
- npm
- PostgreSQL for authenticated backend flows

Install:

```bash
cd frontend && npm install
cd ../trip && npm install
```

Run the public site:

```bash
cd frontend
npm run dev
```

Run the backend:

```bash
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.api.main:app --host 127.0.0.1 --port 8000 --reload
```

Run the Trip workspace directly:

```bash
cd trip
npm run dev
```

## Embed Sync

When `trip/` changes and `/trip` in `frontend` must reflect it, run:

```bash
cd frontend
npm run build:trip-preview
```

This builds `trip`, copies `trip/dist` into `frontend/public/trip-app/`, and refreshes `embed-manifest.json`.

## Verification

Frontend build:

```bash
cd frontend
npm run build
```

Trip build:

```bash
cd trip
npm run build
```

Frontend compatibility test:

```bash
cd frontend
node --test tests/trip-preview-integration.test.mjs
```

For backend verification, use `backend/README.md` and `backend/LOCAL_DEV.md`.

## Important Docs

- [AGENTS.md](./AGENTS.md): repo working rules for AI/code agents
- [AI.md](./AI.md): current AI architecture and safe boundaries
- [HANDOFF.md](./HANDOFF.md): detailed historical handoff
- [INTEGRATION-ROADMAP.md](./INTEGRATION-ROADMAP.md): integration state and next architecture direction
- [docs/backend/CHAT_AGENT_V1_HISTORY_AND_FUTURE_2026-08-15.md](./docs/backend/CHAT_AGENT_V1_HISTORY_AND_FUTURE_2026-08-15.md): Chat Agent V1 status and future ideas
- [docs/backend/yuming/Cadensy-AI-系统地图.md](./docs/backend/yuming/Cadensy-AI-%E7%B3%BB%E7%BB%9F%E5%9C%B0%E5%9B%BE.md): AI system map
- [docs/class/PRODUCT.md](./docs/class/PRODUCT.md)
- [docs/class/PROPOSAL.md](./docs/class/PROPOSAL.md)
- [docs/class/PROPOSAL_EN.md](./docs/class/PROPOSAL_EN.md)
- [backend/README.md](./backend/README.md)
- [backend/LOCAL_DEV.md](./backend/LOCAL_DEV.md)
