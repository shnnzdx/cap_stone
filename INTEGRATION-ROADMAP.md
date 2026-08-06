# TripSync Frontend Integration Roadmap

## Purpose

This document records:

- what was changed to make `frontend/` and `trip/` more compatible
- why those changes were made this way
- what should happen next if the team wants deeper unification

## Starting Problem

The repository had two separate frontend implementations for the same product:

- `frontend/` was the main product/landing shell
- `trip/` was a separate workspace app built independently

That created a few concrete problems:

- duplicated design decisions
- duplicated route assumptions
- manual, fragile copy steps for embedding `trip` into `frontend`
- business paths and embed paths hardcoded in multiple places
- no stable contract describing how `frontend` should host `trip`

## What Was Changed

### 1. Shared preview theme

Added:

- `shared/tripsync-preview-theme.css`

This gives both apps one shared source for the embedded Trip preview's base visual tokens.

### 2. Shared embed contract

Added:

- `shared/tripsync-preview-contract.js`
- `frontend/app/trip/preview-config.ts`

This centralizes:

- `/trip-app` base path
- default preview route
- iframe source construction
- absolute invite/preview URL helpers

### 3. Shared domain path helpers

Added:

- `shared/tripsync-domain.js`

This centralizes the most repeated business paths:

- organizer home
- organizer archived
- organizer create
- organizer account/settings
- organizer trip stage paths
- participant trip path
- guest invite path

### 4. Automated Trip asset sync

Added:

- `frontend/scripts/sync-trip-preview.mjs`

Updated:

- `frontend/package.json`

This replaces a fragile manual copy workflow with a repeatable sync command.

### 5. Embed manifest

Generated:

- `frontend/public/trip-app/embed-manifest.json`

This lets the shell know which Trip build is currently embedded.

### 6. Compatibility tests

Added:

- `frontend/tests/trip-preview-integration.test.mjs`

These tests verify:

- shared preview routing contract
- shared preview theme contract
- sync script behavior

## Why This Approach

We did not hard-merge the two apps immediately.

Instead, the work followed this order:

1. stabilize integration seams
2. remove repeated constants and path rules
3. automate syncing
4. add tests around those seams
5. only then consider deeper codebase consolidation

This reduces regression risk while the team still has two active code shapes.

## Current State

As of Thursday, August 6, 2026:

- `frontend` builds successfully
- `trip` builds successfully
- compatibility tests pass
- `/trip` embeds the synced static Trip workspace using shared contracts

Still true:

- `frontend` and `trip` are separate apps
- product data and page configuration are still mostly duplicated
- `frontend/tests/rendered-html.test.mjs` is still outdated relative to the current UI

## Recommended Next Changes

### Near-term

1. Move more Trip product constants into shared modules.
   Candidates: stage labels, CTA labels, invite copy, route metadata.

2. Extract shared Trip data/schema from `trip/src/final/finalData.js`.
   Goal: one source for trip IDs, stage copy, sample entities, and page-level content.

3. Align `frontend` product explanation pages with shared domain definitions.
   Example: `frontend/app/how-it-works/page.tsx` should eventually read from the same stage model as `trip`.

4. Update or replace `frontend/tests/rendered-html.test.mjs`.
   It still expects a starter loading skeleton that no longer represents the app.

### Mid-term

1. Create a shared UI primitive layer for both apps.
   Candidates: badges, buttons, status chips, shell headers, plan cards.

2. Move shared Trip route definitions into a reusable router config or path map.

3. Reduce static embed coupling by letting `frontend` consume more shared runtime code directly.

### Long-term

1. Decide whether `trip` remains a standalone prototype surface or gets absorbed into `frontend`.

2. If absorbed:
   Move core Trip workspace pages into `frontend/app`
   Replace static embed deployment with a single deployment surface
   Retire duplicated assets and transitional sync scripts

## Decision Rule For Future Work

When choosing the next refactor, prefer this order:

1. shared contract
2. shared data
3. shared primitives
4. shared page composition
5. runtime merge

That order keeps the system usable while steadily reducing duplication.
