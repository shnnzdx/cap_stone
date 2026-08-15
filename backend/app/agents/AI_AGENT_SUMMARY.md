# Cadensy / TripSync AI Agent Summary

> **Purpose:** Classroom demo version of the Cadensy AI Agent  
> **Goal:** Use the minimum viable AI Agent to complete the core group-travel decision workflow within one day.  
> **Current setup:** Local Ollama + Qwen3.5 + FastAPI backend + PostgreSQL + React/Vite frontend

---

## 1. What this AI Agent does

The AI Agent acts as a **group travel coordinator**.

It does **not** automatically make every travel decision. Its main responsibility is:

1. Understand a user's natural-language change request.
2. Convert the request into structured data.
3. Send the structured change to deterministic backend rules.
4. Determine whether the change should follow:
   - **NOTICE**
   - **ROUND**
   - **CONFIRM**
5. Explain the result in natural language.
6. Show a proposed change to the user.
7. Wait for the human to click **Apply / Confirm / Dismiss** before the Current Plan changes.

In simple words:

```text
User says what they want
        ↓
AI understands the request
        ↓
Backend checks real trip rules
        ↓
NOTICE / ROUND / CONFIRM
        ↓
AI explains why
        ↓
Human decides
        ↓
Current Plan is updated
```

The core product principle is:

> **AI proposes. Humans decide.**

---

## 2. What the Agent does NOT do

To keep the classroom demo stable and achievable in one day, the following features were intentionally excluded:

- Multi-Agent collaboration
- AutoGen
- Complex LangGraph workflows
- RAG
- Vector database
- Embeddings
- Long-term conversational memory
- Automatic hotel / flight booking
- Automatic payment
- AI directly modifying the database without human confirmation
- Full autonomous trip planning from scratch
- Multiple specialized agents such as:
  - Preference Agent
  - Planning Agent
  - Conflict Agent
  - Validation Agent

The current version uses **one coordinator-style AI Agent**.

This is enough to demonstrate real Agent behavior because the LLM is not only chatting — it participates in a larger workflow and works together with backend tools/rules.

---

# 3. High-Level Architecture

```text
┌──────────────────────────┐
│        React UI          │
│    Cadensy / TripSync    │
└────────────┬─────────────┘
             │
             │ User natural language
             ▼
┌──────────────────────────┐
│     FastAPI Backend      │
│                         │
│ /api/trips/{id}/chat     │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│      Chat Agent          │
│                         │
│ Qwen3.5 via Ollama       │
│                         │
│ Understand user intent   │
└────────────┬─────────────┘
             │
             │ Structured change
             ▼
┌──────────────────────────┐
│ Deterministic Rule Engine│
│                         │
│ booking?                 │
│ required constraint?     │
│ existing disagreement?   │
└────────────┬─────────────┘
             │
       ┌─────┼─────┐
       ▼     ▼     ▼
    NOTICE  ROUND CONFIRM
       │     │     │
       └─────┼─────┘
             ▼
┌──────────────────────────┐
│       AI Explanation     │
│                         │
│ Explain result clearly   │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│     Proposed Change      │
│                         │
│ Apply / Not quite        │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│        Human Action      │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│      PostgreSQL DB       │
│                         │
│ Current Plan / Updates   │
└──────────────────────────┘
```

---

# 4. Technology Stack

## Frontend

- React
- Vite
- Existing Cadensy / TripSync UI
- Local frontend:
  - `http://localhost:5173/trip-app/`

## Backend

- Python
- FastAPI
- SQLAlchemy
- PostgreSQL
- OpenAI Python SDK used through an OpenAI-compatible endpoint

## AI Model

- Ollama
- `qwen3.5:4b`
- Runs locally on the Mac
- No per-request API fee

Ollama local endpoint:

```text
http://localhost:11434
```

OpenAI-compatible endpoint:

```text
http://localhost:11434/v1/
```

---

# 5. Important Project Files

## Frontend

```text
trip/src/final/FinalApp.jsx
```

Main UI for:

- Plan
- Edit time
- Cadensy conversation
- Proposed Change
- Apply / Not quite
- Notice / Round / Confirm display

```text
trip/src/final/TripAppState.jsx
```

Handles frontend state and backend requests such as:

```text
POST /api/trips/{trip_id}/chat
```

---

## Backend

```text
backend/app/agents/base.py
```

Shared model-calling logic.

Main responsibilities:

- Load model settings
- Call Qwen through Ollama
- Require structured output
- Handle timeouts
- Convert model failures into `AgentUnavailable`

Important local-demo settings:

```python
timeout=60.0
temperature=0
reasoning_effort="none"
```

Why:

- Local Qwen can be slower than cloud APIs.
- `reasoning_effort="none"` prevents Qwen from spending too long in thinking mode.
- `temperature=0` makes structured output more stable.

---

```text
backend/app/agents/chat.py
```

Main language-understanding Agent.

Responsibilities:

- Understand user requests
- Extract:
  - intent
  - target item
  - requested changes
- Produce a structured patch

Example:

```text
User:
Move this to 3:30 PM.
```

Becomes approximately:

```python
{
    "intent": "change",
    "item_hint": "item-id",
    "patch": {
        "start_hour": 15.5
    }
}
```

---

```text
backend/app/domain/chat/service.py
```

Coordinates the full chat flow.

Conceptually:

```text
chat_agent.understand()
        ↓
classify_change()
        ↓
chat_agent.explain()
```

This is the core Agent workflow.

---

# 6. Hybrid AI Design

Cadensy intentionally uses a **hybrid architecture**:

## AI handles fuzzy tasks

The LLM is responsible for:

- Understanding natural language
- Detecting user intent
- Identifying what the user wants to change
- Explaining the decision in human-friendly language

Examples:

```text
"Can we do the museum later?"
"Move this to 3:30 PM."
"Can we move dinner earlier?"
```

---

## Deterministic code handles exact tasks

Normal backend code is responsible for:

- Exact time parsing
- Database truth
- Booking status
- Required constraints
- Conflict rules
- Privacy
- Who must confirm
- Whether the plan is allowed to change

For example:

```text
3:30 PM
```

should become:

```text
15.5
```

using deterministic code instead of asking the LLM to perform time arithmetic.

This prevents a problem we observed during development where the model interpreted `3:30 PM` as `15.0`.

---

# 7. The Three Decision Paths

## Path A — NOTICE

Use when:

- No hard constraint is violated
- No confirmed booking is affected
- No existing disagreement exists

Example:

```text
Art Institute of Chicago
2:00 PM → 3:30 PM
```

Result:

```text
NOTICE
No conflict — this can apply now.
```

User can click:

```text
Apply
```

Then:

- Current Plan changes
- Database updates
- Updates page receives a record

Example update:

```text
Art Institute of Chicago was updated

Applied directly — nothing hard was affected
and nobody else had asked about this slot.
```

---

## Path B — ROUND

Use when:

- A slot already has a competing suggestion
- The system should not overwrite an existing idea
- The group needs to decide between options

Concept:

```text
Current idea
       +
Another member's idea
       ↓
ROUND
       ↓
Group decision
```

Possible choices can include:

- Keep current
- New idea
- Split up

---

## Path C — CONFIRM

Use when:

- A confirmed reservation/booking is affected
- A hard/required constraint is affected
- Specific members must approve before the Current Plan changes

Example:

```text
Architecture cruise
10:00 AM → 6:00 PM
```

If there is a confirmed reservation:

```text
CONFIRM
This touches a confirmed booking.
```

Another example:

```text
Birthday dinner
7:00 PM → 6:00 PM
```

Result:

```text
CONFIRM
```

The Current Plan stays unchanged until the required confirmation flow completes.

---

# 8. Privacy Design

A major product rule is:

> **Who is affected may be known to the system, but private reasons should not be exposed to everyone.**

The UI can show:

```text
Member A
Member B
Member C
```

instead of real identities.

It can also show:

```text
Names hidden
Personal reasons hidden
```

The AI should never invent or reveal another member's private preference.

---

# 9. Current Local Environment

## Backend `.env`

Example:

```env
DATABASE_URL=postgresql+psycopg://tripsync_user:<DB_PASSWORD>@localhost:5432/tripsync
TEST_DATABASE_URL=postgresql+psycopg://tripsync_user:<DB_PASSWORD>@localhost:5432/tripsync_test

OPENAI_API_KEY=ollama
OPENAI_BASE_URL=http://localhost:11434/v1/
OPENAI_MODEL=qwen3.5:4b
MOCK_AI=0
```

Important:

> Never commit `.env` to GitHub.

---

## Frontend `trip/.env`

Example:

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_TRIP_ID=<DEMO_TRIP_ID>
VITE_MEMBERSHIP_ID=<DEMO_MEMBERSHIP_ID>
```

These values simulate the logged-in classroom demo user.

The current demo user is Mia / Organizer.

---

# 10. Local Setup

## 10.1 PostgreSQL

PostgreSQL is running locally on:

```text
localhost:5432
```

Database:

```text
tripsync
```

Test database:

```text
tripsync_test
```

---

## 10.2 Seed Demo Data

From:

```bash
cd backend
```

run:

```bash
.venv/bin/python -m app.db.seed
```

This creates the Chicago classroom demo data.

Typical output:

```text
trip_id: ...
plan_id: ...
members: 6
items: 9
```

Important:

> Seeding may regenerate IDs.  
> If the database is reseeded, update `trip/.env`.

---

# 11. How to Run the Demo

## Terminal 1 — Ollama

Make sure Ollama is running.

Check the model:

```bash
ollama list
```

The model should include:

```text
qwen3.5:4b
```

Quick test:

```bash
ollama run qwen3.5:4b
```

Exit with:

```text
/bye
```

---

## Terminal 2 — Backend

```bash
cd ~/Desktop/cap_stone/backend
source .venv/bin/activate
.venv/bin/uvicorn app.api.main:app --host 0.0.0.0 --port 8000 --reload
```

Expected:

```text
Application startup complete.
```

Health check:

```text
http://localhost:8000/api/health
```

API docs:

```text
http://localhost:8000/docs
```

---

## Terminal 3 — Frontend

```bash
cd ~/Desktop/cap_stone/trip
npm run dev
```

Open:

```text
http://localhost:5173/trip-app/
```

---

# 12. Recommended Classroom Demo Flow

## Step 1 — Explain the problem

Say:

> Group travel is not only about generating an itinerary.  
> The harder problem is what happens when one person wants to change a shared plan.

---

## Step 2 — Show the Current Plan

Open:

```text
Mia's 30th in Chicago
```

Then:

```text
Plan
```

---

## Step 3 — Demo NOTICE

Choose:

```text
Art Institute of Chicago
```

Open:

```text
Edit time
```

Say:

```text
Move this to 3:30 PM.
```

Expected:

```text
NOTICE
No conflict — this can apply now.
```

Click:

```text
Apply
```

Then show:

```text
Updates
```

Expected:

```text
Art Institute of Chicago was updated
```

---

## Step 4 — Demo CONFIRM

Choose a booked item such as:

```text
Architecture cruise
```

or:

```text
Birthday dinner
```

Example request:

```text
Move this to 6:00 PM.
```

Expected:

```text
CONFIRM
This touches a confirmed booking.
```

Explain:

> The Agent does not directly overwrite the Current Plan.  
> The affected people must confirm first.

---

## Step 5 — Demo ROUND

Use an item/slot with an existing competing suggestion.

Expected:

```text
ROUND
```

Explain:

> The system detects that there is already another idea for this slot, so it opens a group decision instead of silently overwriting the plan.

---

# 13. Why This Is an AI Agent, Not Just a Chatbot

A normal chatbot:

```text
User message
    ↓
LLM
    ↓
Text response
```

Cadensy:

```text
User message
    ↓
LLM understands request
    ↓
Structured action
    ↓
Backend checks real data and business rules
    ↓
NOTICE / ROUND / CONFIRM
    ↓
LLM explains result
    ↓
Human decision
    ↓
Database / Current Plan
```

The key difference:

> The AI participates in a real business workflow instead of only generating text.

---

# 14. Short Classroom Explanation

## English

> Our AI Agent acts as a coordinator for collaborative group travel.  
> When a member asks to change the itinerary, the LLM first interprets the natural-language request and converts it into structured data.  
> Then deterministic backend rules check bookings, hard constraints, and existing conflicts.  
> Based on those checks, the system routes the request into Notice, Round, or Confirm.  
> The AI explains the result, but it never directly overrides the Current Plan. The final action remains human-controlled.

---

## Very Short Version

> The LLM understands what the user wants, backend rules decide what is allowed, and humans make the final decision.

---

# 15. Why Only One Agent?

For the classroom prototype, the project intentionally uses one coordinator Agent instead of multiple Agents.

Reasons:

- Faster to develop
- Easier to debug
- More stable for a live demo
- Lower compute cost
- Avoids unnecessary Agent-to-Agent conversations
- Critical business logic already lives in deterministic backend rules

A good classroom answer:

> We intentionally used a single coordinator Agent for the prototype. The LLM handles ambiguous language understanding and explanations, while deterministic backend services enforce critical business rules. A multi-agent architecture would add complexity without improving the core workflow for this demo.

---

# 16. Why Use Local Ollama?

Current classroom version:

```text
Qwen3.5:4b
        ↓
Ollama
        ↓
Mac
```

Advantages:

- No API fee
- No API key required
- Works offline after model download
- Good enough for classroom demonstration
- Supports structured outputs

Limitation:

> Other users cannot use the local model unless the machine running Ollama is accessible as a server.

---

# 17. Future Cloud Deployment

The code is designed so the model provider can be changed through environment variables.

Current local setup:

```env
OPENAI_API_KEY=ollama
OPENAI_BASE_URL=http://localhost:11434/v1/
OPENAI_MODEL=qwen3.5:4b
```

Future cloud setup could become:

```env
OPENAI_API_KEY=<CLOUD_API_KEY>
OPENAI_BASE_URL=<CLOUD_MODEL_ENDPOINT>
OPENAI_MODEL=<CLOUD_MODEL_NAME>
```

The main application architecture does not need to be rewritten.

Similarly, local PostgreSQL:

```text
localhost:5432
```

can later be replaced by a cloud PostgreSQL hostname through:

```env
DATABASE_URL=...
```

---

# 18. Important Development Fixes Made

During local integration, the following issues were resolved:

## Qwen timeout

Problem:

```text
APITimeoutError: Request timed out
```

Cause:

- Qwen thinking mode + strict structured output took too long.

Fix:

```python
timeout=60.0
reasoning_effort="none"
temperature=0
```

---

## Time parsing error

Problem:

```text
3:30 PM
```

was once interpreted by the LLM as:

```text
15.0
```

instead of:

```text
15.5
```

Fix:

- Use the LLM to understand intent.
- Use deterministic code to parse exact clock times.

Principle:

> AI for ambiguity; code for exact values.

---

## PostgreSQL authentication

Local development now uses:

```text
username + password + localhost:5432
```

instead of relying on implicit local authentication.

This is closer to a future cloud deployment pattern.

---

## Frontend session

The classroom demo uses:

```text
VITE_TRIP_ID
VITE_MEMBERSHIP_ID
```

to simulate a logged-in organizer.

---

# 19. Demo Reset Checklist

Before class:

1. Make sure PostgreSQL is running.
2. Make sure Ollama is running.
3. Confirm `qwen3.5:4b` exists.
4. Seed the demo database if needed.
5. If reseeded:
   - retrieve the new Trip ID
   - retrieve the new Membership ID
   - update `trip/.env`
6. Start backend.
7. Start frontend.
8. Test one Agent request before presenting.
9. Avoid modifying code immediately before the demo.

---

# 20. Final One-Sentence Product Description

> **Cadensy is an AI-mediated group travel coordination system that understands change requests, checks who and what is affected, routes the decision to the right people, and updates the shared Current Plan only after the required human decision.**

---

# 21. Current Prototype Scope

### Completed / Demonstrated

- Natural-language itinerary modification
- Local Qwen3.5 integration
- Structured AI understanding
- Deterministic constraint checking
- NOTICE routing
- CONFIRM routing
- Human-in-the-loop Apply flow
- PostgreSQL persistence
- Updates history
- Privacy-oriented member handling

### Demo target

The final classroom story is:

```text
Understand
   ↓
Check
   ↓
Route
   ↓
Explain
   ↓
Human decision
   ↓
Update Current Plan
```

That is the core Cadensy AI Agent.

---
---

# Part II — Current State (updated 2026-08-15)

Everything above documents the design as it stood earlier. This part records what
the code does **now**. Where the two disagree, this part is the accurate one — it
was written by reading the code and running it, not from memory.

Nothing above has been edited, so read the corrections in section 16 before
following any setup or demo instructions from Part I.

---

# 16. Corrections to Part I

| Part I says | Reality now | Where |
|---|---|---|
| AI model is **Ollama `qwen3.5:4b`**, local, no per-request fee | **DeepSeek `deepseek-v4-flash`** over the API, billed per request | section 4 |
| `.env` uses `OPENAI_BASE_URL=http://localhost:11434/v1/` | `DEEPSEEK_BASE_URL=https://api.deepseek.com`, and `CHAT_AI_PROVIDER` / `PLANNER_AI_PROVIDER` / `EXPLAINER_AI_PROVIDER` are all `deepseek` | section 9 |
| Demo **Terminal 1 runs Ollama** (`ollama run qwen3.5:4b`) | **Not needed.** No route uses Ollama. Only two terminals are required: backend and frontend | section 11 |
| **Three** decision paths | **Four**: `notice`, `round`, `reopen_round`, `confirm` | section 7 |
| Chat routes through `chat_agent.understand()` and `chat_agent.explain()` | `understand()` is deleted. `explain()` has no production caller | sections 3, 5 |
| Vote options include **Split up** | Removed from voting. The organizer's deadlock "split the block" action is a different path and still exists | section 7 |

`.env` still contains `OPENAI_BASE_URL` and `OPENAI_MODEL`. **No route reads them.**
They are leftover compatibility settings.

---

# 17. Current architecture: one agent, one workflow, five tools

Two subsystems that do not touch each other:

| | Plan generation | Chat |
|---|---|---|
| Entry | `domain/plans/generator.py` | `domain/chat/service.py` |
| Call style | `base.call_model` | `base.call_agent` |
| Rounds | one, then done | up to 8 |
| Tools | none | five |
| Is it an agent? | **No** | **Yes** |

The split is deliberate, and it is worth saying out loud in a defense:

- **Plan generation is a workflow** because it needs one judgment, not an
  investigation. The candidate list is already filtered and handed to the model.
- **Chat is an agent** because the requests are open-ended natural language. The
  old design routed chat with a keyword table; that was removed after it kept
  dropping real change requests into a path with no tools and no memory.

## 17.1 What the model actually contributes to plan generation

Measured by generating the same seeded Chicago trip twice, once with `MOCK_AI=1`
(rules only) and once with `MOCK_AI=0` (DeepSeek):

- Both produce a complete, legal, non-repeating itinerary.
- The difference is **grouping**. Rules pick "the next unused place", which
  scattered four museums across the whole city in one day. DeepSeek put Pilsen
  and Chinatown — two adjacent neighbourhoods — together in one day with a
  matching theme.

So: **rules guarantee legal, the model buys coherent.** The plan still generates
with the model unavailable.

## 17.2 The chat agent loop

```text
user text + full conversation history + the item selected on screen
        ↓
1. send all messages to DeepSeek, ask whether to call a tool
2. no tool requested  → that reply is the answer, loop ends
3. tool requested     → backend executes it (several per round, in parallel)
4. tool results appended to the messages, back to step 1
5. limits: 8 rounds · 120000 tokens · 30 seconds
           the same tool blocked twice by a guard stops the loop
        ↓
safety gate: if the reply claims the change already happened
  (已生效 / 已提交 / took effect / all set …) the whole reply is replaced
        ↓
extract proposed_change and candidate_options for the frontend
```

If the agent times out, errors, or returns nothing, the request degrades to a
single tool-free answer rather than failing.

## 17.3 The five tools — all read-only

| Tool | What it does | Guard |
|---|---|---|
| `get_current_plan` | Read the itinerary by day, date, weekday, or `all` | — |
| `get_trip_facts` | Destination, dates, member count, currency, estimated total. Never member identities | — |
| `classify_change` | Classify a proposed change. Also expresses a venue swap via `new_title` / `new_place` / `new_price_per_person` / `new_lat` / `new_lng` | needs `get_current_plan` first |
| `find_replacement_place` | Find real replacement venues from the place library, excluding the current item, places already used, and places whose hours do not cover the slot | needs `get_current_plan` first |
| `propose_options` | Build compromise options. Takes `conflict_item_ids` to say which items are actually in conflict, and `suggestions` so the model can write its own options | needs `get_current_plan` first |

**No tool can write to the database.** The agent can only read and classify.

---

# 18. The fourth decision path

Part I documents NOTICE, ROUND, and CONFIRM. There is a fourth.

| Path | Trigger | What happens |
|---|---|---|
| `confirm` | A confirmed booking, or a member's required constraint | Affected people confirm one by one. Booking = shared money, so the whole group; a hard constraint = only those members plus the proposer |
| `reopen_round` | The block was already settled by a vote | Needs a written reason. Overturning requires **more than half of all members**; silence counts toward keeping the current decision |
| `round` | Someone else touched this slot, or the change overlaps another item | Group vote. Most votes wins, **a tie keeps the current plan**, non-voters do not affect the result |
| `notice` | None of the above | Applies immediately, the group is notified. The notice carries an "I have a different idea" button that escalates to a round |

Checked in that order; the first hit returns.

Deadlines: voting 24h while planning, **2h once traveling**. Confirmation 7 days
and 2 days respectively.

**Solo trips** skip `settled` and `contested` — one person has no group to vote
with — and changing an item you touched yourself is not contested. When the member
count cannot be read, the strict behaviour is kept.

---

# 19. How the assistant's options reach a vote

This is the only way AI participates in voting: **it writes the options once in
chat, they are validated and frozen, and the vote only displays them.**

```text
1. in chat, the agent calls propose_options and writes its own compromises
   the backend validates each one → survivors returned as candidate_options
2. the user clicks Apply on one of them
   the frontend submits the remaining ones in an `options` field
3. the backend revalidates from scratch — anything from a browser is untrusted
4. if the change classifies as a vote, the survivors become alternative-N options
5. the vote card shows: Keep current / Suggested change / the assistant's options
```

Step 3 has five gates; failing any one drops the option:

1. `item_id` must be **the item being changed** — not merely "in the same trip".
   A round settles exactly one item, so an option aimed elsewhere would be
   validated against one item and executed against another.
2. only `start_hour`, `day_date`, `duration_min` are accepted. `title`, `place`,
   price, and coordinates cannot enter through this field.
3. at least one executable field.
4. `start_hour` within 9:00–21:00, `duration_min` positive.
5. it must survive `classify_change`, run inside a savepoint so a bad value
   cannot poison the transaction.

At most five, deduplicated against the change the user already picked.

**An option with no patch changes nothing.** Falling back to the option title
would rename an itinerary item to a piece of UI copy.

## Why the vote does not call AI again

- Submitting a change is a transactional request. An 8–10 second model call
  inside it means a timeout fails the whole submission.
- At that point the model has less context than it had in chat, so the options
  would be worse.
- **A vote is open for 24 hours and the whole group must see the same options.**
  Generating them live would show different people different ballots.

---

# 20. Tuning the agent

Decide which layer is wrong before changing anything.

| Symptom | Where | Leverage |
|---|---|---|
| Wrong tool called, or not called, or wrong arguments | `agents/tools.py` — the tool `description` | **highest** |
| The options themselves are poor | `agents/tools.py` — the tool handler | **highest** |
| Cross-tool behaviour rules | `domain/chat/service.py · _agent_system_prompt()` | medium |
| The model is guessing because it lacks facts | `agents/tools.py` — what the tool returns | medium |
| Truncated before finishing | `CHAT_AGENT_MAX_ROUNDS` (8) | low |
| Frequent timeouts | `CHAT_AGENT_TIMEOUT_SECONDS` (30) | low |

A description says *when* to reach for a tool; the handler decides *what comes
back*. They fail differently.

**There is one system prompt**, in `_agent_system_prompt()`. The validation script
imports it. It used to keep its own copy and the two drifted in both directions,
which made scripted runs stop being evidence about production. Do not copy it.

---

# 21. Verification

> **A green test suite does not mean the agent is calling the right tools.**
> Descriptions and prompts fail silently — nothing raises, the model just picks
> the wrong tool in a case nobody tested.

## Real validation — required after changing any description or prompt

```bash
cd backend
MOCK_AI=0 DISABLE_SCHEDULER=1 .venv/bin/python \
  app/agents/agent-server/run_real_trip_tools_trace.py
```

Six scenarios. Read the `=== Summary ===` at the end and record **rounds** and
**tool order**. The script seeds a temporary trip inside one transaction and rolls
it back.

**Run each configuration three times and compare medians.** The same code
producing different round counts on two runs is normal; this has been measured.

- Fewer rounds is usually better.
- **Clearly more rounds, or a tool that stopped being called, means it got worse.
  Revert.**
- The two plain-question scenarios should stay at **2 rounds**.

Scenario size matters too. The trace trip is two days; a real one-week trip
produces far more tokens per round, which is how a token cap that never fired in
testing was silently discarding good answers in production.

## Unit tests — a backstop, not a substitute

```bash
cd backend
DISABLE_SCHEDULER=1 MOCK_AI=1 .venv/bin/python -m pytest -q -p no:cacheprovider
```

## Logs

```bash
tail -f logs/agent-trace-$(date +%Y%m%d).jsonl   # which tools each round called
tail -f logs/trace-$(date +%Y%m%d).jsonl         # every model call: route, provider, latency, tokens
```

The first answers "did this message reach the agent". The second answers "was a
real model call made at all".

---

# 22. Known and unfixed

Ordered by how likely each is to bite during a live demo.

### 22.1 Conflict detection is dead in three of four cities — read before demoing

Chicago uses the curated place library and has durations. Every other city comes
from Geoapify with **no duration**, and conflict detection skips items whose
duration is unknown.

```text
chicago        missing duration   0 / 60     ok
shanghai       missing duration  24 / 24     dead
los angeles    missing duration  24 / 24     dead
new york       missing duration  17 / 17     dead
```

**Demonstrating "changing a time opens a vote" on a Los Angeles, New York, or
Shanghai trip will never trigger.** One Los Angeles trip has two items at 10:00 on
the same day and the system says nothing.

**Demo with a Chicago trip.** The fix is a duration default used *only* for
conflict detection, never written to the database — unknown must not become a
fake default.

Location: `orchestrator.py · _schedule_conflict_item`

### 22.2 Chat memory lives only in the open drawer

Conversation history is held in frontend React state. There is no `chat_message`
table.

- Refreshing the page loses the conversation, so "I meant …" stops working.
- Other members cannot see the conversation.

The backend already accepts history (`call_agent(history=...)`); only persistence
is missing. **Do not refresh during a demo.**

Location: `trip/src/final/plan-feature/useAssistantChangeRequestFlow.js`

### 22.3 One option can only change one item

`ProposedChatChange` and every option carry a single `item_id` and a single
`patch`. Requests like "make every day lighter" or "swap the walk and lunch"
**cannot be expressed in the data model**. The tool description forbids the model
from promising a second item will move, but the limit itself remains.

Location: `domain/chat/service.py · ProposedChatChange`

### 22.4 Solo trips can still open a vote two ways

The solo-trip rule lives in `classify()`, but two paths bypass it:

- `object_to_notice` hard-codes a `ROUND` without consulting the engine, so one
  person can object to their own notice and hold a vote with themselves.
- Schedule-conflict detection runs *after* `classify()` returns NOTICE and
  overrides it, without checking member count.

Conflict detection itself is right; a 24-hour group vote is the wrong instrument
for one person.

### 22.5 Plan generation has no validation harness

Chat has `run_real_trip_tools_trace.py`. Plan generation has nothing, so changing
its prompt can only be judged by eye. A comparison script — same seed, once with
`MOCK_AI=1` and once with `MOCK_AI=0`, printing places, times, distinct counts,
and whether days repeat — would close this gap. **Get the ruler before cutting.**

### 22.6 The planner prompt asks for something the model cannot do

It says "do not repeat 10.0, 14.0, 19.0 every day", but the model is called **one
day at a time** and cannot see the other days. Note that this did **not** reproduce
in recent runs, so do not chase it blind — confirm it first.

Location: `agents/planner.py · _day_prompt`

### 22.7 Dead code

| File | State |
|---|---|
| `agents/explainer.py` | **entire file** has no production caller, only `tests/test_explainer.py` |
| `agents/chat.py · explain` | same, only `tests/test_chat_safety_and_time.py` |

Both are superseded by the agent. The safety check inside `explain`,
`_claims_change_completed`, is now wired to the agent's reply separately, so that
protection was not lost. Delete each with its test.

### 22.8 City names match exactly

`"LA"` does not find the cached places stored under `"Los Angeles"`, which yields
zero candidates and a blocked plan. This has happened.

Location: `domain/places/service.py · _cached_places`

---

# 23. What not to add

- **Do not add a second agent.** None of the open problems are caused by having
  too few agents. Each one costs another prompt, another place to drift, and
  another validation loop. A duplicated prompt has already caused exactly that.
- **Do not turn plan generation into an agent.** It is one model call per day,
  about 8.5 seconds for four days. An agent would be four times slower for the
  same single judgment, and tools would be useless because the candidate list is
  already handed to it.
- **Do not add tools casually.** Five already caused a plain question to go from
  two rounds to three once. More tools means more hesitation. Add one only with a
  concrete need, and run the real validation afterwards.

## The four boundaries holding this design up

**The worst case when the model is wrong is a poor answer, not a damaged
itinerary.** That rests on four code-level constraints:

1. All five tools are read-only. The model cannot reach the database.
2. Decision paths are decided by Python rules. The model can only call
   `classify_change` and follow the result.
3. Replies pass a safety gate that replaces any claim the change already happened.
4. Every change requires the user to press Apply, and a vote to pass.

**Think hard before relaxing any of them.** They are not defensive programming;
they are why the product holds together.

---

# 24. Key files

| Path | What it is |
|---|---|
| `agents/base.py` | Model plumbing. `call_model` is one shot; `call_agent` is the loop with tools |
| `agents/tools.py` | The five read-only tools. **Most agent tuning happens here** |
| `agents/planner.py` | The single model call inside plan generation |
| `agents/chat.py` | The tool-free fallback answer plus the safety phrase check |
| `agents/trace.py` | Writes `logs/*.jsonl` |
| `domain/chat/service.py` | Chat entry point, system prompt, degrade path |
| `domain/plans/generator.py` | Plan generation pipeline |
| `domain/places/service.py` | Place library: curated Chicago, cache, Geoapify |
| `domain/constraints/engine.py` | **The classifier.** The four paths are decided here |
| `domain/decisions/orchestrator.py` | **Execution**: notices, rounds, proposals, settlement |
| `data/poi_chicago.py` | The 50 curated Chicago places |
| `api/main.py` | Every HTTP endpoint |

## Three lines never to cross

1. **Tools stay read-only.** Changes go through the user pressing Apply.
2. **Python decides the decision path.** The model follows it.
3. **`unknown` is never a fake default.** Unknown price, duration, or opening
   hours stay null — never 0, never 90 minutes, never "free".
