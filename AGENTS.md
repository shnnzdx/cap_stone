# TripSync Working Rules

This repository should be treated as the single active working copy for the project.

Active repository
- Use `/Users/jiayichen/Desktop/Capstone/cap_stone_target` as the only active project folder.
- Do not continue active development in archived copies such as `tripsync-site_old_do_not_use`.

Branch roles
- `main` is the final, stable branch.
- `jiayi` is Jiayi's draft and day-to-day working branch.

Required branch workflow
1. Before starting new work, sync local `main` with `origin/main`.
2. After `main` is current, switch to `jiayi`.
3. Update `jiayi` from the latest local `main`.
4. Do active implementation work on `jiayi`.
5. Only update `main` when changes are ready to become the final version.

Default command sequence
1. `git checkout main`
2. `git pull origin main`
3. `git checkout jiayi`
4. `git merge main`

Safety rules
- Do not do draft development directly on `main`.
- Do not force push `main`.
- Do not delete, reset, or overwrite user work unless the user explicitly asks for it.
- If local changes would be put at risk by switching branches or pulling, stop and explain the risk first.

Decision priority
1. The user's latest direct instruction
2. This `AGENTS.md`
3. Older workflow habits or assumptions

Instruction for AI agents
- If you are starting work in this project, assume `jiayi` is the working branch unless the user explicitly says otherwise.
- Start by syncing `main`, then update `jiayi`, then continue work on `jiayi`.
