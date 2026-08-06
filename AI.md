## Agent Skills

### Issue Tracker

Issues for this repo are tracked in GitHub Issues for `shnnzdx/cap_stone`. See `docs/agents/issue-tracker.md`.

### Domain Docs

This repo uses a single-context domain-doc layout rooted at `CONTEXT.md` with ADRs under `docs/adr/`. See `docs/agents/domain.md`.

## Project Context

- The main product site lives in `frontend/`.
- The `trip/` directory contains the TripSync workspace app.
- The built TripSync static assets are copied into `frontend/public/trip-app/`.
- Project docs and supporting files live under `docs/`.

## Working Notes For Agents

- Prefer reading `README.md` before making workspace-level changes.
- When working on product code, inspect whether the change belongs in `frontend/` or `trip/` before editing.
- If domain terms or important architectural decisions become clearer during implementation, capture them in `CONTEXT.md` or `docs/adr/` rather than leaving them only in chat.
