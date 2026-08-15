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
