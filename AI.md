# AI Compatibility Note

This file is kept as a compatibility pointer for tools or workflows that still look for
`AI.md` at the repo root.

## Read First

If you are an AI agent starting work in this repository, read these files in this order:

1. `AGENTS.md`
2. `README.md`
3. `INTEGRATION-ROADMAP.md`
4. `交接.md`

If the task is backend cleanup or repo-level refactor planning, also read:

- `docs/HANDOFF_PROMPT_2026-08-11.md`
- `docs/HANDOFF_PROMPT_NEXT_BACKEND_AND_REPO_REFACTOR_2026-08-11.md`
- `docs/navigation-known-wrong-behavior.md`

## Quick Context

- `frontend/` is the main product site and `/trip` host shell.
- `trip/` is still the source for the embedded Trip workspace.
- `backend/` is the FastAPI + PostgreSQL backend.
- `shared/` contains the established cross-app seams.

## Important

Do not treat this file as the main repo rule document.
The active AI working rules now live in `AGENTS.md`.
