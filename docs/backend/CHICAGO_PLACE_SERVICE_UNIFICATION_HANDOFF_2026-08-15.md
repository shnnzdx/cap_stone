# Chicago Place Service Unification Handoff

Last updated: 2026-08-15

## 1. Purpose

This document records the backend handoff for removing the formal Chicago-only Planner candidate path.

The product goal was to keep the existing curated Chicago data in the repository, but stop using it as a separate official source during Plan generation.

## 2. Current Verdict

Formal Plan generation now uses one candidate path for all destinations.

Current flow:

```text
Planner
  -> Place Service
  -> PostgreSQL Place cache
  -> Geoapify when cache is missing or insufficient
  -> normalize / upsert cache
  -> Planner candidates
```

This applies to:

- Chicago
- Tokyo
- Paris
- New York
- Washington DC
- other supported destinations

## 3. What Changed

Changed file:

- `backend/app/domain/places/service.py`

Removed from the formal Place Service path:

- `from data.poi_chicago import POIS`
- `_is_chicago(...)`
- `_chicago_places(...)`
- the early return that produced `curated_chicago:*` candidates for Chicago

Kept in the repository:

- `backend/data/poi_chicago.py`

The curated data is still useful for:

- legacy reference
- tests
- demo fixtures
- compatibility
- historical data comparison

It is not the formal Planner candidate source anymore.

## 4. Behavior Now True

For Chicago, Place Service now behaves like every other destination:

```text
places_for_planner(db, "Chicago, USA")
  -> canonical destination handling
  -> read geoapify rows from place cache where city = Chicago
  -> if cache is insufficient, call Geoapify
  -> upsert provider rows
  -> return geoapify:<provider_place_id> candidate ids
```

Provider unknowns remain unknown:

- unknown price stays `None`
- unknown duration stays `None`
- unknown opening hours stay `None`
- unknown walking level stays `None`

The old curated Chicago estimates are no longer copied into formal Planner candidates.

## 5. Candidate Identity

Chicago candidates now use the same candidate id shape as other provider-backed places:

```text
geoapify:<provider_place_id>
```

The old shape is no longer produced by formal Place Service:

```text
curated_chicago:<index>
```

This keeps Planner behavior aligned with the current candidate-id contract: the model chooses candidate ids, and backend resolves names from the Place cache facts.

## 6. Tests Updated

Changed file:

- `backend/tests/test_places.py`

New/updated assertions cover:

- Chicago calls the shared provider/cache path when cache is missing
- Chicago reads existing Geoapify cache without fetching when enough data exists
- Chicago candidates are returned as `geoapify:*`
- old curated metadata is not injected into provider-backed candidates

## 7. Documentation Updated

Changed files:

- `backend/README.md`
- `HANDOFF.md`

The old statement that Chicago formally uses `data/poi_chicago.py` was replaced with the current single-path Place Service behavior.

## 8. Validation Record

Syntax validation:

```bash
python3 AST syntax check for:
  backend/app/domain/places/service.py
  backend/tests/test_places.py
```

Result: passed.

Backend targeted pytest attempted:

```bash
cd backend
/opt/anaconda3/bin/pytest tests/test_places.py
```

Observed result:

```text
12 passed
6 errors
```

The 6 errors are environment setup errors from the local Anaconda test environment missing `psycopg`, which is required by the PostgreSQL test fixture:

```text
ModuleNotFoundError: No module named 'psycopg'
```

No backend assertion failure was observed in the available environment.

## 9. Known Boundaries

- This change does not delete `backend/data/poi_chicago.py`.
- Chat replacement tools may still have legacy Chicago-specific behavior in separate agent-tool paths. This handoff only covers formal initial Plan candidate sourcing through Place Service.
- No AI provider routing was changed.
- No Planner prompt, meal logic, preference logic, opening-hours logic, or geographic clustering logic was intentionally changed in this step.

