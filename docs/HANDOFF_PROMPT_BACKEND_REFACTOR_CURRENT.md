# Handoff Prompt: Backend And Repo Refactor

Last refreshed: August 16, 2026

Use this when the next task is backend cleanup, architecture assessment, repo consolidation, or
related structural work.

This document replaces the older backend-refactor-specific prompt:

- `docs/HANDOFF_PROMPT_NEXT_BACKEND_AND_REPO_REFACTOR_2026-08-11.md`

```text
You are taking over `C:\Users\zdxzh\Desktop\capstone\New`.

Read these first:

- `AGENTS.md`
- `README.md`
- `INTEGRATION-ROADMAP.md`
- `HANDOFF.md`
- `backend/README.md`
- `backend/LOCAL_DEV.md`
- `docs/HANDOFF_PROMPT_CURRENT.md`
- `docs/navigation-known-wrong-behavior.md`
- `trip/BACKEND.md`

Check `git status` before editing. There may be unrelated user work in progress.

1. Architecture conclusions already reached:

- navigation policy belongs in `shared/trip-navigation-policy/`
- technical session ownership belongs in `shared/session-runtime/`
- Plan workspace behavior belongs under `trip/src/final/plan-feature/`
- `FinalApp` should remain mostly a route mount, composition, and command-execution layer
- initial plan generation ownership already belongs to backend generation flow

Do not casually reopen these boundaries unless code evidence shows they have regressed.

2. Better current directions:

- backend architecture assessment before broad backend rewrites
- test baseline stabilization
- build stability cleanup
- narrow service/helper extraction where it reduces real complexity
- stale docs or stale glue cleanup only when the deletion test passes

3. Poor current directions:

- refactoring only because a file is large
- reopening frozen Candidate 1, 2, or 3 without new evidence
- turning `shared/` into a general dumping ground
- moving files around without changing true ownership

4. Default working method:

1. establish current behavior
2. identify the deeper boundary
3. list migration risk
4. add or preserve the right tests
5. move one small coherent unit
6. delete duplicate behavior after tests pass

5. Backend cleanup rules:

- AI must not choose decision paths
- safe contexts must not include private raw text or member identity leakage
- non-response must not become agreement
- organizers must not gain extra decision weight
- do not call FastAPI route functions from other route functions
- keep database invariants even when application guards exist

6. Strong backend candidate areas:

- repeated payload shaping across related routes
- reusable service helpers with explicit IDs and dependencies
- membership and request-identity resolution boundaries
- safe AI context construction
- plan generation staging and validation clarity

Weak candidates are broad cleanup ideas with no boundary test.

7. Repo cleanup rule:

Use the deletion test.

If removing a file would not change:

- build behavior
- tests
- active docs references
- source contracts
- current workflows

then it may be archival or removable.

8. Assessment output format:

- Current behavior
- Candidate boundary
- Why this boundary is deeper
- Files affected
- Tests to preserve or add
- Migration plan
- Risks and rollback

9. Source-of-truth reminder:

- `frontend/`
- `trip/`
- `backend/`
- `shared/`
- `docs/`
- `AWS/`

Generated or secondary:

- `frontend/public/trip-app/assets/`
- `trip/dist/`
- `frontend/dist/`

10. Safest starting point:

Start with one narrow backend architecture assessment target, not a repo-wide rewrite.
```
