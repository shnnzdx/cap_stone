# Cadensy Product Logic

**Audience:** teammates, designers, and future maintainers.
**Purpose:** explain how Cadensy behaves from end to end, which rules apply, and what should happen in edge cases.

This document describes product behavior, not implementation details.

| Question | Source |
|---|---|
| Why this product exists, market argument, and scope | [`PROPOSAL.md`](PROPOSAL.md) |
| Product behavior and rules | This document |
| Frontend interaction details | [`../trip/FRONTEND.md`](../trip/FRONTEND.md) |
| Backend data model, APIs, and deterministic rules | [`../backend/README.md`](../backend/README.md) |

`Planned` means the design decision is settled but not necessarily implemented.

---

## 1. What Cadensy Does

Six people are planning one trip. Each person may have different budgets, dates, physical limits, food needs, and preferred activities. Some constraints are sensitive and should not be said in a group chat.

Cadensy does one thing: it helps the group maintain a shared itinerary that everyone can live with, without forcing every small change into a meeting.

It is not mainly an itinerary generator. It uses itinerary generation as one tool, but the product goal is group decision-making.

Core claims:

1. Most changes should not interrupt the group. About 80% should apply immediately with only an anonymous notice.
2. When a decision is needed, use structured choices before chat. Voting is parallel, bounded, and easier to complete than open-ended discussion.
3. Private constraints can affect decisions without exposing who wrote them or the original wording.

---

## 2. Roles

Roles belong to a trip membership, not to the account. A person can be organizer in one trip and participant in another.

| Capability | Organizer | Participant | Guest |
|---|:--:|:--:|:--:|
| View itinerary, chat privately with AI, submit own preferences | Yes | Yes | Yes |
| Propose changes, vote, confirm proposals, comment publicly | Yes | Yes | Yes |
| View member list, remind members, extend deadlines | Yes | No | No |
| Generate and revoke invite links | Yes | No | No |
| Receive escalated deadlocks | Yes | No | No |
| Cross-trip dashboard | Yes | Yes | No |

The organizer is not a superuser. The organizer has maintenance tools for the shared trip frame, but no decision privilege.

Non-negotiable rules:

1. Organizer preferences do not carry extra weight.
2. Organizers cannot read private preferences.
3. No one can decide for another member. No one can submit preferences, confirm proposals, vote, or convert silence into consent on someone else's behalf.

Guests are full participants inside the trip. Their limitations are account-level only: no cross-trip dashboard, no trip creation, and no durable access across devices unless they later save to an account.

Invite links are the guest's access credential, so tokens must be unguessable and revocable.

Guest dedupe rule: within the same trip, guests are deduped by normalized display name. Rejoining as `Guest Lee` or ` guest lee ` returns the existing guest membership. If two real guests have the same name, the frontend should ask for a distinguishable name.

---

## 3. Full Journey

### Step 1: Organizer Creates a Trip

The organizer enters trip name, destination, rough dates, expected group size, currency, and preference deadline. Cadensy creates an invite link.

### Step 2: Members Join

Opening an invite link shows only trip frame information. It does not create membership.

The visitor enters a display name and chooses either guest access or account-based access. Membership is created only after that explicit join action.

Guest names are deduped within the same trip, so repeatedly opening the same invite and submitting the same normalized display name does not create duplicate guest rows.

### Step 3: Members Submit Preferences

Preferences separate ideals from limits. These fields must not be merged.

| Area | Ideal | Limit |
|---|---|---|
| Dates | Preferred travel dates | Widest acceptable date range |
| Budget | Ideal spend | Maximum spend |

If actual cost is above the ideal but below the maximum, the plan is acceptable but should explain the tradeoff. If actual cost exceeds the maximum, it is a hard constraint violation and goes to Confirm.

Members can also submit non-negotiables, travel pace, and up to three top interests.

Each preference or constraint can have its own visibility: visible to the group, visible to the organizer, or private to the system.

### Step 4: AI Generates the First Plan

AI selects from a curated POI catalog and drafts a complete itinerary. The backend must validate the draft against deterministic rules before it becomes visible.

Validation checks include hard constraints, budget limits, date ranges, opening hours, and feasible movement between places.

Outcomes:

- Valid: publish the current plan.
- Invalid: regenerate once with failure reasons.
- Still invalid: mark the plan as blocked and show the organizer a safe anonymous reason.

Cadensy must never show a normal-looking itinerary that is known to violate constraints.

### Step 5: Daily Use

Any member can propose changes to any plan item. Every change enters through the decision flow in Section 4.

### Step 6: Travel Starts

Trip status should eventually move by date: planning -> upcoming -> traveling -> completed.

While traveling:

- Round deadlines shrink from 24 hours to 2 hours.
- Previously settled slots may become easier to revisit because real-world travel needs faster adjustment.

### Step 7: Trip Ends

The itinerary stops accepting changes. The append-only change log remains available so the group can review how decisions were made.

---

## 4. How a Change Enters the Plan

Each plan slot has a settledness level:

| Level | Meaning |
|---|---|
| Loose | AI generated or untouched |
| Touched | Someone changed it once and it applied directly |
| Settled | A vote settled it or affected members confirmed it |
| Booked | Real money or booking commitment exists |

Directly applying a change does not make the slot settled. It only means no one has objected yet.

Decision order:

```text
1. Does it hit a hard limit?
   booked item / required constraint / budget ceiling / date range
      -> Confirm
2. Is the slot settled?
      -> Reopen Round
3. Has the slot been touched before?
      -> Round
4. Otherwise
      -> Notice
```

Hard limits always come first.

### Notice

The plan changes immediately. The group receives an anonymous notice. No one is required to act.

The notice includes an objection entry point. If someone objects, the issue escalates to a Round.

Silence means default acceptance only because objecting is cheap and available.

### Round

The slot becomes a decision card, not a chat thread. The card has three options and must include "split up" as one option.

Members vote in parallel. The card shows response count and a deadline. At the deadline, the backend settles by votes. A tie keeps the current plan.

Silence means no vote. It is not consent and it does not block settlement.

### Reopen Round

Only settled slots use this path. Reopening is harder than a normal Round:

1. The requester must provide a reason.
2. A majority of the whole group must explicitly support the change.
3. A 48-hour cooldown is planned.

In a Reopen Round, silence favors the existing decision because changing a settled plan requires explicit support.

### Confirm

Only affected members and AI enter an anonymous conflict conversation. The current user sees "You"; others see neutral labels such as "Member A".

The requester is marked accepted at creation. Every other affected member must accept before the change applies. One decline cancels the proposal.

If the conversation deadlocks, it can be escalated to the organizer.

Organizer deadlock exits:

- Split the block: affected members follow different plans for that slot, then regroup later.
- Clear the block: leave the slot free.

The organizer cannot choose either side's proposal. The organizer can only resolve the deadlock without deciding for members.

---

## 5. Non-Negotiables

Free text is not enforceable by deterministic code, so enforceable constraints map to six kinds:

| Kind | Example |
|---|---|
| `time_window` | No earlier than 9 AM; no later than 10 PM |
| `budget_ceiling` | Maximum $650 |
| `date_range` | Available only Aug 13-18 |
| `walk_limit` | No more than 3 km walking per day |
| `dietary` | Vegetarian required |
| `avoid_tag` | Avoid nightclubs |

Each constraint is either required or flexible. Only required constraints force Confirm.

AI may help translate natural language into one of these six kinds, but the user must confirm before the rule is saved.

If the text cannot map to one of the six kinds, Cadensy should say so plainly and ask the user to put it in public notes instead. Pretending to protect a preference is worse than admitting it is not enforceable.

After a rule is saved, future classification uses only the saved rule. AI does not re-judge the same issue every time.

---

## 6. Privacy

Never show these to other members or the organizer:

- The original wording of a private constraint.
- Other members' names in conflict conversations.
- Who changed preferences.
- Who voted for which option.

Safe output example:

```text
One time requirement is affected.
```

Unsafe output example:

```text
Mia said she cannot do early mornings.
```

Known limitation: anonymity is fragile in a six-person group. Cadensy should not claim perfect anonymity. It should claim that the system does not directly expose private wording or identity.

---

## 7. AI Responsibilities

Implementation guidance lives in [`AGENTS.md`](AGENTS.md). Product responsibilities:

| Agent | Job | Hard requirement |
|---|---|---|
| Preference | Translate natural language into one of six constraints | User confirmation required |
| Explainer | Explain why a plan or change works | Read-only |
| Mediator | Help conflict conversations stay neutral and productive | No pressure |
| Planner | Generate a full itinerary from curated POIs | Must pass deterministic validation |
| Options | Suggest Round options | Must include split-up option |
| Chat | Understand a user-requested change and propose a patch | User applies manually |

AI facilitates the conversation, but deterministic code counts votes, checks confirmations, decides whether silence matters, and writes to the database.

Mediator red lines:

- Do not pressure a member with language like "everyone is waiting for you."
- If AI suggests an alternative, it must create a new proposal. It cannot mutate a proposal that members already accepted or declined.

AI can propose itinerary changes, but it has no special path. It submits through the same change endpoint as humans and receives Notice, Round, Reopen Round, or Confirm.

AI-authored changes must be attributed to Cadensy, not made anonymous.

---

## 8. Data Trust

Because MVP does not use real-time booking data, every fact needs a trust label:

- `verified`
- `ai_estimate`
- `mock`
- `not_verified`

Trust labels are assigned by code or data source, not by AI self-assessment.

Do not imply that a hotel, restaurant, activity, price, or availability can be booked unless it has actually been verified.

---

## 9. Edge Cases

### Membership

| Case | Behavior |
|---|---|
| A member leaves after voting | Remove their vote and recompute thresholds with the new member count. |
| A member joins after travel starts | Their constraints affect future changes only; they do not retroactively overturn settled plans. |
| Organizer wants to leave | Transfer organizer role first. A trip must have one organizer. |
| Someone never submits preferences | Do not block the group. Treat them as having no constraints. |

### Time

| Case | Behavior |
|---|---|
| Preference deadline passes | It is progress guidance only; later preferences still work. |
| A Round is open when travel starts | Do not change that round's deadline midstream. New rules apply to future rounds. |
| Deadline arrives with zero votes | Settle as keep current. Do not leave it open forever. |
| Confirm proposal receives no answer | Still unresolved. Add an expiration policy before production. |

### Concurrent Changes

| Case | Behavior |
|---|---|
| One person changes three different slots | Allow it. Different slots are independent. |
| Two people change the same slot | Block the second pending action and point them to the open decision. |
| One slot has both a Round and Confirm | Impossible by database invariant. |

### Preference Changes

| Case | Behavior |
|---|---|
| Member tightens a hard constraint and current plan violates it | Scan the plan. Loose/touched conflicts can be repaired by Notice; settled/booked conflicts go to Confirm. |
| Member loosens a constraint | Do not auto-change the plan. |
| Member deletes a constraint blocking a pending proposal | Do not auto-approve the proposal. The requester must submit again. |

### Booked Items

| Case | Behavior |
|---|---|
| Change a booked item | Always Confirm and warn about possible cancellation cost. |
| Change is accepted but cancellation must happen offline | Create a visible follow-up task; Cadensy cannot cancel real bookings. |
| Mark as booked | This records a fact and does not use the four decision paths. |

### AI Failure

| Case | Behavior |
|---|---|
| Generated plan fails validation | Regenerate once, then mark blocked if still invalid. |
| No valid plan exists | Mark blocked. This is a valid outcome, not a system error. |
| AI repair proposal violates rules | Route it through the same decision flow as any human change. |
| AI service is unavailable | Core classification, voting, confirmations, and plan updates still work. |

---

## 10. Open Decision

Confirm currently needs an expiration policy. Recommended behavior:

- Add a longer deadline than Round, such as 48 hours.
- Expire unresolved proposals as rejected, not accepted.
- Keep the current plan unchanged on expiration.

Expiration is safe because it preserves the current plan. Auto-approval would convert silence into consent, which violates the product principle.

---

## 11. Explicit Non-Goals

| Not doing | Reason |
|---|---|
| Lock or final publish | Travel plans keep changing. Locking creates false certainty. |
| Satisfaction score | It serves a final-version workflow; Cadensy maintains a living plan. |
| Co-sponsor requirement to reopen | It encourages private lobbying. |
| Abstain button | Silence should remain no record. |
| Separate lodging workflow | Lodging is a plan item; the same decision paths apply. |
| Separate transportation planner | Routes are supporting data between plan items. |
| Expense splitting | Show approximate per-person cost only. Splitwise-style accounting is another product. |
| Multi-city, live booking, and payments | Out of MVP scope. |
