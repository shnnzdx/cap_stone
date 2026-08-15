# AI System Guide

This is the root entry document for AI-related work in this repository.

It replaces the old compatibility-only note and points to the current AI system shape, boundaries, and next-reference docs.

## Read Order

If your task touches chat, planner, prompts, model providers, tool calling, or AI product behavior, read:

1. `AGENTS.md`
2. `README.md`
3. `AI.md`
4. `docs/backend/CHAT_AGENT_V1_HISTORY_AND_FUTURE_2026-08-15.md`
5. `docs/backend/yuming/Cadensy-AI-系统地图.md`

For backend setup and execution details, also read:

- `backend/README.md`
- `backend/LOCAL_DEV.md`

## Current AI Scope

There are two different AI-adjacent systems in this repo:

### 1. Planner workflow

- entry: `backend/app/domain/plans/generator.py`
- model call shape: single structured model call
- purpose: choose candidate places for a day
- note: this is not the chat agent

### 2. Chat Agent

- entry: `backend/app/domain/chat/service.py`
- runtime: `backend/app/agents/base.py`
- tools: `backend/app/agents/tools.py`
- purpose: understand natural-language change requests, inspect plan facts, classify impact, and return `proposed_change` or `candidate_options`

## Current Product State

Current validated status:

- Chat Agent V1 is functionally complete for the current capstone scope
- the agent remains read-only until the user clicks `Apply`
- backend rules still authoritatively decide `notice`, `round`, `reopen_round`, and `confirm`
- candidate options, multi-turn references, and failure fallback are already connected end to end

Reference:

- `docs/backend/CHAT_AGENT_V1_HISTORY_AND_FUTURE_2026-08-15.md`

## Non-Negotiable Boundaries

Do not break these boundaries without an explicit product decision:

1. AI does not directly mutate trip state.
2. AI does not decide the authoritative path classification.
3. The Current Plan does not change until the user applies a change.
4. Tooling should remain read-only unless a deliberate architecture change is approved.
5. Failure fallback must remain deterministic and safe.

Short version:

```text
AI proposes.
Backend rules decide.
Humans apply.
```

## Important Files

Core runtime:

- `backend/app/agents/base.py`
- `backend/app/agents/chat.py`
- `backend/app/agents/tools.py`
- `backend/app/domain/chat/service.py`
- `backend/app/api/main.py`

Planner path:

- `backend/app/agents/planner.py`
- `backend/app/domain/plans/generator.py`

Decision engine:

- `backend/app/domain/constraints/engine.py`
- `backend/app/domain/decisions/orchestrator.py`

Frontend assistant seam:

- `trip/src/final/plan-feature/useAssistantChangeRequestFlow.js`
- `trip/src/final/plan-feature/PlanFeature.jsx`
- `trip/src/final/TripAppState.jsx`

## What Not To Do

- Do not migrate to a new agent framework casually.
- Do not add autonomous write paths that bypass Apply.
- Do not move rule ownership into prompts.
- Do not treat the planner and chat agent as the same subsystem.
- Do not tune prompts without validating the real end-to-end behavior they affect.

## Best Follow-Up Docs

- `docs/backend/CHAT_AGENT_V1_HISTORY_AND_FUTURE_2026-08-15.md`
- `docs/backend/yuming/Cadensy-AI-系统地图.md`
- `backend/app/agents/AI_AGENT_SUMMARY.md`
- `docs/backend/yuming/AI-AGENT-工作规则.md`
