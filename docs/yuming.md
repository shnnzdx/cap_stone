# Yuming Selective Merge Notes

This file records the useful product and engineering changes reviewed from `origin/yuming`
and how they relate to the current `New` workspace.

It is intentionally shorter than the original branch handoff. The goal here is not to
mirror the whole branch, but to keep a clean selective-merge ledger for the current repo.

## Why This Merge Looked Slow

`origin/yuming` was pushed in a way that made a very large part of the repository look
"changed" even when the real behavioral delta was much smaller.

That meant the safe path was:

1. read the branch handoff
2. identify which changes were real product or backend behavior
3. merge only those parts
4. leave filename churn, translation-only edits, and unrelated generated noise out

This is slower than force-copying files once, but much safer for the current working
`New` version.

## Source Used

Primary upstream reference reviewed during this selective merge:

- `origin/yuming:docs/yuming.md`

That file is the historical branch record. This local file is the current status record.

## Already Landed In `New`

The current workspace already includes these useful `yuming` behaviors:

1. Demo trip data is opt-in instead of the default path.
2. My Trips uses real trip summaries and keeps fake dashboard trips out of account flows.
3. Creating a trip updates local workspace state immediately.
4. Saving preferences refreshes trip state and returns the user to the Plan page.
5. Account-backed login stays on the `My Trips` dashboard when landing on `/`.
6. Per-activity history is loaded from real `PlanChange` rows only.
7. Initial generation rows are excluded from user-facing activity history.
8. Vote rounds auto-settle once every member has voted.
9. Moving an activity to another date also updates its matching `day_index`.
10. Current plan day headers use canonical trip dates derived from the trip window.
11. Single-member generation no longer treats budget ceiling as a group blocker.
12. Preference dates are validated against the trip date window.
13. Occupied-time changes escalate to the correct decision path instead of silently
    misclassifying overlap cases.
14. Self-only confirmations can auto-apply without waiting for an unnecessary extra step.

## Additional Local Follow-Through In `New`

These items were re-checked locally against the upstream handoff and completed in this
workspace:

### 1. Assistant change card alignment polish

Files:

- `trip/src/final/final.css`

What changed:

- removed the hard left offset from `.changeConfirmCard`
- centered the card with a bounded width
- forced assistant compare cells to stay visually transparent instead of inheriting a
  washed-out overlay

Why:

- this matches the documented `yuming` intent that the assistant change confirmation card
  should read as a clean centered surface

### 2. Decision-path regression coverage

Files:

- `backend/tests/test_paths.py`

What changed:

- added coverage for same-day occupied-time moves opening a `ROUND`
- added read-only classification coverage for the same overlap case
- added self-only confirm auto-apply coverage

Why:

- these backend behaviors were important enough to keep under direct regression tests

### 3. PostgreSQL-backed verification

Local environment note:

- PostgreSQL on `localhost:5432` is now confirmed reachable in the current environment

What was verified:

- focused decision-path regressions passed: `3 passed`
- focused plan/trip regressions passed with an isolated disposable test database:
  `4 passed`

Why the isolated test database was used:

- the existing local `tripsync_test` database should not be dropped blindly
- a disposable override such as `tripsync_test_codex` is safer for focused validation

### 4. Trip handoff documents rewritten into current-state docs

Files:

- `trip/README.md`
- `trip/BACKEND.md`
- `trip/FRONTEND.md`

What changed:

- replaced outdated prototype-oriented guidance with current workspace behavior
- documented the frozen Plan feature boundary and shared navigation/session ownership
- recorded the backend behaviors that are already merged into `New`
- kept the existing filenames instead of pulling in broad upstream rename churn

Why:

- these three files are the most likely handoff entry points for anyone continuing Trip
  integration work
- the old versions mixed historical prototype assumptions with outdated integration notes
- the selective merge goal is to keep the working filenames but refresh the actual content

### 5. Core product and agent docs refreshed without filename churn

Files:

- `docs/AGENTS.md`
- `docs/PRODUCT.md`

What changed:

- replaced garbled or stale content with current-state guidance
- kept the existing local filenames and local repo references
- preserved the high-value upstream ideas from `origin/yuming` around product behavior,
  AI boundaries, privacy, and decision-path ownership
- aligned references to current local files such as `../HANDOFF.md`

Why:

- these docs strongly shape future backend, agent, and product changes
- keeping the filenames stable avoids a large cascade of reference edits across the repo

### 6. Proposal and handoff prompt docs normalized to the current repo

Files:

- `docs/PROPOSAL.md`
- `docs/PROPOSAL_EN.md`
- `docs/HANDOFF_PROMPT_2026-08-11.md`
- `docs/HANDOFF_PROMPT_NEXT_BACKEND_AND_REPO_REFACTOR_2026-08-11.md`

What changed:

- replaced garbled or stale content with readable current-state versions
- preserved the useful upstream product and handoff ideas from `origin/yuming`
- localized repo paths, filenames, and source-of-truth references to the current `New` repo
- removed upstream-specific references such as renamed underscore variants and foreign local
  workspace names

Why:

- these files are either core project rationale or direct handoff material for the next person
- keeping them stale would make future merges and onboarding much harder than the code changes
  themselves

### 7. Root handoff doc moved to the upstream-style filename

Files:

- `HANDOFF.md`

What changed:

- replaced the old garbled root handoff with a fresh current-state handoff
- stored it under `HANDOFF.md` to match the upstream direction
- rewrote the entry content around the current `New` repo, frozen boundaries, local
  commands, and current AI/backend realities

Why:

- the old root handoff had become the least trustworthy entrypoint in the repo
- keeping a separate local-only `交接.md` would drift from the upstream naming you want

## Intentionally Not Merged

The following upstream changes were reviewed and deliberately left out of `New` for now:

### 1. Broad filename renames

Examples:

- `INTEGRATION-ROADMAP.md` -> `INTEGRATION_ROADMAP.md`
- `docs/navigation-known-wrong-behavior.md` -> `docs/navigation_known_wrong_behavior.md`

Reason:

- the current repository and `AGENTS.md` still reference the existing filenames directly
- renaming them now would create large, low-value churn unrelated to the behavior fixes

### 2. Translation-only documentation edits

Reason:

- many of those edits improve wording but do not change runtime behavior
- they are better handled as a separate docs cleanup pass, not mixed into active feature
  integration work

### 3. Generated or static artifact noise

Reason:

- branch-wide force uploads can make built outputs and unrelated touched files look newer
- the selective merge only keeps artifacts that are actually required by merged behavior

## Current Recommendation

For future `yuming` follow-up work in `New`:

1. keep using this file as the selective merge checklist
2. merge behavior first, docs wording second
3. avoid mass file renames until repo references are intentionally updated together
