# Cadensy AI Agent Next Steps

This document summarizes the next practical AI-agent work for the current Cadensy codebase.

Cadensy agents are not general chatbots. They are AI-mediated workflow steps:

```text
User natural language
  -> LLM handles ambiguity
  -> structured output
  -> deterministic domain rules validate
  -> human confirms
  -> backend writes
```

Core boundaries:

- AI understands, restates, explains, and proposes.
- Regular code owns facts, permissions, dates, money, conflicts, voting, confirmations, and database writes.
- Agent output must use strict JSON schema.
- Every agent must support `MOCK_AI=1`.
- AI must not submit, confirm, vote, or overwrite the current plan for a user.
- Private wording, membership IDs, and member names must not enter group-facing context or agent prompts.
- If an agent fails, classification, voting, confirmation, and existing plan flows must still work.

Current implementation already follows this direction:

- `backend/app/agents/base.py`: shared model client, mock mode, structured output, safe context.
- `backend/app/agents/chat.py`: natural-language change request -> structured patch -> verdict explanation.
- `backend/app/domain/chat/service.py`: coordinates Chat Agent, target item matching, patch normalization, read-only classify.
- `backend/app/domain/constraints/engine.py`: deterministic Notice / Round / Reopen Round / Confirm classification.
- `backend/app/domain/decisions/orchestrator.py`: executes changes, votes, confirmations, notices, and change log writes.
- `backend/app/domain/preferences/service.py`: reads and writes preferences and six constraint kinds while preserving privacy.

---

## 1. Priority: Preference Agent

This is the best next agent to build.

Why:

- Product logic already defines Preference Agent as a core AI entry point.
- Backend already has `Preference`, `MemberConstraint`, `MemberConstraintPrivate`, and `scan_conflicts()`.
- The missing layer is AI translation: natural language such as "my back hurts, I cannot walk too much" into one enforceable constraint kind.
- It demonstrates the product's privacy model clearly: raw wording is visible only to the user; the system stores an enforceable rule.

Suggested implementation:

```text
backend/app/agents/preference.py
  understand_preference(text) -> PreferenceUnderstanding

backend/app/domain/preferences/agent_service.py
  draft_constraint_from_text()
  confirm_drafted_constraint()

backend/app/api/main.py
  POST /api/trips/{trip_id}/constraints/draft
  POST /api/trips/{trip_id}/constraints/confirm
```

Suggested structured output:

```json
{
  "kind": "walk_limit",
  "params": {"max_km_per_day": 3.0},
  "importance": "required",
  "restated": "I will remember this as: keep walking under 3 km per day.",
  "confidence": 0.82,
  "unsupported_reason": null
}
```

Unsupported input:

```json
{
  "kind": null,
  "params": {},
  "importance": "flexible",
  "restated": "I cannot turn this into a rule the system can enforce.",
  "confidence": 0.2,
  "unsupported_reason": "This does not map to time, budget, date, walking, dietary, or avoid-tag rules."
}
```

Product rules:

- Draft only; do not write to the database.
- User confirmation calls the existing `add_constraint()` path.
- `original_text` can only be stored in `MemberConstraintPrivate`.
- New or stricter constraints scan for conflicts, but they do not automatically rewrite the plan.

Minimum tests:

- `MOCK_AI=1` drafts one of the six supported constraint kinds.
- Unsupported text returns `kind: null`.
- Drafting does not write `MemberConstraint`.
- Confirmation writes both `MemberConstraint` and `MemberConstraintPrivate`.
- Prompt/context contains no private wording, membership ID, or member name.
- If OpenAI is unavailable, `/preferences/me`, `/constraints`, and `/classify` still work.

---

## 2. Priority: Explainer Agent

This is the cheapest visible upgrade.

It needs no new business rule. It turns an existing `Classification` and patch into user-facing explanation:

- Why the path is Notice, Round, Reopen Round, or Confirm.
- What the change affects.
- Whether it touches a booked item, hard constraint, settled slot, or contested slot.
- Only safe anonymous conclusions; never identity or private wording.

Suggested implementation:

```text
backend/app/agents/explainer.py
  explain_change(verdict, before, patch) -> Explanation
```

Reuse the current `chat.py` explanation shape first, then extract shared explanation code if it grows.

---

## 3. Priority: Options Agent

This agent improves the Round path.

Current fixed options:

- Keep current
- New idea
- Split up

Future Options Agent can generate better options from the contested slot and public intent, but it must preserve:

- `keep`
- `split`
- at most one or two AI-generated alternatives

Boundaries:

- AI only generates options.
- Counting votes, handling ties, checking majorities, and settlement stay in `orchestrator.py`.
- If the agent fails, fall back to the fixed options.

---

## 4. Priority: Mediator Agent

This is the strongest "AI coordination" feature, but more complex than Preference or Explainer.

Build after the Confirm conversation UI is stable. It can:

- Restate public positions neutrally.
- Suggest two or three alternatives.
- Remind users that the proposal has not passed, without pressure.
- Suggest escalation to organizer, without deciding for anyone.

Red lines:

- Do not say anything like "everyone is waiting for you."
- Do not read or expose private wording.
- Any new alternative must create a new proposal. Do not mutate a proposal that already has decisions attached.

---

## 5. Priority: Planner Agent

Planner is the most imaginative agent and the easiest to make unsafe. Build it after the smaller agents unless it is needed for a demo.

It must combine:

- `backend/data/poi_chicago.py`
- budget
- dates
- opening hours
- walking constraints
- interest tags

Every generated day must pass deterministic validation. If it fails, retry once. If it still fails, mark the plan blocked instead of publishing an invalid itinerary.

Recommended shape:

```text
generate_day_plan(day_index, constraints, poi_catalog, previous_days)
  -> PlanItem draft[]
```

Generate one day at a time so failures only require redoing the failing day.

---

## 6. Recommended Build Order

1. Preference Agent: gives users a natural-language way to enter enforceable constraints.
2. Explainer Agent: makes existing decisions understandable and improves the demo quickly.
3. Options Agent: makes voting feel more intelligently coordinated.
4. Mediator Agent: adds the visible coordination layer to Confirm.
5. Planner Agent: completes full itinerary generation and repair.

---

## 7. Next Task

Start with a minimal Preference Agent loop:

```text
User enters one preference sentence
  -> AI drafts one of six constraint kinds
  -> Frontend displays the restatement
  -> User confirms
  -> Backend writes MemberConstraint + MemberConstraintPrivate
  -> Backend runs scan_conflicts()
  -> API returns safe conflict summaries
```

This best matches the current architecture and demonstrates Cadensy's difference: AI helps users express complex preferences, while deterministic, testable rules protect fairness and privacy.
