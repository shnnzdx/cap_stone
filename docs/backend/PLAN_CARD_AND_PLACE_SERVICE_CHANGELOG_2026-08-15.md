# Plan Card And Place Service Changelog

Last updated: 2026-08-15

## 1. Purpose

This document is the short index for the 2026-08-15 Plan card and Place Service changes.

Read the two focused handoff documents first:

- `docs/backend/PLAN_CARD_CATEGORY_ICON_HANDOFF_2026-08-15.md`
- `docs/backend/CHICAGO_PLACE_SERVICE_UNIFICATION_HANDOFF_2026-08-15.md`

## 2. Scope Completed

Completed in this batch:

- Plan activity cards now use compact category icons instead of photo placeholders.
- Meal cards now share the same compact visual language and show Lunch/Dinner clearly.
- Start time is a separate high-priority field on the right side of each card.
- Address remains a lower-priority compact display-only field.
- Chicago formal Planner candidates now flow through the same Place Service path as every other city.
- Old Chicago curated data remains in the repository but is no longer the formal Plan generation source.
- Embedded Trip preview output was regenerated.

## 3. Files To Review

Primary source files:

```text
backend/app/domain/places/service.py
backend/tests/test_places.py
trip/src/final/plan-feature/PlanFeature.jsx
trip/src/final/final.css
frontend/tests/trip-preview-integration.test.mjs
backend/README.md
HANDOFF.md
```

Generated frontend embed output:

```text
frontend/public/trip-app/index.html
frontend/public/trip-app/embed-manifest.json
frontend/public/trip-app/assets/*
```

## 4. Validation Summary

Passed:

```bash
cd trip
npm run build
```

```bash
cd frontend
npm run build:trip-preview
```

```bash
node --test frontend/tests/trip-preview-integration.test.mjs
```

```bash
git diff --check -- backend/app/domain/places/service.py backend/tests/test_places.py trip/src/final/plan-feature/PlanFeature.jsx trip/src/final/final.css frontend/tests/trip-preview-integration.test.mjs backend/README.md HANDOFF.md
```

Backend targeted pytest was attempted but blocked by missing local test dependency:

```text
ModuleNotFoundError: No module named 'psycopg'
```

The available run still reported 12 passing tests before the PostgreSQL fixture errors.

## 5. Things Intentionally Not Changed

- Trip Cover / Unsplash city cover logic
- Place.image_url and PlanItem.photo_url persistence
- Chat Agent provider routing
- Planner Agent provider routing
- Explainer Agent provider routing
- Session runtime
- Navigation policy
- PlanFeature interaction state ownership
- new validator systems
- targeted repair
- two-pass Planner
- new provider fallback

## 6. Next Agent Notes

If continuing from this state:

1. Use a backend environment with `psycopg[binary]` installed before rerunning DB-backed tests.
2. Do not restore the old Chicago early return in `places_for_planner`.
3. Do not reintroduce activity photos or `PHOTO` placeholders on the Plan page.
4. Keep Trip Cover and Plan stop visuals separate.
5. If modifying the compact card layout again, update `frontend/tests/trip-preview-integration.test.mjs` so the visual contract remains protected.

