# Cadensy / TripSync AI Agent Summary

Last updated: 2026-08-15

## 1. Purpose

This document is the current-state summary for the Cadensy backend AI layer.

It is not a history log and it is not a classroom-demo note. The goal is to help
the next engineer understand:

- what is running on `main` now
- which provider path is active
- where the important seams live
- how Chat Agent, Planner, and Places fit together

If a historical migration story is needed, use the dated handoff documents in
`docs/backend/`.

## 2. Current AI Runtime

Current production-intent backend routing is:

```text
Chat Agent      -> DeepSeek
Planner Agent   -> DeepSeek
Explainer Agent -> DeepSeek
```

Important clarification:

- the backend keeps the route names `chat`, `planner`, and `explainer`
- those names describe the calling scenario, not different vendors
- current real-provider execution is DeepSeek-only
- `MOCK_AI=1` remains the safest local default when real AI is not required

There is no active Ollama or Qwen runtime in the main backend path.

## 3. Product Role Of The AI Layer

The AI layer helps the product with two different jobs:

### Chat Agent

- interpret natural-language user requests
- decide whether a tool should be called
- produce assistant copy for the Trip workspace
- propose changes without directly mutating the plan

### Planner Agent

- generate itinerary structure from candidate places and trip constraints
- choose candidate ids, not invented place names
- work inside the deterministic plan-generation pipeline

### Explainer Route

- shares the same provider routing expectations as the rest of the backend
- should be treated as a scenario label, not a separate vendor lane

## 4. Core Product Principle

The system still follows the same product rule:

> AI proposes. Humans decide.

That principle is enforced by backend boundaries, not by prompt wording alone.

## 5. Architecture Snapshot

```text
React Trip workspace
        |
        | user request / plan generation trigger
        v
FastAPI backend
        |
        +--> domain/chat/service.py
        |        |
        |        +--> agents/base.py call_agent / call_model
        |        +--> agents/tools.py (read-only tools)
        |        +--> constraints + decisions backend
        |
        +--> domain/plans/generator.py
                 |
                 +--> agents/planner.py
                 +--> domain/places/service.py
                 +--> persisted PlanItem rows
```

## 6. Critical Boundaries

These boundaries matter more than any prompt tweak:

### 6.1 Provider/runtime seam

`backend/app/agents/base.py`

This file owns:

- provider selection
- model client construction
- request timeouts
- structured-output model calls
- agent-loop model calls
- conversion of model/runtime errors into backend-safe failures

Do not scatter provider logic into feature modules.

### 6.2 Tool boundary

`backend/app/agents/tools.py`

Tools are the controlled interface between the model and backend facts.

Key rule:

- tools stay read-only

The agent can inspect backend facts and classification outcomes, but it should not
directly write the database.

### 6.3 Decision-path boundary

The decision path is determined by deterministic backend logic, not by the model.

Important areas:

- `backend/app/domain/constraints/engine.py`
- `backend/app/domain/decisions/orchestrator.py`
- `backend/app/domain/chat/service.py`

The model may help interpret requests, but Python rules still decide whether a
request becomes NOTICE, ROUND, CONFIRM, or a no-op.

### 6.4 Planner/place boundary

The planner selects `candidate_id`.

The backend resolves that id back to canonical place facts.

The model must not invent titles, addresses, or local names when a candidate
selection path already exists.

## 7. Important Files

### Backend AI runtime

- `backend/app/agents/base.py`
- `backend/app/agents/tools.py`
- `backend/app/agents/chat.py`
- `backend/app/agents/planner.py`
- `backend/app/agents/trace.py`

### Backend product/domain integration

- `backend/app/domain/chat/service.py`
- `backend/app/domain/plans/generator.py`
- `backend/app/domain/places/service.py`
- `backend/app/domain/constraints/engine.py`
- `backend/app/domain/decisions/orchestrator.py`

### Frontend Trip workspace integration

- `trip/src/final/plan-feature/useAssistantChangeRequestFlow.js`
- `trip/src/final/TripAppState.jsx`
- `trip/src/final/FinalApp.jsx`

Frontend changes must continue to respect the frozen Trip boundaries documented in
`AGENTS.md`.

## 8. Local Development Reality

The safest local backend modes are:

### Rules-only / UI-safe local mode

```env
MOCK_AI=1
```

Use this when validating deterministic decision behavior without paying for or
depending on the provider.

### Real AI local mode

Use the configured DeepSeek environment in `backend/.env`.

The backend should be validated by checking:

- backend traceback when a request fails
- provider credentials and base URL
- database connectivity and seed data
- trip, membership, and session state

Do not diagnose AI failures by looking only at `/docs` or frontend behavior.

## 9. Planner And Places

Current planner quality depends on the full chain, not just the LLM:

```text
trip constraints
    + candidate places
    + place ranking / opening-hours facts
    + planner prompt rules
    + candidate_id selection
    + backend PlanItem conversion
```

If a generated itinerary looks wrong, inspect:

1. whether candidate places were good
2. whether Geoapify/cache facts were complete
3. whether the model chose poor candidate ids
4. whether backend conversion preserved the right place facts

## 10. Validation Expectations

When touching the AI layer, validate the change in the smallest honest way:

- unit tests for routing or conversion logic
- a real backend request when provider behavior is involved
- planner/place end-to-end checks when itinerary output changes
- Trip workspace verification when chatbox or proposal rendering changes

Prompt-only changes without a validation loop are not enough.

## 11. What Is Explicitly Out Of Date

The following should be treated as obsolete for the active backend path:

- any description that says Chat Agent uses Ollama
- any description that says Qwen is the current backend model
- any `.env` example built around `OPENAI_BASE_URL=http://localhost:11434/v1/`
- any instructions that require starting a local Ollama terminal for normal main-branch backend validation

If those details still appear elsewhere, they should be treated as historical
notes only and not as current setup guidance.

## 12. Current Working Rule

Before changing the AI layer, ask:

1. Is this a provider/runtime problem, a tool problem, a planner/place problem,
   or a frontend rendering problem?
2. Does the change cross a frozen boundary?
3. Is the behavior deterministic Python policy or model behavior?
4. What is the smallest real validation that proves the change?

That discipline matters more than adding another prompt or another agent.
