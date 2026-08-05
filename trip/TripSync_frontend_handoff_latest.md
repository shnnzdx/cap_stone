# TripSync Frontend Handoff - Latest Update

Date: 2026-08-04  
Project path: `/Users/carina/Desktop/cap_stone_today_sync/trip`  
Frontend stack: Vite + React + React Router

## 1. Current Status For Teammates

Current frontend is now a login-after product prototype, not a role-selection demo.

After login, the user lands on `My Trips` directly. The dashboard shows trips where the same account can be Organizer in one trip and Participant in another trip.

Main implemented flows:

- Account dashboard: `/`
- Organizer trip list: `/organizer`
- Archived trips: `/organizer/archived`
- Create trip: `/organizer/create`
- Organizer trip workspace:
  - `/organizer/trip/:tripId/collect`
  - `/organizer/trip/:tripId/insights`
  - `/organizer/trip/:tripId/plan`
  - `/organizer/trip/:tripId/review`
  - `/organizer/trip/:tripId/final`
- Signed-in participant flow: `/participant/trip/:tripId`
- Invite link flow: `/t/:slug`
- Account/settings placeholders:
  - `/organizer/account`
  - `/organizer/settings`

Important design decisions already reflected:

- User no longer manually chooses Organizer vs Participant after login.
- Role belongs to `Trip Membership`, not the global account.
- Organizer must be logged in to create a trip.
- Invite link does not auto-join the user.
- Invite page first shows trip info + privacy note + nickname input.
- `Continue as guest` and `Log in and join` are disabled until nickname is filled.
- Participant review uses `Accept plan` / `Request changes`, not satisfaction scoring.
- Participant final page is not locked yet. It shows `Ready to confirm` and allows `Back to review`.
- UI visible copy is English.
- Strong "AI" wording was reduced. User-facing copy mostly says planner, suggested update, validation, or preference check.

## 2. Files Changed In Current Frontend

Main current implementation files:

- `src/final/FinalApp.jsx`
- `src/final/final.css`
- `src/final/finalData.js` currently still holds mock seed data.

Current git status also shows an unrelated parent repo change:

- `frontend/package-lock.json`

That file was already modified outside this frontend task and should not be treated as part of the `trip` frontend handoff unless the owner confirms.

## 3. What Currently Matches Product Logic

Matches:

- Account User can create trips.
- Account User can see multiple trips.
- Account User can have different roles in different trips.
- Guest Participant can enter from invite link without registration.
- Organizer creates trip and receives one main invite link.
- Opening invite link does not auto-join.
- Guest must confirm as guest or login before membership is created.
- Participants can submit preferences.
- Participants can review plan and either accept or request changes.
- Participants can save to account.
- Organizer can remind pending participants.
- Organizer can continue with current responses.
- Unsubmitted members are not treated as flexible.
- Participant final state is not locked before confirmation.

Partially matches:

- Preferences form exists, but data model is not complete yet.
- Privacy visibility exists, but default rules per preference type are not fully enforced.
- Preference check exists, but not the full assistant flow.
- Plan section reasoning exists, but backend constraint validation is not represented as a real engine.
- Organizer review exists, but should eventually become conflict/issue-driven rather than always a fixed stage.

Not yet implemented:

- Organizer also submitting their own preferences as a trip member.
- Separate `Preferred dates` and `Available date range` as formal backend fields.
- Separate `Ideal total budget` and `Maximum acceptable budget`.
- `I have no essential requirements`.
- Required / Important flexible / Preference three-layer constraint model.
- Backend validation pass/fail states.
- Blocked / unresolved plan generation state.
- Fact Check workflow.
- Real membership persistence.
- Real invite token handling.
- Real auth.

## 4. Backend Usage Notes

The frontend is still stateful mock UI. Backend should treat it as a contract sketch, not final API code.

Recommended core backend entities:

### User

Fields:

- `id`
- `name`
- `email`
- `avatar`
- `created_at`

Notes:

- Global user does not equal Organizer or Participant.
- Role is stored on `TripMembership`.

### Trip

Fields:

- `id`
- `name`
- `destination`
- `preferred_start_date`
- `preferred_end_date`
- `expected_group_size`
- `currency`
- `shared_assumptions`
- `preferences_deadline`
- `status`
- `created_by_user_id`
- `created_at`

Suggested `status` values:

- `collecting_preferences`
- `generating_plan`
- `plan_in_review`
- `has_requested_changes`
- `ready_to_confirm`
- `locked`
- `blocked`
- `archived`

### TripMembership

Fields:

- `id`
- `trip_id`
- `user_id` nullable for guest
- `guest_display_name`
- `role`
- `join_method`
- `status`
- `created_at`

Suggested `role` values:

- `organizer`
- `participant`

Suggested `join_method` values:

- `creator`
- `invite_guest`
- `invite_login`

Suggested `status` values:

- `invited`
- `joined`
- `preferences_submitted`
- `reviewed`
- `confirmed`

### InviteLink

One trip should have one primary invite link.

Fields:

- `id`
- `trip_id`
- `slug`
- `token`
- `is_primary`
- `status`
- `created_at`

Important behavior:

- Opening invite link should only read trip info.
- Membership should be created only after:
  - nickname + `Continue as guest`
  - or login + `Log in and join`

### Preferences

Suggested fields:

- `id`
- `trip_membership_id`
- `preferred_start_date`
- `preferred_end_date`
- `available_start_date`
- `available_end_date`
- `ideal_budget`
- `maximum_budget`
- `currency`
- `travel_style`
- `top_interests`
- `anything_to_avoid`
- `submitted_at`

Essential needs should be separate child records, not one free-text blob.

### EssentialNeed

Fields:

- `id`
- `preference_id`
- `text`
- `importance`
- `visibility`

Suggested `importance` values:

- `required`
- `important_flexible`

Suggested `visibility` values:

- `planning_only`
- `organizer`
- `everyone`

Important behavior:

- `required` cannot be violated.
- `important_flexible` should be optimized for, but can be traded off.
- `planning_only` should never expose raw text or member identity to organizer.

### Plan

Fields:

- `id`
- `trip_id`
- `version`
- `status`
- `generated_from_preference_ids`
- `estimated_total_per_person`
- `currency`
- `created_at`

Suggested `status` values:

- `draft`
- `in_review`
- `needs_changes`
- `ready_to_confirm`
- `locked`
- `blocked`

### PlanSection

Fields:

- `id`
- `plan_id`
- `section_type`
- `title`
- `summary`
- `details_json`
- `estimated_cost`
- `confidence_label`
- `validation_status`

Suggested `section_type` values:

- `overview`
- `stay`
- `day`
- `budget`
- `transportation`

### PlanValidation

This is the missing backend-critical part.

Frontend should eventually show whether the plan passed deterministic validation.

Fields:

- `id`
- `plan_id`
- `status`
- `failure_code`
- `safe_summary_for_organizer`
- `internal_details_json`
- `created_at`

Suggested `status` values:

- `passed`
- `failed`
- `blocked`

Suggested `failure_code` values:

- `REQUIRED_CONSTRAINT_VIOLATED`
- `BUDGET_LIMIT_EXCEEDED`
- `DATE_RANGE_EXCEEDED`
- `FIXED_CONDITION_VIOLATED`
- `SCHEDULE_OVERLAP`
- `TRAVEL_TIME_INSUFFICIENT`
- `COST_CALCULATION_INVALID`
- `AGREEMENT_CONFLICT`
- `INSUFFICIENT_DATA`

Backend rule:

- First generated proposal fails validation -> return failure reason.
- Regenerate once using failure reason.
- If second attempt fails -> mark `blocked`, do not show fake valid plan.

### PlanReview

Fields:

- `id`
- `plan_id`
- `trip_membership_id`
- `status`
- `submitted_at`

Suggested `status` values:

- `accepted`
- `requested_changes`
- `not_reviewed`

No satisfaction score should be used.

### PlanReviewComment

Fields:

- `id`
- `plan_review_id`
- `plan_section_id`
- `comment_type`
- `text`
- `visibility`
- `created_at`

Suggested `comment_type` values:

- `suggestion`
- `needs_adjustment`

## 5. Suggested API Endpoints

For backend discussion, these are the useful first endpoints:

```text
GET    /api/trips
POST   /api/trips
GET    /api/trips/:tripId
POST   /api/trips/:tripId/invite
GET    /api/invites/:slug
POST   /api/invites/:slug/join-guest
POST   /api/invites/:slug/join-login

GET    /api/trips/:tripId/members
POST   /api/trips/:tripId/preferences
GET    /api/trips/:tripId/preferences/me

POST   /api/trips/:tripId/plans/generate
GET    /api/trips/:tripId/plans/current
GET    /api/plans/:planId/validation

POST   /api/plans/:planId/reviews
GET    /api/plans/:planId/reviews
POST   /api/plans/:planId/sections/:sectionId/comments

POST   /api/plans/:planId/publish-update
POST   /api/plans/:planId/confirm
POST   /api/plans/:planId/lock
```

## 6. Frontend Data To Replace With Backend

Current mock source:

- `src/final/finalData.js`

Replace these mock objects first:

- `trip`
- `members`
- `insights`
- `planSections`
- `feedback`

Current local state in `FinalApp.jsx` should later move to backend:

- invite joined state
- guest nickname
- preferences submitted state
- review submitted state
- selected section/comment
- plan updated/finalized state
- coverage decision

## 7. Main Gaps To Discuss With Team

Highest priority:

- Decide backend schema for `TripMembership`.
- Finalize preferences data model: preferred dates, available range, ideal budget, max budget, essential needs.
- Define validation failure codes and safe organizer-facing summaries.
- Decide when organizer sees issues: always in Review tab, or only when conflict exists.
- Decide exact lock/confirm ownership:
  - participant confirms own participation
  - organizer publishes/locks the group plan

Medium priority:

- Account/settings pages are currently placeholders.
- Archived page is static.
- Copy/reminder actions are frontend toast only.
- Invite link is static slug, not secure token.
- No real auth yet.

## 8. Suggested Update Message To Teammates

Current frontend update:

We changed the login-after flow so users land directly on `My Trips` instead of choosing Organizer or Participant. Roles are now shown per trip card. Organizer can create a trip, generate one primary invite link, and share it. Invite links now open a landing page first; users must enter a nickname and choose guest or login before membership is created. Participant review now uses Accept / Request changes only, with no satisfaction scoring. Participant final is not locked; users can return to review before confirming.

Still missing for product logic:

Preferences data model needs to be tightened: preferred vs available dates, ideal vs max budget, essential needs, and required vs flexible importance. Backend still needs constraint validation, blocked state, invite token handling, membership persistence, and real auth.

Backend next step:

Agree on entities for Trip, TripMembership, InviteLink, Preferences, EssentialNeed, Plan, PlanValidation, PlanReview, and PlanReviewComment, then replace mock `finalData.js` with API-backed state.

## 9. Commands

Run locally:

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

Current local preview path:

```text
http://127.0.0.1:5173/trip-app/
```
