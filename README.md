# TripSync Capstone Workspace

This repository currently contains two frontend surfaces for the same product:

- `frontend/`: the main TripSync marketing site and product shell built with Vinext/Next-style app routing
- `trip/`: the TripSync workspace prototype built as a standalone React + Vite app

The two apps were originally developed separately. They are not fully merged yet, but this repo now includes a compatibility layer so they can share a more stable integration boundary.

## Current Architecture

Today the product is integrated like this:

- `frontend/app/` owns the main public-facing site and the `/trip` preview shell
- `trip/` builds a static workspace app
- `frontend/public/trip-app/` stores the built Trip workspace that is embedded by `frontend`
- `shared/` stores cross-app contracts and shared integration tokens

Key shared files:

- `shared/tripsync-preview-theme.css`: shared visual tokens for the embedded Trip workspace
- `shared/tripsync-preview-contract.js`: shared embed path and iframe contract
- `shared/tripsync-domain.js`: shared route and flow helpers for Trip domain paths

## What Was Unified

The recent compatibility work focused on stabilizing the seam between `frontend` and `trip`, not force-merging both codebases.

Completed:

- Shared embed theme between the shell and the Trip workspace
- Shared embed path contract for `/trip-app` and default hash routes
- Shared domain helpers for organizer, participant, and invite paths
- Automated sync flow from `trip/dist` into `frontend/public/trip-app`
- Embed manifest output so the shell can identify which Trip build is mounted
- Compatibility tests around the integration contract

Not done yet:

- Full component-library unification
- Shared typed data model across both apps
- Moving Trip workspace pages into `frontend/app`
- Replacing the static embed with a single runtime/app architecture

## Project Structure

```text
/
|-- frontend/                    Main site and `/trip` shell
|-- trip/                        Standalone Trip workspace app
|-- shared/                      Shared integration contracts and tokens
|-- docs/                        Project notes and supporting documents
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

- `#/organizer`
- `#/organizer/create`
- `#/organizer/trip/:tripId/:stage`
- `#/participant/trip/:tripId`
- `#/t/:slug`

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

## Important Notes

- `frontend` and `trip` are still two separate apps.
- The current compatibility approach is intentional: stabilize the boundary first, then merge deeper layers.
- The embedded workspace loaded by `/trip` is static output from `trip`.
- `frontend/tests/rendered-html.test.mjs` still reflects an older starter/skeleton expectation and is not yet aligned with the current TripSync product UI.

## Related Docs

- [INTEGRATION-ROADMAP.md](./INTEGRATION-ROADMAP.md)
- [AI.md](./AI.md)
