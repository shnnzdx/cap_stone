# TripSync Capstone Workspace

This repository currently contains two frontend surfaces for the same product:

- `frontend/`: the main TripSync marketing site and product shell built with Vinext/Next-style app routing
- `trip/`: the TripSync workspace prototype built as a standalone React + Vite frontend app
- `backend/`: the FastAPI + PostgreSQL backend used by the Trip workspace

The two apps were originally developed separately. They are not fully merged yet, but this repo now includes a compatibility layer so they can share a more stable integration boundary.

## Current Architecture

Today the product is integrated like this:

- `frontend/app/` owns the main public-facing site and the `/trip` preview shell
- `trip/` builds a static workspace app
- `frontend/public/trip-app/` stores the built Trip workspace that is embedded by `frontend`
- `shared/` stores cross-app contracts and shared integration tokens
- `AWS/` stores AWS planning and deployment context documents; it does not create AWS resources by itself
- local agent/skill installation artifacts are kept outside this repository under `C:\Users\ROG\Desktop\capstone\TripSync-Skills-Summary`

Key shared files:

- `shared/tripsync-preview-theme.css`: shared visual tokens for the embedded Trip workspace
- `shared/tripsync-preview-contract.js`: shared embed path and iframe contract
- `shared/tripsync-domain.js`: shared route and flow helpers for Trip domain paths
- `shared/tripsync-product-content.js`: shared product workflow and principle content
- `shared/tripsync-demo-data.js`: shared Trip demo fallback data used by the workspace

## What Was Unified

The recent compatibility work focused on stabilizing the seam between `frontend` and `trip`, not force-merging both codebases.

Completed:

- Shared embed theme between the shell and the Trip workspace
- Shared embed path contract for `/trip-app` and the default `#/` workspace route
- Shared domain helpers for current workspace, account, trip-section, and invite paths
- Automated sync flow from `trip/dist` into `frontend/public/trip-app`
- Embed manifest output so the shell can identify which Trip build is mounted
- Compatibility tests around the integration contract
- Shared product workflow/principle content for `frontend`
- Shared Trip demo fallback data for `trip`
- Windows-compatible `npm run build:trip-preview` script

Not done yet:

- Full component-library unification
- Shared typed data model across both apps
- Moving Trip workspace pages into `frontend/app`
- Replacing the static embed with a single runtime/app architecture
- AWS deployment beyond identity validation

## Project Structure

```text
/
|-- .github/                     GitHub Actions workflows
|-- frontend/                    Main site and `/trip` shell
|-- trip/                        Standalone Trip workspace app
|-- backend/                     FastAPI backend for the Trip workspace
|-- shared/                      Shared integration contracts and tokens
|-- docs/                        Project notes and supporting documents
|-- AWS/                         AWS deployment context and planning notes
|-- AI.md                        Local agent setup note for this repo
|-- INTEGRATION-ROADMAP.md       Compatibility summary and future plan
`-- README.md
```

## Prerequisites

- Node.js `>= 22.13.0`
- npm

## Install Dependencies

Install each app in its own directory.

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

## Local Development

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

## Sync The Embedded Trip Workspace

The recommended flow is:

```bash
cd frontend
npm run build:trip-preview
```

That command:

- builds `trip/`
- copies `trip/dist` into `frontend/public/trip-app/`
- writes `frontend/public/trip-app/embed-manifest.json`

If you already built `trip/` and only want to refresh the copied assets:

```bash
cd frontend
npm run sync:trip-preview
```

## Main Routes

From `frontend`:

- `/`: landing page
- `/login`: login page
- `/signup`: signup page
- `/how-it-works`: workflow page
- `/faq`: FAQ page
- `/privacy`: privacy page
- `/trip`: embedded Trip workspace shell
- `/trip-app/`: direct static Trip workspace output

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

## Build And Verification

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

Run the integration tests we added for the compatibility layer:

```bash
cd frontend
node --test tests/trip-preview-integration.test.mjs
```

Run the full frontend verification suite:

```bash
cd frontend
npm test
```

Current expected result:

- `frontend` build succeeds
- `trip` build succeeds through `npm run build:trip-preview`
- frontend tests pass
- Vite may print a chunk-size warning; that warning is not currently a build failure

## Important Notes

- `frontend` and `trip` are still two separate apps.
- The current compatibility approach is intentional: stabilize the boundary first, then merge deeper layers.
- The embedded workspace loaded by `/trip` is static output from `trip`.
- Phase 3 deeper frontend/runtime merge is intentionally paused for now.
- GitHub Actions has an AWS identity validation workflow, but no AWS deployment workflow should run until build validation and deployment architecture are agreed.

## Related Docs

- [INTEGRATION-ROADMAP.md](./INTEGRATION-ROADMAP.md)
- [AWS/TRIPSYNC_AWS_MASTER_CONTEXT_FINAL.md](./AWS/TRIPSYNC_AWS_MASTER_CONTEXT_FINAL.md)
- [docs/frontend/3d-collaborative-idea-sphere-design.md](./docs/frontend/3d-collaborative-idea-sphere-design.md)
- [docs/frontend/ai-travel-hero-scroll-storytelling-final.md](./docs/frontend/ai-travel-hero-scroll-storytelling-final.md)
- [AI.md](./AI.md)
