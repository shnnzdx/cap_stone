# Cadensy: AI Group Travel Decision Engine

> Cadensy is not an AI that merely generates an itinerary. It is an AI-mediated group decision engine that helps travelers surface constraints, explain tradeoffs, and keep one shared plan moving.

This is the product and business proposal. Technical details live in
[`../backend/README.md`](../backend/README.md). Frontend behavior lives in
[`../trip/FRONTEND.md`](../trip/FRONTEND.md).

---

## 1. Business Problem

Group travel planning usually depends on one organizer pulling scattered opinions from group chat, remembering everyone's budget and availability, comparing conflicting preferences, and rebuilding the plan whenever one condition changes.

That workflow has five structural problems:

- Decision fatigue slows or kills trips.
- Hard constraints get lost in chat: budget ceilings, food requirements, accessibility needs, dates, and personal limits.
- Loud members dominate quiet members.
- Some people will not publicly share financial pressure or personal limitations.
- Generic voting treats all preferences equally, even when one option is a nice-to-have and another is a hard limit.

The real competitor is not another AI travel app. It is group chat plus spreadsheets plus polls plus travel websites plus one overworked organizer.

Cadensy wins only if it makes group coordination materially easier, not if it simply adds another planning surface.

---

## 2. Differentiation

### AI Facilitator, Not AI Trip Planner

Cadensy interviews members, structures ambiguous needs, identifies hidden conflicts, proposes compromises, and helps the group make decisions. That is a different category from itinerary generation.

### Hard Constraints and Soft Preferences Are Separate

Real fairness starts by respecting hard limits before optimizing average happiness. "Majority likes this" is not enough if one member cannot afford or access the plan.

### Private Input, Group Output

Members can share sensitive details privately with the system. Cadensy can tell the group that a plan hits one required budget or time constraint without saying who wrote it.

### Explainable Compromise

Cadensy should not only return an itinerary. It should explain what changed, why a path was chosen, what tradeoff was made, and why private details stay private.

---

## 3. How Changes Enter the Current Plan

Cadensy has no final publish or lock workflow. It maintains a living Current Plan.

Every change goes through deterministic routing:

| Question | If yes | User experience |
|---|---|---|
| Does it hit a hard limit: booked item, required constraint, budget ceiling, or date range? | Confirm | Only affected members enter anonymous confirmation; all must accept. |
| Is the slot already settled? | Reopen Round | Requester must give a reason; majority of the whole group must explicitly support change. |
| Has the slot been touched before? | Round | All members vote in parallel; deadline settles the result. |
| None of the above | Notice | Change applies immediately and sends an anonymous notice. |

Expected split: most changes should be Notice, some should become Rounds, and only a small minority should need Confirm.

Design rules:

1. Silence means different things by path. In Notice, silence is default acceptance because objection is one click. In Round and Confirm, silence is not consent. In Reopen Round, silence favors the existing settled decision.
2. One person's new preference cannot casually overturn a settled slot. Reopening needs a reason and majority support.
3. During travel, decisions need shorter deadlines because the group is already on the road.
4. No path exposes private wording or identity.

Chat is intentionally not the default. Chat is serial, unbounded, expensive for participants, and easy to miss. Structured decision cards are faster and fairer for most cases.

---

## 4. Privacy and Roles

Three rules cannot be broken:

1. Organizer preferences have no higher weight.
2. Organizers cannot read private preferences.
3. No role can make decisions for another member.

If Confirm deadlocks, the organizer can only choose neutral exits:

- split the block, so different members do different activities and regroup later;
- clear the block, so the slot becomes free time.

The organizer cannot adopt one side's proposal over the other.

Known limitation: anonymity is fragile in a small group. Cadensy should not claim perfect anonymity. It should claim that the system does not directly disclose private wording or identity.

---

## 5. AI Agent Responsibilities

Cadensy uses the same model capability in different workflow roles.

| Agent | Job | Requirement |
|---|---|---|
| Preference | Convert natural language into enforceable constraints | User confirmation before save |
| Planner | Generate an itinerary from curated POIs | Deterministic validation before publish |
| Explainer | Explain tradeoffs, decision paths, and trust labels | Read-only |
| Options | Suggest choices for contested slots | Must include split-up option |
| Mediator | Support anonymous conflict conversations | No pressure and no decision authority |
| Chat | Turn a user message into a proposed plan patch | User applies manually |

AI cannot:

- raise a member's budget without consent;
- expose private information;
- accept a proposal for a member;
- bypass deterministic classification.

Fairness-sensitive routing uses fixed code, not model judgment. AI can translate and explain; code decides.

---

## 6. Fairness Logic

Recommended priority order:

1. Minimize unresolved hard-constraint violations.
2. Improve the lowest individual satisfaction.
3. Improve average group satisfaction.
4. Reduce satisfaction gaps between members.
5. Avoid concentrating major sacrifice on one person.

Highest average score is not necessarily fair. A plan can look good on average while making one member unable to participate.

Do not claim that a plan is objectively fairest. Say that, based on confirmed inputs and available data, it is the best-balanced compromise.

---

## 7. Data Trust

MVP does not connect to live booking inventory. Every travel fact needs a trust label:

- `verified`
- `ai_estimate`
- `mock`
- `not_verified`

Trust labels must come from code or source provenance, not from AI self-confidence.

Do not imply that a hotel, restaurant, price, or activity is directly bookable unless that fact has been verified.

---

## 8. MVP Scope

Demo boundary:

- 3-5 active members
- one destination city, Chicago
- 2-5 days
- curated POI catalog
- no live booking inventory

In scope:

- trip creation and invite flow
- preference submission and AI structuring
- hard-constraint versus soft-preference handling
- private visibility
- conflict analysis
- initial plan generation
- Notice / Round / Reopen Round / Confirm paths
- anonymous confirmation
- decision history
- compromise explanation and trust labels
- map and route order
- cost estimates

Out of scope:

- multi-city optimization
- coordination across different departure cities
- live flight or hotel inventory
- booking and payment
- automatic emergency replanning
- stranger matching
- production-grade notification delivery
- visa, legal, medical, or safety advice
- detailed expense splitting

Cuttable if time is tight:

- full login system
- invite links and guest join
- organizer remind and extend tools
- admin UI

---

## 9. Success Criteria

Functional acceptance:

- Multiple people join one trip and submit public and private needs.
- Cadensy identifies at least one meaningful preference, budget, or time conflict.
- Cadensy generates a complete single-city plan with activities, meals, route order, and estimated cost.
- The plan explains major compromises without leaking private information.
- A change routes correctly into Notice, Round, Reopen Round, or Confirm.
- Voting settles automatically at deadline, and silence is not counted as agreement.
- Hard-constraint changes require all affected members to accept.
- The change log can replay how decisions were made.

Metrics:

| Metric | Definition |
|---|---|
| Preference completion rate | members who submitted preferences / joined members |
| First-plan generation time | complete inputs -> first valid plan |
| Group decision time | trip created -> no pending decisions |
| Hard-constraint satisfaction rate | satisfied confirmed hard constraints / all confirmed hard constraints |
| Decision path mix | Notice / Round / Confirm proportions |
| Chat count | number of real conflict conversations per trip |
| Accepted plan retention | unchanged accepted parts / previous plan |

User trust questions:

- Did AI understand my needs correctly?
- Were explanations clear?
- Did the process feel fair?
- Would I use the result for a real trip?

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| Scope creep | Keep MVP to one city, small groups, curated data, and bounded decision paths. |
| AI misunderstanding | Require confirmation, structured output, deterministic validation, and trust labels. |
| Perceived unfairness | Show hard constraints, explain tradeoffs, and avoid exposing private data. |
| Low participation | Keep input under three minutes, show progress, and allow reminders without converting silence into consent. |
| Accepted plan overwritten | Use slot-level changes, settledness, and append-only change log. |
| Anonymity inference | Acknowledge the limitation and do not overpromise. |
| Evaluation time | Use one controlled scenario, one small test group, and consistent evaluation questions. |

---

## 11. Business Model

Group travel is low frequency, so a standard annual consumer subscription is unlikely to fit.

Possible directions:

- affiliate or booking commission after plan acceptance
- one-time Trip Pass
- paid real-time data and dynamic replanning
- B2B for company retreats or student trips
- white-labeled group preference collection

The capstone does not need to prove revenue. It needs to validate three product assumptions:

1. Members are willing to submit and confirm personal needs.
2. AI workflow reduces time to a usable shared plan.
3. Users understand and trust compromise explanations enough to accept the final plan.
