# Cadensy AI Agent Guide

Read this before building or changing an agent. Product responsibilities are in
[`PRODUCT.md`](PRODUCT.md); this document explains how to implement agents safely.

---

## 1. Prerequisites

| Item | Status | Notes |
|---|---|---|
| Python environment | Done | `backend/.venv` |
| PostgreSQL and seed data | Done | `.venv/bin/python -m app.db.seed` |
| Deterministic classifier | Done | `app/domain/constraints/engine.py` |
| Decision execution | Done | `app/domain/decisions/orchestrator.py` |
| Curated POI catalog | Done | `backend/data/poi_chicago.py` |
| OpenAI key | Local only | Put it in `.env` as `OPENAI_API_KEY` |
| `openai` package | Add if needed | Add to `requirements.txt` |

Never commit a real API key. `.env` is already ignored.

---

## 2. Red Lines

Breaking any of these means the change is wrong:

1. Agent context must never include another member's private raw wording. Use only safe summaries such as `code`, `safe_text`, and `affected_count`.
2. AI does not decide the decision path. `engine.classify()` always decides Notice, Round, Reopen Round, or Confirm.
3. AI does not submit, confirm, or vote for users. A user action must trigger `/changes` or `/decisions`.
4. Trust labels are assigned by code or data source, not by AI self-assessment.
5. Compromise must not pressure users. It proposes candidates; it never argues.
6. **Any agent that reads the whole group's constraints must emit schema-locked output.**
   Compromise is the one agent with visibility into every member's hard limits — that is
   exactly what makes it useful, and exactly where D3 can break. It may return a patch and
   a `safe_reason` chosen from the fixed `SAFE_TEXT` set. It may never write free-form
   prose about *why*. The model reasons; it does not phrase.
7. **Strip constraints before they enter a prompt.** `Constraint` carries `membership_id`
   and `private_note`. Pass only `kind` + `params`. An agent that cannot tell whose limit
   it is cannot attribute it to anyone.

Engineering rule: AI failure must not break the core product. Classification, voting, and confirmations cannot depend on OpenAI availability.

---

## 3. `MOCK_AI`

Every agent must support:

```bash
MOCK_AI=1
```

Mock mode returns deterministic fake responses with the same shape as real responses and makes no network request.

All tests should run under `MOCK_AI=1` so tests are free, offline, and stable.

---

## 4. Directory Shape

```text
app/agents/
├── base.py          shared client, mock switch, safe context
├── chat.py          natural language change -> patch -> explanation
├── explainer.py     verdict -> user-facing explanation
├── preference.py    natural language -> six constraint kinds
├── mediator.py      conflict conversation support
├── planner.py       curated POIs -> itinerary
└── options.py       contested slot -> Round options

app/domain/plans/
└── generator.py     candidate filtering -> Planner -> fallback -> validation -> write
```

Each agent should behave like a pure function: dataclass input to dataclass output. Agents should not write to the database, call FastAPI, or create side effects. Callers perform side effects.

---

## 5. Structured Output

Use strict JSON schema output. Do not parse free text.

Model output that is not machine-validated becomes hard to test and easy to break.

---

## 6. Safe Inputs

### Classification Input

Agents may receive classification output like this:

```json
{
  "path": "confirm",
  "headline": "This breaks a required constraint",
  "detail": "...",
  "needs_reason": false,
  "checks": [
    {
      "id": "required",
      "label": "Required constraint of a member",
      "hit": true,
      "privateNote": "One member has a required constraint here. Who they are and why stays private."
    }
  ],
  "findings": [
    {
      "code": "TIME_WINDOW",
      "text": "This time falls outside a required time window.",
      "affected_count": 1
    }
  ]
}
```

This is safe because it contains no membership ID, no name, and no private raw wording.

### Supported Constraint Kinds

| Kind | Params | Example |
|---|---|---|
| `time_window` | `earliest_hour`, `latest_hour` | no earlier than 9 AM |
| `budget_ceiling` | `max_total_per_person` | maximum $650 |
| `date_range` | `start`, `end` | only available Aug 13-18 |
| `walk_limit` | `max_km_per_day` | no more than 3 km walking per day |
| `dietary` | `required_tags` | vegetarian required |
| `avoid_tag` | `tags` | avoid nightclubs |

`importance` is either `required` or `flexible`. Required can force Confirm; flexible does not change the decision path.

If text cannot map to these six kinds, return `kind: null` with a short explanation. Do not force it into the wrong type.

### POI Catalog

`backend/data/poi_chicago.py` contains curated Chicago points of interest. Each record includes name, area, coordinates, price estimate, duration, opening hours, walking intensity, access tags, diet tags, and interest tags.

Walking, diet, access, and tags are what make deterministic validation possible.

---

## 7. Agent Specs

| Agent | Trigger | Input | Output | Failure |
|---|---|---|---|---|
| Preference | User writes a preference | One natural-language sentence | `{kind, params, importance, restated, confidence}` | Return `kind: null` |
| Explainer | Classification or plan item explanation | Verdict + before/after | Human-readable reason and tradeoff | Hide explanation if unsure |
| Compromise | A change hits a hard limit (Confirm) or a slot is contested (Round) | Feasible slots/POIs computed by rules + anonymous constraint kinds + group interests | `{patch, safe_reason}` — a third option nobody had to ask for | Return the rules' first feasible candidate; if none exists, say so honestly |
| Planner | Initial generation or repair | Anonymous constraints + POI catalog | `PlanItem[]`, one day at a time | Retry once, then mark blocked |
| Options | Round path | Contested slot + public intent | Three options | Fall back to keep/split template |
| Chat | User asks for a change | Message + optional item ID | `reply` and optional `proposed_change` | Apologize and ask for a clearer request |

### `restated`

Preference Agent must restate the understood rule before anything is saved.

Example:

```text
User: My back hurts, so I cannot walk too much.
AI: I will remember this as: keep walking under 3 km per day. Is that right?
User: Yes.
Backend: write MemberConstraint and MemberConstraintPrivate.
```

Without this step, AI would be deciding for the user.

### Compromise — why this agent exists

This is the most important agent in the product, and the reason is structural, not
technical.

**A human cannot propose a compromise without someone disclosing.** To offer "how about
16:00 instead", you must first know what blocks 09:00 — and knowing that means somebody
told you. That is the deadlock at the centre of this product: you cannot negotiate without
exposing, and you cannot protect without blocking negotiation.

**The agent is the only participant that can see every constraint at once.** So it is the
only one that can compute a plan satisfying everyone's hard limits **while nobody says a
word**. That is not "AI for efficiency" — it is the only way "negotiation" and "privacy"
can both be true at the same time.

Before this agent exists, a member's whole vocabulary is *yes* or *no*. The system
adjudicates fairly but offers nothing. Compromise turns choosing into creating.

### Compromise — split it in two

**The feasible set is computed by rules, not by AI.** Which slots satisfy every
`time_window`, stay under the tightest budget ceiling, and respect walk limits is a
constraint-satisfaction problem, and the code already exists:

| Helper | Where | Does |
|---|---|---|
| `_legal_slots()` | `plans/generator.py` | slots a POI may legally occupy |
| `_candidate_valid_after()` | `plans/generator.py` | still legal once this is inserted |
| `_budget_headroom()` | `plans/generator.py` | money left under the tightest ceiling |
| `violates()` | `constraints/engine.py` | one constraint against one change |

**The AI only does two things inside that feasible set:** pick which candidate best matches
the group's interests, and select the `safe_reason` code. Nothing else.

Two consequences worth knowing:

- **This ships without an API key.** The rules half alone already produces a real third
  option. AI only makes the pick smarter. Given that the current blocker is a missing key,
  build the rules half first.
- **"No compromise exists" is a valid, valuable answer** — and it is *provable*, not
  guessed, because the feasible set is computed. Say it plainly (D2's spirit).

### Compromise — output contract

```json
{ "patch": { "start_hour": 16.0 }, "safe_reason": "TIME_WINDOW" }
```

`safe_reason` is a key into `SAFE_TEXT` (`constraints/engine.py`). The model picks the key;
the product renders the sentence. There is no field the model can put prose into — same
discipline as `AnonymizedFinding`, which structurally cannot hold an identity.

**The agent proposes; the rules dispose.** Every generated patch goes through
`engine.classify()` like any human-submitted change, and enters the existing Round or
Confirm flow. The agent never applies anything. This is D13's pattern
("Planner only picks") applied a second time.

### Planner By Day

Generate one day at a time. If day 2 fails, redo day 2 rather than throwing away day 1. Pass previous days into the next day so the plan does not repeat places.

---

## 8. AI Uses the Same Change Door

AI has no privileged change path.

```text
POST /api/plans/items/{item_id}/changes
X-Membership-Id: <AI membership>
```

Returned `path` controls the result:

| Path | Meaning | Applied immediately |
|---|---|---|
| `notice` | Change applies and sends an anonymous notice | Yes |
| `round` / `reopen_round` | Opens a vote; plan unchanged | No |
| `confirm` | Creates a proposal; plan unchanged | No |

Use `/classify` for read-only trial calculation. It accepts the same body and rolls back after classification.

AI-authored changes should be attributed to Cadensy, not anonymous. Also add brakes: the same item should not be edited repeatedly, and one repair cycle should not change more than a small number of items.

---

## 9. Build Order

1. Preference
2. Explainer
3. **Compromise (rules half first — no API key needed)**
4. Planner
5. Options

Do not follow architecture diagrams left to right. Explainer is cheap because it explains data that already exists. Preference is first because it unlocks enforceable constraints.

Compromise moved up because its rules half needs no model at all, and because without it a
member's only vocabulary is yes/no — the product adjudicates but never creates. It is the
piece that makes "negotiation" true.

---

## 10. Minimum Tests

Every agent needs tests for:

```text
MOCK_AI=1 works and makes no network request
Output matches schema
Preference kind is one of six supported kinds or null
Prompt/context contains no membership ID, name, or private raw wording
OpenAI failure does not change classify / changes / votes behavior
```

The privacy prompt test matters most. Capture the constructed prompt/context and assert that it does not contain `MemberConstraintPrivate.original_text`.

Run:

```bash
cd backend
DISABLE_SCHEDULER=1 MOCK_AI=1 .venv/bin/python -m pytest -q
```

---

## 11. Update After Changes

After changing agents, update:

- [`PRODUCT.md`](PRODUCT.md): product-level agent status.
- The handoff notes: implementation progress.
- [`../backend/README.md`](../backend/README.md): API surface or backend behavior changes.
