# AI Agent Build Rules

Read this before editing agent code, prompts, schemas, or AI-side backend behavior.

This file is about implementation rules for agents. For current repo-level context and product references, start from:

- `../AI.md`
- `../README.md`
- `../HANDOFF.md`
- `class/PRODUCT.md`
- `../trip/BACKEND.md`

## 1. Purpose

The agent system exists to help Trip users:

- translate natural-language preferences into structured constraints
- explain trade-offs
- mediate anonymous conflict conversations
- generate and repair itineraries
- suggest options for contested slots

It does not own fairness policy. Fairness-critical path classification stays deterministic and
backend-owned.

## 2. Current Prerequisites

These are the important local prerequisites for agent work:

| Area | Current state | Notes |
| --- | --- | --- |
| Python environment | available | `backend/.venv` |
| PostgreSQL | required for real backend flows | local checks should use `localhost:5432` |
| Demo/runtime data | available | `python -m app.db.seed` or `python -m app.db.enable_auth` |
| Classification engine | implemented | `backend/app/domain/constraints/engine.py` |
| Decision path execution | implemented | `backend/app/domain/decisions/orchestrator.py` |
| Planner pipeline | implemented with fallback | `backend/app/domain/plans/generator.py` |
| Curated place library | available | `backend/data/poi_chicago.py` |
| OpenAI-compatible runtime | optional in local dev | use `MOCK_AI=1` by default |

Never commit real API keys or secret values.

## 3. Non-Negotiable Red Lines

A change is wrong if it violates any of these:

1. Agent context must never contain another member's private raw wording.
2. AI must not classify which decision path a change takes.
3. AI must not submit or confirm on behalf of a member without an explicit product rule.
4. Confidence labels must be assigned by code or data provenance, not self-reported by the model.
5. The mediator must not pressure members with language like "you are the last one."

Engineering red line:

- AI failure must not break core decision flows. Classification, voting, settlement, and
  confirm behavior must stay valid when model calls fail, time out, or are disabled.

## 4. `MOCK_AI` Is Required

Local development and tests must support:

```bash
MOCK_AI=1
```

Meaning:

- no paid model call is required for tests
- the same schema shape must be returned as in the real path
- demos remain usable if the model provider is unavailable

Agent work is not finished unless mock mode is stable.

## 5. Directory Ownership

Current important agent-related files:

```text
backend/app/agents/
|-- base.py
|-- chat.py
|-- explainer.py
|-- planner.py
`-- ...

backend/app/domain/plans/
`-- generator.py

backend/app/domain/decisions/
`-- orchestrator.py
```

Rules:

- agents should prefer pure-function style input/output
- callers own side effects such as writes, proposal creation, and route orchestration
- do not hide backend business rules inside prompt text

## 6. Structured Output Only

Use schema-shaped outputs for agent calls.

Do not rely on free-text parsing when a typed structure can be enforced. Broken braces should
not be able to break product behavior.

## 7. Safe Context Boundary

Agent-visible classification context should remain privacy-safe.

Allowed examples:

- sanitized findings
- safe decision summaries
- public plan item data
- candidate places and constraint-safe metadata

Disallowed examples:

- another member's raw private note
- secret identity mapping for anonymous conflict participants
- internal session secrets

If a field is not already part of the safe payload, do not reconstruct it from private tables.

## 8. Supported Constraint Shapes

Current structured constraint kinds are:

- `time_window`
- `budget_ceiling`
- `date_range`
- `walk_limit`
- `dietary`
- `avoid_tag`

Constraint translation rules:

- return a structured kind only when the request really fits
- return `kind: null` with a plain explanation if it does not fit
- require user confirmation of the restated meaning before treating translation as accepted

## 9. Agent Roles

Current practical agent responsibilities:

| Agent area | Responsibility |
| --- | --- |
| Preference | Turn user wording into a checkable constraint candidate plus user-facing restatement. |
| Explainer | Explain why a plan or change works, what it trades off, and what remains uncertain. |
| Mediator | Help anonymous conflict conversations stay constructive without deciding for users. |
| Planner | Select itinerary candidates that still pass deterministic validation. |
| Options | Suggest multiple choices for a contested slot, including split-up when relevant. |
| Chat | Help a single user dry-run changes and understand impact before execution. |

## 10. AI Change Execution Rule

There is no privileged AI backdoor for itinerary edits.

AI-authored changes must still go through the same backend change pathway used by users.
That means the backend decides whether the result is:

- `notice`
- `round`
- `reopen_round`
- `confirm`

AI can suggest and submit within product rules, but it cannot bypass those path outcomes.

## 11. Current Local Product Constraints

These local merged behaviors matter for agent work too:

- account-backed users stay on `My Trips` when they land on workspace home
- guest-backed sessions still return into their trip
- vote rounds can auto-settle once every member has voted
- self-only confirms can auto-apply immediately
- blocked plan generation has multiple reasons, not just budget
- single-member trips no longer treat budget ceiling as a group blocker
- preference dates are validated against the trip date window

Agents must not produce guidance that contradicts these current backend behaviors.

## 12. Recommended Build Order

If more agent work continues, the safest order is:

1. Preference translation
2. Explainer quality
3. Mediator quality
4. Planner quality
5. Options generation

This order keeps visible value high while core fairness rules remain backend-owned.

## 13. Minimum Test Expectations

Each meaningful agent change should keep or add coverage for:

- `MOCK_AI=1` behavior
- schema-shaped output validity
- privacy-safe prompt/context construction
- backend behavior remaining stable when model calls fail

Particularly important:

- tests should prove private raw wording does not enter model-visible context
- tests should prove core path behavior still works with AI disabled

## 14. After Updating Agent Behavior

When agent responsibilities or guarantees change, update:

- `../AI.md`
- `class/PRODUCT.md`
- `../trip/BACKEND.md`
- `../HANDOFF.md`
- relevant backend tests
