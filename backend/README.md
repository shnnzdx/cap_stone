# Cadensy Backend

Python + FastAPI + PostgreSQL. The backend owns trip data, membership, invite links,
privacy boundaries, plan generation, decision routing, voting, confirmations, and the
append-only plan change log.

Product logic lives in [`../docs/PRODUCT.md`](../docs/PRODUCT.md). Local setup details
live in [`LOCAL_DEV.md`](LOCAL_DEV.md). Current handoff notes live in [`../交接.md`](../交接.md).

---

## Run Locally

Requires PostgreSQL and Python 3.13.

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env
createdb tripsync && createdb tripsync_test
.venv/bin/python -m app.db.seed
.venv/bin/uvicorn app.api.main:app --port 8000 --reload
```

Open http://localhost:8000/docs to try the API.

Run tests:

```bash
DISABLE_SCHEDULER=1 .venv/bin/python -m pytest -q
```

`.venv/bin/python -m app.db.seed` drops and recreates tables. Use it only for local demo data.

## Environment

`.env` is ignored by git.

| Name | Purpose | Default |
|---|---|---|
| `DATABASE_URL` | Main database URL | `postgresql+psycopg://localhost/tripsync` |
| `TEST_DATABASE_URL` | Test database URL, must be separate | `.../tripsync_test` |
| `OPENAI_API_KEY` | AI provider key | none |
| `OPENAI_BASE_URL` | OpenAI-compatible provider override | none |
| `OPENAI_MODEL` | AI model name | `gpt-4o-mini` |
| `MOCK_AI` | Use local deterministic mock for demos/tests | `1` |
| `SETTLE_TICK_SECONDS` | Polling interval for expired rounds | `60` |
| `DISABLE_SCHEDULER` | Disable background jobs for tests | none |
| `DEV_ALLOW_MEMBERSHIP_HEADER` | Allow `X-Membership-Id` dev auth fallback | `1` |
| `FRONTEND_BASE_URL` | Frontend URL used in invite/login links | `http://localhost:5173` |
| `CORS_ORIGINS` | Allowed frontend origins | `http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000` |

Never put real keys in code.

---

## Structure

```text
app/
├── agents/                  AI-facing planner/chat adapters
├── api/main.py              HTTP layer; keep business rules out of route handlers
├── db/
│   ├── models.py            Tables and database invariants
│   ├── seed.py              Demo trip data
│   └── session.py           Database connection
├── domain/
│   ├── constraints/         Deterministic rule engine
│   ├── decisions/           Notice / round / confirm execution
│   ├── plans/               Initial itinerary generation
│   ├── preferences/         Preference and constraint persistence
│   └── trips/               Trip, invite, and membership services
└── jobs/scheduler.py        Round settlement scheduler
tests/                       Backend regression tests
```

Dependency direction should stay one-way: `api` calls `domain`, and `domain` uses `db`.
Do not move core decision logic into API handlers.

---

## Decision Rules

All change classification happens on the server in
[`app/domain/constraints/engine.py`](app/domain/constraints/engine.py). It is deterministic,
does not call AI, and does not read private raw preference text.

Decision order:

| Check | Result |
|---|---|
| Booked item, required constraint violation, budget ceiling violation, or date range violation | `confirm` |
| The slot is already `settled` | `reopen_round` |
| The slot was previously touched by someone | `round` |
| None of the above | `notice` |

Plan item settledness:

| State | Meaning |
|---|---|
| `loose` | AI-generated or untouched; anyone can change it through Notice |
| `touched` | Directly changed once; later competing changes create a Round |
| `settled` | Voted or confirmed; reopening needs a reason and majority support |
| `booked` | Paid/booked; any change must go through Confirm |

Important invariants:

- Silence is never counted as agreement in rounds or confirmations.
- Reopening a settled item requires a reason and majority support.
- One item can have only one open round or one pending proposal at a time.
- Public outputs never include member names or private preference wording.

---

## Roles

Role belongs to `TripMembership`, not `User`. The same user can be organizer in one trip
and participant in another.

| Capability | organizer | participant | guest |
|---|:--:|:--:|:--:|
| View current plan | yes | yes | yes |
| Private AI chat | yes | yes | yes |
| Submit or edit own preferences | yes | yes | yes |
| Vote and confirm | yes | yes | yes |
| Comment on plan items | yes | yes | yes |
| Propose changes | yes | yes | yes |
| View member list / remind / extend deadlines | yes | no | no |
| Generate and revoke invite links | yes | no | no |
| Receive escalated deadlocks | yes | no | no |
| My Trips dashboard / cross-trip account features | yes | yes | no |

Product rules:

- Organizer preferences have no extra weight.
- Organizer cannot read private preferences.
- No role can make decisions for another member.
- Guests are full participants inside the trip. Their limitation is account-level only.
- Guests are deduped by normalized `display_name` within the same trip. Rejoining as
  `Guest Lee` / ` guest lee ` returns the existing guest membership.
- If a guest later saves to an account, keep the same `TripMembership` and update `user_id`.

---

## Privacy

Privacy is structural:

| Layer | Guard |
|---|---|
| Database | Raw user wording is stored in `member_constraint_private`, separate from machine-readable `member_constraint`. |
| Types | Classification returns `AnonymizedFinding`, which has no `membership_id`, name, or raw text field. |
| Notices | `update_notice` intentionally has no actor field. |

Never return:

- `MemberConstraintPrivate.original_text` to the group or organizer.
- Other members' `user_id`, name, or private reason in conflict flows.
- Actor identity on anonymous preference or plan-impact updates.

---

## Core Data

Implemented tables include:

- `user`
- `trip`
- `trip_membership`
- `invite_link`
- `preference`
- `member_constraint`
- `member_constraint_private`
- `plan`
- `plan_item`
- `plan_change`
- `decision_round`
- `vote`
- `change_proposal`
- `proposal_decision`
- `update_notice`

Key notes:

- `invite_link` stores `token_hash`, not the clear token. The clear token is returned once.
- Opening an invite with `GET /api/invites/{token}` never creates membership.
- Account users are unique per trip through `(trip_id, user_id)`.
- Guest dedupe is handled in the invite join service by normalized display name.
- `plan_change` is append-only. Current item state is the original item plus applied changes.
- `PlanItem.source` is set by code, not trusted from AI output.

---

## Plan Generation

`POST /api/trips/{trip_id}/plans/generate` is organizer-only.

Rules:

- Organizer must submit their own preferences first, otherwise return `422`.
- If any `PlanItem` already exists for the trip, reject regeneration with `409`.
- Generation uses the Chicago POI catalog, applies opening hours, duplicate checks,
  budget ceilings, and every required constraint through the deterministic engine.
- If AI planner output is missing, invalid, or violates constraints, the backend falls back
  to rule generation.
- If no valid plan can be produced, return `status: "blocked"` with a safe
  `blocked_reason` and do not write plan items.
- Successful generation writes `PlanItem` rows and `PlanChange.origin` as
  `ai_generate` or `rule_generate`.

---

## API Surface

Implemented:

```text
GET    /api/health
GET    /api/me
GET    /api/trips
GET    /api/trips/{trip_id}
GET    /api/trips/{trip_id}/plans/current
GET    /api/trips/{trip_id}/updates
GET    /api/trips/{trip_id}/actions
GET    /api/rounds/{round_id}
GET    /api/proposals/{proposal_id}
GET    /api/plans/{plan_id}/changes
GET    /api/invites/{token}
GET    /api/trips/{trip_id}/preferences/me
GET    /api/trips/{trip_id}/members

POST   /api/trips
POST   /api/trips/{trip_id}/archive
POST   /api/trips/{trip_id}/unarchive
POST   /api/trips/{trip_id}/invite
POST   /api/trips/{trip_id}/chat
POST   /api/trips/{trip_id}/plans/generate
POST   /api/plans/items/{item_id}/classify
POST   /api/plans/items/{item_id}/changes
POST   /api/updates/{notice_id}/object
POST   /api/rounds/{round_id}/votes
POST   /api/rounds/{round_id}/settle
POST   /api/proposals/{proposal_id}/decisions
POST   /api/invites/{token}/join
POST   /api/invites/{invite_id}/revoke
POST   /api/trips/{trip_id}/constraints
POST   /api/trips/{trip_id}/members/{membership_id}/remind
POST   /api/rounds/{round_id}/extend
POST   /api/proposals/{proposal_id}/escalate
POST   /api/proposals/{proposal_id}/deadlock

PUT    /api/trips/{trip_id}/preferences/me
PATCH  /api/constraints/{constraint_id}
DELETE /api/constraints/{constraint_id}
```

Manual migration for existing local databases:

```sql
ALTER TABLE trip ADD COLUMN archived_at TIMESTAMPTZ;
```

`/classify` and `/changes` accept the same body and use the same decision path. The
difference is that `/classify` rolls back after calculation, while `/changes` executes.

Still missing:

```text
GET    /api/plans/{id}/validation
POST   /api/proposals/{id}/withdraw
POST   /api/plans/items/{id}/comments
```

---

## Tests

Run:

```bash
DISABLE_SCHEDULER=1 MOCK_AI=1 .venv/bin/python -m pytest -q
```

High-value tests protect product promises:

- `test_findings_never_carry_identity_or_wording`
- `test_silence_is_never_counted_as_agreement`
- `test_one_missing_confirmation_blocks_the_change`
- `test_a_minority_cannot_overturn_a_settled_decision`
- `test_same_input_always_gives_same_answer`
