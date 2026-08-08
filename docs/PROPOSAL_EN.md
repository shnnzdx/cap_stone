# Group Travel Decision Engine — Project Proposal

**Version** 2.0 · 2026-08-07
**Supersedes** the four proposal documents dated 2026-08-01 (see Appendix B)
**Chinese edition** [`PROPOSAL.md`](PROPOSAL.md) — the two are kept in sync

> **Positioning.** This is not an AI that generates itineraries. It is a **group decision engine**
> that facilitates negotiation among several people, enforces hard constraints, explains
> trade-offs, and drives the group to an actual decision.

This document is the single authoritative source for **product rationale and business case**.
The technical contract lives in [`../trip/BACKEND.md`](../trip/BACKEND.md); current implementation
status in [`../trip/HANDOFF.md`](../trip/HANDOFF.md). The three do not overlap: this one says
*why* and *what*, the other two say *how*.

---

## 1. The business problem

Today, group travel planning works like this: one organiser scrapes scattered opinions out of a
group chat, memorises everyone's budget and availability, reconciles conflicting preferences, and
redoes the whole thing whenever any condition changes.

That process has five structural defects:

- **Decision fatigue kills trips.** Many never happen at all.
- **Hard constraints get lost in chat** — budget ceilings, dietary restrictions, accessibility
  needs, date limits.
- **The loudest member drives the outcome.** Quieter members get averaged away.
- **Some people will not disclose financial pressure or personal limits**, so they say nothing.
- **Ordinary voting treats every opinion as equal.** It cannot distinguish "I'd prefer the coast"
  from "my budget cannot exceed $800."

**The real competitor is not another AI startup.** It is *group chat + a spreadsheet + a poll tool
+ a travel site + one unusually motivated friend*. To beat that stack we must be ten times better
at something specific — not merely "also capable."

## 2. What makes this different

Four differentiators, in order of importance:

**1. The AI is a facilitator, not an itinerary generator.**
It interviews members individually, structures vague requirements, surfaces hidden conflicts,
proposes compromise directions, and pushes the group toward a decision. *AI facilitator* and
*AI trip planner* are different product categories.

**2. Hard constraints and soft preferences are handled separately.**
Options violating a hard constraint are eliminated first; only then is overall satisfaction
optimised. This is closer to how groups actually decide than majority rule.

**3. Private input, group output.**
A member can mark information as visible only to the planning engine. The system can tell the
group "the current plan exceeds one member's required budget" without revealing who.
**The privacy mechanism is itself the selling point.**

**4. Trade-offs are explainable.**
Not just a conclusion, but: whose needs were met, who is compromising, whether any required
condition is violated, and why this option is recommended.

## 3. Core mechanism — how a change enters the Current Plan

> ⚠️ **This section is the largest change from version 1.0.** The seven-stage workflow and the
> final Lock step have been **removed entirely**. Rationale in Appendix A.

**There is no Lock and no Final publish.** The system maintains one continuously updated
Current Plan.

Every change asks three questions in order. The answers decide which of four paths it takes.
**The cheapest path is the default.**

| Question | If yes → | What the user experiences |
|---|---|---|
| ① Does it hit something hard? (already booked / violates a required constraint / exceeds a budget ceiling / falls outside an availability window) | **Confirm** | Only affected members enter an anonymous conversation; the plan changes only when every one of them accepts |
| ② Has this slot already been settled by a vote? | **Round (high bar)** | A written reason is mandatory; overturning requires a clear majority in favour |
| ③ Has anyone contested this slot before? | **Round** | Everyone weighs in at once, one click each, with a deadline; settled by tally |
| ④ None of the above | **Notice** | Applies immediately; an anonymous notice goes out and **nobody is asked to do anything** |

Roughly 80% of changes land on Notice, 15% on Round, and only about 5% require an actual
conversation.

### Four rules that keep it from degenerating

1. **Silence means different things on different paths.** On Notice, silence is acceptance
   (objecting costs one click). On Round, silence is *no preference* — it neither counts as
   agreement nor blocks settlement. On a reopened Round, silence counts toward keeping the
   existing decision.
2. **A settled slot cannot be overturned by one person's change of mind.** It requires a written
   reason and a clear majority. ~~Co-signing by multiple members~~ was removed: it requires
   canvassing people privately, which is exactly the behaviour this product exists to eliminate.
3. **Everything degrades during the trip.** Round deadlines shrink from 24 hours to 2. You do not
   run an asynchronous vote while six people are standing on a street corner.
4. **No path ever exposes the wording of a preference.** The system says "one private constraint,"
   never a name and never a reason.

### Why chat is not the default

Chat is the most expensive tool in this product: serial, unbounded in time, high participation
cost, and invisible to anyone who was not pulled into the thread. A round is parallel, deadlined,
and one click.

**Putting a multiple-choice question into a chat thread means solving the cheapest problem with
the most expensive tool — and leaving people out while doing it.**

## 4. Privacy and roles

### Three non-negotiable rules

1. **The organiser's preferences carry no extra weight.** They are treated identically to every
   other member's in constraint solving.
2. **The organiser cannot read private preferences.** The rule applies identically to organisers
   and ordinary members. This is not a UI-level hide — the data is stored separately.
3. **No role may decide on another member's behalf.** No filling in someone's preferences, no
   confirming on their behalf, and never treating non-response as agreement.

### Deadlock exit

When a Confirm conversation cannot reach agreement, it escalates to the organiser. **The only
thing the organiser can do is decline to decide**: split the slot so both groups go their own way,
or clear the slot into free time. They cannot pick either side's option.

### A known weakness we state openly

**Anonymity is fragile in a group of six.** "One member has a required constraint that rules out
mornings before 9" may be guessable by the rest of the group. We do not claim complete anonymity —
only that the system never discloses identity or wording itself.

## 5. What the AI agent does

One underlying model, five jobs distinguished by prompt and workflow stage:

| Job | What it does | Hard requirement |
|---|---|---|
| **Translate constraints** | Turn a casual sentence into a machine-checkable structured condition | **User confirmation required** before it takes effect |
| **Generate the plan** | Compose a full itinerary from a curated place library | Must pass rule validation; on failure regenerate once, then mark `blocked` |
| **Explain** | Why this works / trade-offs / data-confidence labels | Read-only; never modifies the plan |
| **Propose options** | Three options for a contested slot | **Must always include "split up"** |
| **Private chat** | One-to-one dialogue; dry-run the cost of a change | Context never contains another member's private wording |

### What the AI must not do

- Raise a member's budget without permission
- Disclose private information or whose it is
- **Accept a plan on a member's behalf**
- Overwrite a settled slot directly — it goes through the same door as a human and is judged the
  same way

### Classification uses fixed rules, not the model

A large language model asked the same question twice may answer differently. **In a product whose
selling point is fairness, the rules themselves cannot drift.** The AI appears exactly once — at
the moment the user writes a constraint down — and its translation is stored. From then on,
classification reads only the stored rule.

## 6. Fairness logic

Recommendations are ordered by:

1. **Minimise hard-constraint violations** — a valid final plan has none outstanding
2. Raise the **lowest** individual satisfaction
3. Raise average group satisfaction
4. Narrow the spread between members
5. Reduce the concentration of major compromises on any single member

> The highest average is not the same as fair. The fifth person may simply be unable to come.

**Never claim a plan is "objectively the fairest."** Describe it as the option that, given the
inputs confirmed so far and the data available, accommodates the most.

## 7. Data confidence

The MVP does not connect to live booking inventory, so every piece of travel information carries
a label:

`verified` · `ai_estimate` · `mock` (hand-curated) · `not_verified`

**Labels are assigned by code, never self-reported by the model.** A model grading its own
confidence is not a grade.

Unless a fact has actually been verified, the prototype **must not imply that a hotel, restaurant,
price, or activity is currently bookable**.

## 8. Scope

### MVP demonstration boundary

3–5 active members · one destination city (Chicago) · 2–5 days · a curated place library rather
than live inventory

### In scope

Trip creation and invitation · preference submission with AI structuring · hard/soft constraint
classification · per-field visibility · conflict analysis · AI-generated full plan · the
four-path change flow · anonymous negotiation · a decision change log · trade-off explanation
with confidence labels · map and route ordering · cost estimation

### Explicitly out of scope

Multi-city optimisation · coordinating travel from different origin cities · live flight or hotel
inventory · booking and payment · automatic replanning for disruptions · matching with strangers ·
production-grade notification systems · visa, legal, or medical eligibility · complex expense
splitting

### Cuttable under time pressure (invisible in the demo)

Authentication (identity can be fixed for the demo) · invite links and guest join · organiser
reminder and deadline-extension features · admin console

## 9. Success criteria

### Functional acceptance

- [ ] Several members join one trip and submit both public and private requirements
- [ ] The system identifies at least one meaningful preference or budget conflict
- [ ] A complete single-city plan is generated, covering lodging, activities, meals, routing, and
      cost estimates
- [ ] The plan explains its major trade-offs **without leaking private information**
- [ ] A change is correctly routed to one of the four paths
- [ ] A round settles automatically at its deadline, and non-responders are not recorded as
      agreeing
- [ ] When a hard constraint is involved, one missing confirmation is enough to block the change
- [ ] The decision log can replay every decision made across the trip

### Metrics

| Metric | Definition |
|---|---|
| Participation completion rate | Members who completed preferences ÷ members who joined |
| Time to first full plan | All required input in → first plan out |
| Total group decision time | Trip created → no outstanding decisions remain |
| **Hard-constraint satisfaction rate** | Satisfied ÷ confirmed hard constraints. **Target: 100%** |
| Path distribution | Share of changes landing on Notice / Round / Confirm — **tests the claim that ~80% take the cheapest path** |
| Conversation count | How many times a trip actually opened a discussion — **lower is better** |
| Accepted-content retention | Sections unchanged after a revision ÷ sections before it |

The last two are new in 2.0. **They test the product's central claim directly**, which none of the
original metrics did.

### Trust evaluation

Trial users are asked: Did the AI understand my requirements correctly? Were the explanations
easy to follow? Did the process treat members fairly? Would I use this result for a real trip?

## 10. Risks

| Risk | Mitigation |
|---|---|
| Scope creep | Enforce single city, small group, curated data, limited revision rounds |
| AI misreads input | Require user confirmation, structured output, rule validation, confidence labels |
| Perceived unfairness | Show hard constraints, lowest satisfaction, explicit trade-off explanations — without disclosing private data |
| Low participation | Keep input under three minutes, show progress, allow reminders — **but never treat silence as agreement** |
| Revisions overwrite accepted content | Per-slot changes, an append-only change log, and the four-tier settledness ladder |
| **Anonymity reverse-engineered** | State the weakness openly; do not over-promise |
| Limited evaluation time | One controlled scenario, one small trial group, one standard question set |

## 11. Business case

Group travel is low-frequency, so **a conventional annual consumer subscription is unlikely to
work**. Plausible directions:

Booking or affiliate commission once a plan is settled · a one-off Trip Pass · premium live data
and dynamic replanning · B2B for corporate retreats and student travel · white-labelled group
requirement collection

**The capstone does not need to validate a revenue model.** It needs to validate three product
hypotheses:

1. Members are willing to submit and confirm their own requirements
2. The AI workflow shortens the time to a workable shared plan
3. Users understand and trust the trade-off explanations enough to accept the outcome

---

## Appendix A · What changed from 1.0

| Change | Reason |
|---|---|
| **Removed the seven-stage workflow; replaced with four paths** | A stage machine assumes the whole group advances in lockstep. In reality six people each change different things at different times. Routing by change fits actual use. |
| **Removed the final Lock** | A trip keeps changing right up to departure. Locking manufactures false certainty. The Current Plan stays live. |
| **Removed satisfaction scores and acceptance status** | Both existed to lock a version. With no version to lock, they have nowhere to land. |
| **Removed the three locking modes** | Same reason. |
| **Removed multi-member co-signing** | It requires canvassing people privately — the behaviour this product exists to eliminate. Replaced with "written reason + clear majority." |
| **Added a fourth path (reopened round)** | A settled slot needs an exit that is costly but usable; without one the plan ossifies. |
| **Constraints changed from free text to six checkable types** | Free text cannot be evaluated deterministically, and classification must not depend on the model. |
| **Added an append-only decision log** | Every decision's origin stays permanently auditable, and version management comes free. |
| **Added two metrics** (path distribution, conversation count) | Nothing in the original metric set actually tested the product's central claim. |

## Appendix B · Documents consolidated into this one

| Original | Disposition |
|---|---|
| `capstone-project-proposal-revised-zh.md` | Primary source; workflow sections replaced |
| `群体旅行决策引擎_中文方案.docx` | Differentiation argument merged into Section 2 |
| `多人协作式 AI 旅行规划平台——完整项目想法.docx` | Earliest full draft; fully superseded |
| `Capstone_Project_Proposal_and_Business_Case.docx/.pdf` | **Retained** — the formal English submission finalised 2026-08-01 |
| `群体旅行决策引擎_功能优先级.xlsx` | **Retained** — feature priority table |
| `产品介绍页面.md` | **Retained** — landing-page planning; belongs to `frontend/`, unrelated to this document |

The first three were moved to `_archive/`. Nothing was deleted.

> ⚠️ **The formal English submission still reflects the 1.0 workflow model.** If it is to be
> submitted as a deliverable, its core-mechanism section must be updated to match Section 3 above —
> otherwise the submitted document describes something different from what was actually built.
