# Yuming Handoff

This handoff keeps the earlier `/Users/carina/Desktop/main_sync_fresh` work and the follow-up local-only updates made in `/Users/carina/Desktop/main_sync_latest_20260813`.

Older entries are kept for traceability. The order below is now intentional: current state first, operating rules second, latest summary third, detailed change log fourth, and older cleanup archive last.

## Current Workspace Status

### Latest Workspace Current Status

Current local workspace:

- `/Users/carina/Desktop/main_sync_latest_20260813`

Current local runtime database:

- `DATABASE_URL=postgresql+psycopg://localhost/latest_20260813`

Important local-only notes:

- No cloud deploy, push, or remote database change was performed.
- The latest workspace no longer reuses the `main_sync_fresh` runtime database.
- The local database has schema and one development login user, but no seeded fake trips.
- The visible `/trip` page depends on the built preview bundle under `frontend/public/trip-app`.
- After Trip frontend edits, run `cd frontend && npm run build:trip-preview`.

### Local Latest Database Isolation

Updated `/Users/carina/Desktop/main_sync_latest_20260813/backend/.env` so the latest local workspace no longer reuses the same runtime database as `main_sync_fresh`.

- `DATABASE_URL` is now `postgresql+psycopg://localhost/latest_20260813`
- `TEST_DATABASE_URL` was left unchanged
- Created the local PostgreSQL database `latest_20260813`
- Initialized schema with `python -m app.db.init_schema`
- Did not run demo seed, so the database starts empty instead of loading fake trips
- Added only the local development login with `python -m app.db.upsert_demo_login`
- The login created `organizer@cadensy.local` / `12345678` without creating demo trips or memberships

## Operating Rules

### Ongoing Change Logging Rule

Request recorded on 2026-08-13:

- Every future file change made by Codex in this project must be recorded in this handoff file.
- Each entry should include what changed, which files were touched, and what verification was run.
- Use `docs/yuming.md` as the running handoff/change log for this cleanup and follow-up work.

## Latest Local Changes Summary

### Plan Generation Variety Fix

Fixed the backend generator so single-member trips do not repeat the same places every day.

- Root cause: single-member generation allowed cross-day reuse and accidentally passed an empty `already_used` set into each day, so every day started from the same candidate order.
- New behavior: each day first tries to avoid places already used earlier in the trip.
- Fallback behavior: if the trip cannot be completed with unique places, the second attempt may reuse places across days, but still never repeats a place within the same day.
- Added regression coverage in `backend/tests/test_plan_generation.py`.
- Verified with:
  - `python -m pytest tests/test_plan_generation.py::test_long_single_member_trip_can_reuse_places_across_days tests/test_plan_generation.py::test_single_member_trip_prefers_new_places_before_reusing_across_days tests/test_plan_generation.py::test_single_member_budget_ceiling_does_not_block_initial_generation -q`

### My Trips Empty State Polish

Improved the empty "Other trips" area on the My Trips dashboard.

- Replaced the flat white strip with a structured empty state block.
- Added clearer copy explaining that created trips will appear there later.
- Updated responsive styling so the empty state stacks cleanly on small screens.
- Removed the plus icon from My Trips create buttons so the action reads as a simple text button.
- Removed the duplicate `Create trip` button from the "Other trips" empty state because the page already has a `NEW TRIP` navigation entry.
- Replaced the logged-in Trip workspace logo with the same Cadensy image mark and wordmark used before login.
- Added the Cadensy logo image assets to the Trip public build source so the embedded `/trip-app` preview can load them.

Current empty-state behavior:

- The `Other trips` empty state shows only explanatory copy.
- It does not show a `Create trip` button.
- Trip creation stays available from the top `NEW TRIP` navigation entry.

Files changed:

- `trip/src/final/FinalApp.jsx`
- `trip/src/final/final.css`
- `trip/public/images/cadensy-mark.png`
- `trip/public/images/cadensy-wordmark.png`
- `frontend/public/trip-app/index.html`
- `frontend/public/trip-app/embed-manifest.json`
- `frontend/public/trip-app/assets/*`
- `frontend/public/trip-app/images/*`

Verification:

- `cd frontend && npm run build:trip-preview` passed.

## Detailed Trip Workspace Change Log

This section is ordered sequentially. Each numbered entry records what changed, touched files, and verification where available.

### 1. Restored The Plan Empty-State UI Closer To The Monday Version

Problem:

- The Plan page in the screenshot had changed from the user's earlier compact setup panel into a wider "Collecting preferences / Trip frame" layout.
- The old page made it unclear when the organizer could generate the itinerary and what the member progress meant.

Files changed:

- `trip/src/final/plan-feature/PlanFeature.jsx`
- `trip/src/final/final.css`

What changed:

- Reintroduced the compact setup panel for the "No itinerary yet" state.
- Made the primary action depend on role and preference state:
  - Organizer with preferences submitted: `Generate itinerary`.
  - Organizer without preferences: `Fill my preferences`.
  - Guest/member: preference review/fill action.
- Made the progress text show how many people have submitted preferences.
- Kept the "Generate itinerary" action disabled while a generation request is already running.

Why:

- The Plan page should clearly answer: "Can I generate now? If not, what is missing?"
- This matches the user's earlier UI direction without changing unrelated pages.

### 2. Removed Fake Seed Trips From The My Trips Dashboard

Problem:

- The dashboard showed fake trips like `Lake house weekend`, `Annual ski weekend`, and `New Orleans reunion`.
- Those made the app look seeded/demo-based even when the user wanted real account trips only.

Files changed:

- `trip/src/final/FinalApp.jsx`
- `trip/src/final/tripContent.js`
- `trip/src/final/final.css`

What changed:

- Removed the static `otherTrips` dashboard data from the real dashboard flow.
- The dashboard now shows trips from account-backed data:
  - `app.tripSummaries`
  - locally created `app.trips`
- Added an empty state: `No other trips yet`.
- Kept demo data behind an explicit environment flag instead of loading it by default.

Why:

- For a future cloud app used by many real users, seed/demo data should not appear as if it is real user data.
- Seed remains useful only for development/demo setup, not for production user experience.

### 3. Made Demo Data Opt-In Instead Of Default

Problem:

- The Trip app still had fallback demo trip, member, updates, comments, and preference data.
- That could leak fake state into real flows and make debugging confusing.

Files changed:

- `trip/src/final/tripContent.js`
- `trip/src/final/TripAppState.jsx`
- `trip/src/final/FinalApp.jsx`
- `trip/src/final/plan-feature/PlanFeature.jsx`
- `trip/src/final/plan-feature/useAssistantChangeRequestFlow.js`

What changed:

- Added `demoDataEnabled`, controlled by `VITE_ENABLE_DEMO_DATA === "1"`.
- When demo data is disabled:
  - No fallback trip is created.
  - No fallback days/plan are loaded.
  - No fallback members, updates, comments, or guest draft are loaded.
  - Preferences start empty.
- Added safer null handling when no real trip is loaded.
- Added a real empty state for "No trip loaded".

Why:

- The app should prefer real backend data.
- Demo data should be a deliberate development mode, not the default behavior.

### 4. Made Creating A Trip Update The Frontend State Immediately

Problem:

- After creating a new trip, the backend knew about it, but the frontend could still behave like it was waiting for a refresh.
- New trip state also needed to clear stale plan/update/action state from the previous trip.

File changed:

- `trip/src/final/TripAppState.jsx`

What changed:

- After `POST /api/trips`, the new trip is normalized and assigned to `app.trip`.
- The new trip is inserted into `app.trips`.
- Old plan-related state is cleared:
  - `planId`
  - `days`
  - `notices`
  - `baseUpdates`
  - active rounds
  - active proposals
- Account trip summaries are refreshed when an account session exists.

Why:

- Creating a trip should make the current frontend workspace point at that trip immediately.
- The user should not have to refresh to make the frontend understand the new trip exists.

### 5. Made Saving Preferences Return To The Plan Page

Problem:

- After saving preferences, the user stayed on the Preferences page.
- To see "how many people filled preferences" or "can I generate now?", the user had to manually click `Plan`.

Files changed:

- `trip/src/final/FinalApp.jsx`
- `trip/src/final/TripAppState.jsx`

What changed:

- `PreferencesPage` now calls `navigate(tripHref(currentTrip.id, "plan"), { replace: true })` after a successful save.
- Preference loading is skipped when no current trip exists, avoiding a missing-session request.
- `saveMyPreferences()` now refreshes:
  - current user
  - current trip
  - current plan
  - updates
  - actions
  - account trip summaries when available

Why:

- Saving preferences is part of the Plan readiness flow.
- The natural next screen is the Plan page, where the user can see progress and generate when ready.

### 6. Fixed "Generate Itinerary Only Shows Plan After Manual Refresh"

Problem:

- The user clicked `Generate itinerary`.
- The backend generated the plan, but the page still showed `No itinerary yet`.
- After a manual browser refresh, the itinerary appeared.

Root cause:

- `createTrip()` inserted the trip into local frontend state with `isCreated: true`.
- `PlanFeature` had this condition:
  - show the empty setup screen if `currentTrip.isCreated` is true
  - or if `days.length === 0`
- After generation, `days` could contain the generated itinerary, but `currentTrip.isCreated` was still true in `app.trips`.
- A manual refresh cleared the in-memory `app.trips` state, so `isCreated` disappeared and the plan finally rendered.

Files changed:

- `trip/src/final/plan-feature/PlanFeature.jsx`
- `trip/src/final/TripAppState.jsx`

What changed:

- Removed `currentTrip.isCreated` from the empty-state rendering condition.
- The Plan page now decides whether to show the empty setup state based on real plan data:
  - if initial loading is done and `days.length === 0`, show setup state
  - otherwise show the itinerary
- `refreshTrip()` now updates `app.trips` with the normalized backend trip, clearing stale local-only markers such as `isCreated`.

Why:

- `isCreated` was only a temporary local marker. It should not override real backend plan data.
- If the backend generated itinerary items, the Plan page should show them immediately.

### 7. Synced The Embedded `/trip` Preview Bundle

Problem:

- The `trip/` app can build correctly, but the main `frontend/` app embeds a built copy under `frontend/public/trip-app`.
- If that preview bundle is not rebuilt, the browser can still show old Trip UI/logic inside the `/trip` iframe.

Command run:

- `cd frontend && npm run build:trip-preview`

Files affected:

- `frontend/public/trip-app/index.html`
- `frontend/public/trip-app/embed-manifest.json`
- `frontend/public/trip-app/assets/*`

Why:

- The user's visible `/trip` page is served through the embedded preview bundle.
- Rebuilding only `trip/` is not enough when testing inside the main frontend shell.

### 8. Verification Completed

Checks run:

- `git diff --check`
- `cd trip && npm run build`
- `cd frontend && npm run build:trip-preview`
- `cd frontend && npm run build`
- Search in generated bundles for removed fake trip names:
  - `Lake house weekend`
  - `Annual ski weekend`
  - `New Orleans reunion`
  - `Mia's 30th in Chicago`

Result:

- All builds passed.
- No whitespace errors were found.
- The removed fake trip names were not found in the latest `trip/dist` or `frontend/public/trip-app` bundles.

Notes:

- `frontend npm run build` still prints an existing large chunk warning. It is a warning, not a build failure.
- The Vite build sometimes needs permission to write a temporary timestamp config file under the local `trip/` folder when run through `build:trip-preview`. This is local filesystem behavior only, not a cloud action.

### 9. Architecture Clarification For Learning

Current mental model:

- `frontend/`: public website, login/signup pages, marketing/product pages, and the shell that embeds `/trip`.
- `trip/`: logged-in TripSync workspace frontend, including Plan, Preferences, Members, Invite, Updates, and Chat.
- `backend/`: API server, database models, auth/session logic, trip data, preferences, constraints, plan generation, updates, and members.
- `shared/`: shared frontend rules used across app boundaries, such as session runtime, navigation policy, and route encoding.

Request flow example:

1. User clicks a button in `trip/`.
2. `trip/src/final/TripAppState.jsx` calls a backend API.
3. `backend/app/api/main.py` receives the route.
4. Backend service/domain code reads or writes the database.
5. Backend returns JSON.
6. `TripAppState.jsx` normalizes the JSON into frontend state.
7. UI components such as `PlanFeature.jsx` re-render from that state.

Important rule:

- Do not use seed/demo data as the default path for real users.
- For cloud usage with many users, real data should come from account login, trip creation, membership, preferences, and backend-generated plans.

### 10. Added Preference Editing Entry Points On The Plan Page

Problem:

- The user could reach preferences through the top navigation tab, but the main Plan card did not clearly show where to edit preferences.
- In the `Ready to generate` state, the card only showed `Generate itinerary`, `Invite people`, and `Check members`.
- This made it feel like preferences were no longer editable once the organizer became ready to generate.

File changed:

- `trip/src/final/plan-feature/PlanFeature.jsx`

What changed:

- Added an `Edit preferences` button next to `Generate itinerary` in the no-itinerary setup card.
- Added an `Edit preferences` button to the generated itinerary page header, next to `Live plan` and `Ask Cadensy`.
- Both buttons route to the real trip preferences page:
  - `tripHref(currentTrip.id, "preferences")`

Why:

- Preference editing is part of the core trip planning loop, not only a separate settings page.
- Users should be able to revise preferences from the exact page where generation/readiness is shown.

Verification:

- `cd trip && npm run build` passed.
- `cd frontend && npm run build:trip-preview` passed and synced the embedded `/trip` preview bundle.

### 11. Made Blocked Generation Reasons Less Misleading

Problem:

- The Plan setup card could show:
  - `The requirements blocked this itinerary`
  - `At least one member's budget ceiling cannot be met with the places available.`
- That message was misleading because the backend used the same budget-specific string for multiple failure modes.
- A blocked plan can happen because of budget, but also because of missing/invalid trip dates or required constraints that leave no complete itinerary.

Root cause:

- `backend/app/domain/plans/generator.py` had one hard-coded `BLOCKED_REASON`.
- The generator used that same reason whenever it could not build a complete itinerary, even when the actual blocker was not budget.
- The frontend also always showed budget-specific help text whenever `blockedReason` existed.

Files changed:

- `backend/app/domain/plans/generator.py`
- `trip/src/final/TripAppState.jsx`
- `trip/src/final/plan-feature/PlanFeature.jsx`

What changed:

- Split the backend blocked reasons into:
  - budget ceiling blocker
  - missing/invalid trip date blocker
  - generic required-constraints blocker
- The backend now only returns the budget message when a real budget ceiling constraint is part of generation.
- `TripAppState` now stores `planBlockedReason` from `/api/trips/:trip_id/plans/current`.
- `PlanFeature` now reads both the immediate generate result and the refreshed plan state.
- The Plan card now shows different help text:
  - budget blocker: raise/remove budget ceiling
  - date blocker: set a valid trip date range
  - generic constraints blocker: edit preferences, loosen required constraints, or shorten the trip window

Why:

- The user should not be told to fix budget when the real issue may be dates or another hard requirement.
- A blocked state should be explainable after refresh, not only immediately after clicking Generate.

Verification:

- `cd backend && .venv/bin/python -m pytest tests/test_plan_generation.py -q` passed with `19 passed`.
- `cd trip && npm run build` passed.
- `cd frontend && npm run build:trip-preview` passed and synced the embedded `/trip` preview bundle.
- `cd frontend && npm run build` passed.

### 12. Fixed Confirm Self-Accept And Cross-Day Change Backend Error

Request recorded on 2026-08-13:

Problems investigated:

- A change that only affected the proposer could create a Confirm conversation that already showed the proposer as accepted but still stayed in `Awaiting confirmation`.
- Moving a plan item to another day could show `I could not reach the backend`; backend logs showed this was actually a 500 from trying to write a Python `date` object into a JSONB change log.

Files changed:

- `backend/app/domain/decisions/orchestrator.py`
- `backend/tests/test_paths.py`
- `backend/tests/test_trips.py`
- `docs/yuming.md`

What changed:

- `_log()` now serializes patch values with `_json_patch()` before writing `PlanChange.patch`, so `day_date` is stored as an ISO string in JSONB while the domain layer can still use real `date` objects for `PlanItem.day_date`.
- `_do_confirm()` now auto-applies Confirm when the only involved member is the proposer, because the proposer is already counted as accepted. This avoids leaving a self-only confirmation stuck behind an extra Accept click.
- Added regression coverage for self-only Confirm auto-application.
- Added regression coverage for submitting a `day_date` change through the API without causing a JSON serialization 500.

Verification:

- `cd backend && .venv/bin/python -m pytest tests/test_paths.py::test_a_self_only_confirmation_applies_without_an_extra_click tests/test_paths.py::test_touching_a_booking_needs_everyone_to_confirm tests/test_paths.py::test_the_change_lands_only_when_the_last_person_agrees tests/test_trips.py::test_submit_change_with_day_date_writes_json_safe_plan_change tests/test_trips.py::test_submit_change_access_is_scoped_to_plan_item` passed: 5 tests.
- Backend Python AST check passed: 64 files checked, 0 parse errors.

### 13. Fixed Same-Day Time Overlap Routing

Request recorded on 2026-08-13:

Problem investigated:

- Moving one itinerary item into a time that already has another same-day item, for example moving a 2 PM activity to 7 PM when a 7 PM dinner already exists, could be treated as a clean direct change.
- That allowed two plan items to silently overlap instead of being surfaced as a scheduling conflict.

Files changed:

- `backend/app/domain/decisions/orchestrator.py`
- `backend/tests/test_paths.py`
- `docs/yuming.md`

What changed:

- Added schedule-overlap detection in the decision orchestrator.
- The check compares the changed item's proposed `day_date`, `start_hour`, and `duration_min` against other items in the same plan on the same date.
- If another item overlaps and no higher-priority rule already routes to Confirm/Reopen/Round, the change now routes to `ROUND` with a message that another plan is already scheduled at that time.
- The read-only `classify_change()` path uses the same overlap check, so AI/chat previews report the conflict before writing anything.
- Added regression tests for both real submission and read-only classification.

Verification:

- `cd backend && .venv/bin/python -m pytest tests/test_paths.py::test_moving_into_an_occupied_time_opens_a_round tests/test_paths.py::test_classifying_an_occupied_time_reports_a_round_without_writing tests/test_paths.py::test_a_clean_change_applies_immediately tests/test_paths.py::test_touching_a_booking_needs_everyone_to_confirm` passed: 4 tests.
- `cd backend && .venv/bin/python -m pytest tests/test_paths.py` passed: 37 tests.
- Backend Python AST check passed: 64 files checked, 0 parse errors.

### 14. Fixed Long Single-Member Trip Generation And Trip Switching

Problem:

- The user set a high budget but still saw a blocked itinerary state.
- The visible blocked reason was confusing because the actual local trip did not have a required budget ceiling constraint.
- The app also kept opening the same Mia-backed trip/session, and clicking other trip cards could fail to switch into the selected trip.

Local database findings for trip `fd27474083aa413aa4e325649f23893c`:

- Trip name: `00`
- Destination: `chicago`
- Dates: `2026-08-27` to `2026-08-31`
- Member count: `1`
- Member shown by local seeded account: `Mia Chen`
- Stored maximum budget at the time of inspection: `800.0`
- Required constraints at the time of inspection:
  - `walk_limit` with `max_km_per_day: 3`
- Existing plan state:
  - `blocked`
  - `0` items
  - blocked reason: generic current dates/required constraints message

Root causes:

- The plan generator required POI titles to be globally unique across the whole trip.
- A 5-day trip needs 15 itinerary items. With required constraints and a limited Chicago POI set, global no-repeat can make generation fail even when the budget is fine.
- `/api/trips` returned trip summaries with `my_role`, but not the selected trip's `membership_id`.
- The dashboard could navigate to another trip URL without first switching the technical session to that trip's membership.
- The route guard did not use `tripSummaries` when resolving ordinary current-route access, so it could treat other account trips as unreachable.

Files changed:

- `backend/app/domain/plans/generator.py`
- `backend/tests/test_plan_generation.py`
- `backend/app/domain/trips/service.py`
- `trip/src/final/FinalApp.jsx`
- `trip/src/final/TripAppState.jsx`
- `trip/src/final/workspace-navigation-model.js`

What changed:

- The generator now allows place reuse across different days when no enforced budget ceiling is active.
- The generator still prevents duplicate places within the same day.
- For multi-member trips with enforced budget ceiling constraints, the old stricter behavior remains protected.
- Added a regression test for a 5-day single-member trip generating 15 items without duplicate places within a day.
- `/api/trips` now includes each trip summary's `membership_id`.
- Dashboard trip cards now adopt the selected trip's technical session before navigating.
- Newly created local trips keep their `membership_id` in frontend state.
- `resolveCurrentWorkspaceRoute` now receives `tripSummaries`, so account-owned trips can be recognized as reachable.

Verification:

- `cd backend && .venv/bin/python -m pytest tests/test_plan_generation.py tests/test_trips.py -q` passed with `61 passed`.
- `cd trip && npm run build` passed.
- `cd frontend && npm run build:trip-preview` passed and synced the embedded `/trip` preview bundle.
- `cd frontend && npm run build` passed.
- A rollback-only local generate check for trip `fd27474083aa413aa4e325649f23893c` returned:
  - `status: active`
  - `blocked_reason: None`
  - `item_count: 15`
  - `estimated_total: 435.0`

Operational note:

- The running local backend must be restarted or reloaded before the browser uses the updated generator/session-switching code.
- The rollback-only generate check did not commit itinerary items to the database.

### 15. Returned Trip Dates For The Top Trip Pill

Problem:

- The top trip pill showed `Planning | chicago | | 1 | Organizer`.
- The blank segment was supposed to show the concrete trip date range.
- The frontend already had a date slot in `TripPill`, but `currentTrip.dates` was empty for backend-loaded trips.

Root cause:

- `GET /api/trips/:trip_id` returned trip id, name, destination, status, and member count, but did not return `preferred_start_date` or `preferred_end_date`.
- `TripAppState.normalizeTrip()` can format the date range only when those date fields are present.
- Account trip summaries also did not include those date fields, so dashboard trip cards could show `Dates not set`.

Files changed:

- `backend/app/api/main.py`
- `backend/app/domain/trips/service.py`

What changed:

- `GET /api/trips/:trip_id` now returns:
  - `preferred_start_date`
  - `preferred_end_date`
- `/api/trips` account trip summaries now also return:
  - `preferred_start_date`
  - `preferred_end_date`

Why:

- The frontend should render the trip's real date range in the top pill instead of a blank separator.
- For the inspected trip, this should display the concrete range derived from `2026-08-27` to `2026-08-31`.

Verification:

- `cd backend && .venv/bin/python -m pytest tests/test_trips.py -q` passed with `41 passed`.

### 16. Centered Assistant Change Card And Clarified Vote Options

Request recorded on 2026-08-13:

Problems:

- The assistant change confirmation card was visually shifted left in the drawer.
- The time comparison inside that card could show a white/light backing behind `Current` and `Proposed` time values.
- The vote round UI was confusing because the middle option said `New idea`, which made it look like a repeated fake member card or a mysterious new plan.

Files changed:

- `trip/src/final/final.css`
- `trip/src/final/plan-feature/PlanFeature.jsx`
- `trip/src/final/FinalApp.jsx`
- `backend/app/domain/decisions/orchestrator.py`
- `frontend/public/trip-app`

What changed:

- `.changeConfirmCard` no longer uses a hard `40px` left margin. It now centers within its container with a bounded width.
- `.assistantChangeCompare` now forces its inner comparison cells to be transparent and removes inherited border/shadow/backdrop styles, so the time values sit directly on the card instead of on white blocks.
- Vote round copy now explains that cards are choices, not members:
  - `Vote on the option, not the person. Ideas stay anonymous while the group chooses what happens to this block.`
  - `Anonymous — cards are choices, not members.`
- Backend decision round option label changed from `New idea` to `Suggested change`.
- Backend decision round option body changed from `Switch this block to the option raised most recently.` to `Apply the most recent suggestion to this block.`
- Rebuilt and synced the local trip preview bundle into `frontend/public/trip-app`.

Important product note:

- The current vote model is option-based, not person-based.
- The three cards mean:
  - Keep the current plan.
  - Apply the suggested change.
  - Split up for this block.
- Showing the left card as person 1, middle card as person 2, and right card as person 3 would require a different backend model that stores multiple member-submitted proposals as separate vote options. The current backend does not have that data shape, so I did not fake it in the UI.

Verification:

- `cd backend && .venv/bin/python -m pytest tests/test_paths.py -q` passed with `37 passed`.
- `cd trip && npm run build` passed.
- `cd frontend && npm run build:trip-preview` passed and synced the embedded `/trip` preview bundle.
- `cd frontend && npm run build` passed. It showed the existing chunk-size warning only.
- `git diff --check -- trip/src/final/final.css trip/src/final/plan-feature/PlanFeature.jsx trip/src/final/FinalApp.jsx backend/app/domain/decisions/orchestrator.py` passed.

### 17. Auto-Settled Vote Rounds After Everyone Votes

Request recorded on 2026-08-13:

Problems:

- A vote round stayed open until the deadline or a manual settle call even after every trip member had already voted.
- After a vote settled the round, the frontend could still require a manual refresh before the changed plan appeared.
- The `Keep current` card did not clearly read as "keep the current itinerary card"; it only named the current place.

Files changed:

- `backend/app/api/main.py`
- `backend/app/domain/decisions/orchestrator.py`
- `backend/tests/test_trips.py`
- `trip/src/final/TripAppState.jsx`
- `frontend/public/trip-app`

What changed:

- `POST /api/rounds/:round_id/votes` now checks whether all trip members have voted after saving the vote.
- If every member has voted, the API immediately calls `settle_round()` before returning the round response.
- The frontend `castVote()` flow now calls `refreshAll({ background: true })` when the returned round is already closed, so the current itinerary reloads without a manual browser refresh.
- The `Keep current` option body now says exactly what is being preserved:
  - `Keep this card as it is: {place} at {time}.`
- Added a regression test proving a one-member round auto-closes and applies the requested patch immediately after the vote.

AI agent product note:

- A better long-term vote design could add an AI-generated option, but it should not be faked as a static fourth card.
- The backend should first create a real `agent_suggested` option from the current item, proposed change, trip preferences, hard constraints, opening hours, distance, and budget.
- The AI option should include an auditable patch, for example `start_hour`, `place`, `title`, `duration_min`, and a short reason.
- If the agent cannot produce a valid alternative, the vote should stay with the three existing options:
  - Keep current.
  - Suggested change.
  - Split up.
- This prevents the UI from showing an AI option that cannot actually be applied to the itinerary.

Verification:

- `cd backend && .venv/bin/python -m pytest tests/test_paths.py tests/test_trips.py::test_round_auto_settles_when_every_member_has_voted tests/test_trips.py::test_round_vote_and_settle_routes_are_trip_scoped -q` passed with `39 passed`.
- `cd trip && npm run build` passed.
- `cd frontend && npm run build:trip-preview` passed and synced the embedded `/trip` preview bundle.
- `cd frontend && npm run build` passed. It showed the existing chunk-size/static-analysis warnings only.

### 18. Kept Account Login On My Trips And Added Per-Activity History

Request recorded on 2026-08-13:

Problems:

- After entering the password, the app could automatically jump into the restored Mia/Chicago trip instead of landing on the `My Trips` dashboard.
- Each numbered activity marker, such as `1`, `2`, or `3`, did not expose that activity's own change history.

Files changed:

- `shared/trip-navigation-policy/index.js`
- `frontend/tests/trip-navigation-restoration-cutover.test.mjs`
- `trip/src/final/TripAppState.jsx`
- `trip/src/final/plan-feature/usePlanInteractionRuntime.js`
- `trip/src/final/plan-feature/PlanFeature.jsx`
- `trip/src/final/final.css`
- `frontend/public/trip-app`

What changed:

- Account users who land on the workspace home route `/` now stay on `My Trips` even if local storage still has a restored trip id.
- Guest-backed sessions still default into their trip, because guests do not have a cross-trip account dashboard.
- If the current route is already a specific trip route, restored trip context still stays valid so refreshing a trip page does not break.
- Added a plan change-log loader in `TripAppState` using the existing backend endpoint:
  - `GET /api/plans/:plan_id/changes`
- `usePlanInteractionRuntime` now groups change log entries by `plan_item_id`.
- Clicking the activity number marker opens or closes that item's `Change history` panel.
- The panel shows:
  - change origin, such as direct change, vote result, confirmed change, or booking status
  - changed fields, such as title, place, time, date, duration, price, or status
  - applied time
  - reason when one exists

Verification:

- First reproduced the login landing bug with:
  - `node --test frontend/tests/trip-navigation-restoration-cutover.test.mjs`
  - It failed because account restoration redirected `/` to `/trip/t1/plan`.
- After the fix:
  - `node --test frontend/tests/trip-navigation-restoration-cutover.test.mjs frontend/tests/trip-navigation-target-policy.test.mjs frontend/tests/trip-navigation-route-guard-cutover.test.mjs frontend/tests/session-runtime-login-cutover.test.mjs frontend/tests/session-runtime-tripappstate-bootstrap-cutover.test.mjs` passed with `36 passed`.
  - `cd trip && npm run build` passed.
  - `cd frontend && npm run build:trip-preview` passed and synced the embedded `/trip` preview bundle.
  - `cd frontend && npm run build` passed. It showed the existing chunk-size/static-analysis warnings only.
  - `git diff --check -- shared/trip-navigation-policy/index.js frontend/tests/trip-navigation-restoration-cutover.test.mjs trip/src/final/TripAppState.jsx trip/src/final/plan-feature/usePlanInteractionRuntime.js trip/src/final/plan-feature/PlanFeature.jsx trip/src/final/final.css` passed.

### 19. Removed Activity Number History Indicator Dot

Request recorded on 2026-08-13:

Problem:

- The activity number marker showed a small visual dot when that item had history.
- The requested behavior is that `1`, `2`, `3`, etc. should not visually announce history status.
- Users should click the number marker themselves to see whether the database has history for that activity.

Files changed:

- `trip/src/final/plan-feature/PlanFeature.jsx`
- `trip/src/final/final.css`
- `frontend/public/trip-app`

What changed:

- Removed the `hasHistory` class from activity number markers.
- Removed the `.activityIndex.hasHistory:after` dot style.
- The history panel still reads only real backend data from `GET /api/plans/:plan_id/changes`, grouped by `plan_item_id`.
- If the database has no `PlanChange` rows for that activity, the panel says `No changes recorded for this activity yet.`
- No fake per-item history is created in the frontend.

Verification:

- `rg -n "hasHistory|activityIndex\\.hasHistory|activityIndex:after" trip/src/final -S` found no matches.
- `cd trip && npm run build` passed.
- `cd frontend && npm run build:trip-preview` passed and synced the embedded `/trip` preview bundle.
- `cd frontend && npm run build` passed. It showed the existing chunk-size/static-analysis warnings only.
- `git diff --check -- trip/src/final/plan-feature/PlanFeature.jsx trip/src/final/final.css` passed.

### 20. Made Activity History Appear Only After Real Recorded Changes

Request recorded on 2026-08-13:

Problems:

- Activities with no database change history still opened an empty history panel.
- After editing an activity, for example moving an activity to 8:00 PM, the item history could still look empty because the frontend only reloaded the change log when the number of days changed.

Files changed:

- `trip/src/final/plan-feature/usePlanInteractionRuntime.js`
- `trip/src/final/plan-feature/PlanFeature.jsx`
- `frontend/public/trip-app`

What changed:

- Clicking an activity number now opens history only if `changeHistory[item.id]` has at least one real database record.
- If there are no `PlanChange` rows for that activity, clicking the number does nothing and no history panel appears.
- Removed the empty-state sentence from the per-activity history panel because unchanged activities should not show any history UI at all.
- The change-log loader now re-runs when the plan data changes, not only when the day count changes. This lets a newly edited activity show its database-backed history after the plan refreshes.
- The activity number still has no dot, badge, or visible history indicator.

Verification:

- `rg -n "No changes recorded|title=\"Show change history\"|hasHistory|activityIndex\\.hasHistory|activityIndex:after" trip/src/final -S` found no unwanted history indicator or empty-history UI.
- `cd trip && npm run build` passed.
- `cd frontend && npm run build:trip-preview` passed and synced the embedded `/trip` preview bundle.
- `cd frontend && npm run build` passed. It showed the existing chunk-size/static-analysis warnings only.
- `git diff --check -- trip/src/final/plan-feature/usePlanInteractionRuntime.js trip/src/final/plan-feature/PlanFeature.jsx` passed.

### 21. Excluded Initial Generation Rows From Activity Change History

Request recorded on 2026-08-13:

Problem:

- The backend records generated itinerary items as `PlanChange` rows with origins such as `ai_generate` and `rule_generate`.
- Those rows are database records, but they are not user-facing "this activity changed later" history.
- Because the frontend grouped all `PlanChange` rows, activities that had never been edited could still open a history panel.

Files changed:

- `trip/src/final/plan-feature/usePlanInteractionRuntime.js`
- `trip/src/final/plan-feature/PlanFeature.jsx`
- `frontend/public/trip-app`

What changed:

- Per-activity history now filters out initial generation origins:
  - `ai_generate`
  - `rule_generate`
  - `initial_plan`
- Only later decision/change origins remain visible, for example:
  - `notice`
  - `round`
  - `reopen_round`
  - `confirm`
  - `booking`
  - `deadlock_*`
- Removed the unused `Initial plan` label from the frontend history label map.

Why:

- "History" on the activity number should mean the activity was changed after the plan existed, not merely that the plan was generated.
- An activity changed to 8:00 PM should show history because that creates a later `PlanChange` row for the item.
- An activity that only came from initial generation should not open any history panel.

Verification:

- `cd trip && npm run build` passed.
- `cd frontend && npm run build:trip-preview` passed and synced the embedded `/trip` preview bundle.
- `cd frontend && npm run build` passed. It showed the existing chunk-size/static-analysis warnings only.

### 22. Kept Day Date And Day Index Consistent When Moving An Activity

Request recorded on 2026-08-13:

Problem:

- Moving an activity from Day 2 to a concrete date such as August 19 changed the item's `day_date`, but left its old `day_index`.
- The current plan API groups itinerary items by `day_index`.
- Because of that mismatch, a Day 2 item moved to August 19 could still render under Day 2, making it look like the whole second day had been renamed to August 19.

Files changed:

- `backend/app/domain/decisions/orchestrator.py`
- `backend/tests/test_trips.py`
- `frontend/public/trip-app`

What changed:

- `_apply()` now detects `day_date` changes and also writes the matching `day_index`.
- If the trip has `preferred_start_date`, the day index is calculated from that trip start date:
  - `preferred_start_date` = Day 1
  - next date = Day 2
  - and so on
- If the trip does not have a preferred start date, the fallback uses the sorted dates already present in the plan.
- Added a regression test where a Day 2 activity on `2026-08-20` is moved to `2026-08-19`; the item must become `day_index = 1` and the current plan API must group it under Day 1.

Why:

- Moving an activity to another date should move that activity between day groups.
- It should not make a whole existing day appear to have changed date.

Verification:

- `cd backend && .venv/bin/python -m pytest tests/test_trips.py::test_submit_change_with_day_date_writes_json_safe_plan_change tests/test_trips.py::test_submit_change_with_day_date_moves_item_to_matching_day_index -q` passed with `2 passed`.
- `cd backend && .venv/bin/python -m pytest tests/test_paths.py tests/test_trips.py::test_submit_change_with_day_date_writes_json_safe_plan_change tests/test_trips.py::test_submit_change_with_day_date_moves_item_to_matching_day_index tests/test_trips.py::test_submit_change_access_is_scoped_to_plan_item -q` passed with `40 passed`.
- `cd trip && npm run build` passed.
- `cd frontend && npm run build:trip-preview` passed and synced the embedded `/trip` preview bundle.
- `cd frontend && npm run build` passed. It showed the existing chunk-size/static-analysis warnings only.

Operational note:

- This is a backend behavior fix. The local backend process must be restarted before the browser uses the corrected day move logic.
- `git diff --check -- backend/app/api/main.py backend/app/domain/decisions/orchestrator.py backend/tests/test_trips.py trip/src/final/TripAppState.jsx` passed.

### 23. Fixed Single-Member Budget Blocking And Preference Date Bounds

Request recorded on 2026-08-13:

Problems:

- A newly created single-member trip could still show a blocked itinerary state with budget-ceiling copy.
- The user asked why this happened when only one person had filled preferences.
- The user also asked whether organizer and participant preference dates can be limited to the organizer-selected trip date range.

Findings:

- `maximum_budget` in the `Preference` table is ordinary preference data; by itself it does not create a required `budget_ceiling` constraint.
- Initial plan generation is blocked only by required rows in `member_constraint`.
- For a single-member trip, treating that person's budget ceiling as a group hard blocker produced a poor product result: the system blocked the itinerary instead of letting the solo organizer proceed.
- Preference saving had no backend guard to keep preferred/available dates inside the trip's organizer-selected date window.

Files changed:

- `backend/app/domain/plans/generator.py`
- `backend/app/domain/preferences/service.py`
- `backend/app/api/main.py`
- `backend/tests/test_plan_generation.py`
- `backend/tests/test_trips.py`

What changed:

- Initial plan generation now ignores required `budget_ceiling` constraints when the trip has only one membership.
- Multi-member trips keep the existing budget-ceiling enforcement behavior.
- Preference saving now validates both:
  - `preferred_start_date` / `preferred_end_date`
  - `available_start_date` / `available_end_date`
- Both date ranges must:
  - end on or after they start
  - stay within `Trip.preferred_start_date` and `Trip.preferred_end_date` when the trip has a date window
- The API maps date-bound violations to `422` instead of saving invalid preference dates.
- Added regression coverage for:
  - single-member low budget ceiling no longer blocking initial generation
  - multi-member unsolvable budget still blocking generation
  - organizer and participant preference dates outside the trip window being rejected
  - valid in-window preference dates being saved and read back

Verification:

- Focused regression command passed:
  - `cd backend && .venv/bin/python -m pytest tests/test_plan_generation.py::test_single_member_budget_ceiling_does_not_block_initial_generation tests/test_plan_generation.py::test_unsolvable_budget_blocks_without_writing_items tests/test_trips.py::test_preference_dates_are_saved_and_read_back tests/test_trips.py::test_preference_dates_outside_trip_window_are_rejected_for_any_role -q`
  - Result: `4 passed`
- Related backend suite passed:
  - `cd backend && .venv/bin/python -m pytest tests/test_plan_generation.py tests/test_preferences.py tests/test_trips.py -q`
  - Result at that point: `73 passed`

Operational note:

- The local backend must be restarted or be running with reload before the browser uses the updated generator and preference validation.

### 24. Fixed Trip `111` Day-Date Mismatch In Current Plan

Request recorded on 2026-08-13:

Problem:

- The user showed trip `111` still had a bad itinerary.
- The screenshot showed Day 1 and Day 2 both rendering as `Wed, Aug 19`.
- Day 2's opened item also showed a real `Change history` row with `VOTE RESULT` and `Date: Wed, Aug 19`.

Root cause:

- The database had one inconsistent plan item:
  - item: `Shedd Aquarium`
  - `day_index`: `2`
  - wrong `day_date`: `2026-08-19`
  - expected Day 2 date from the trip window: `2026-08-20`
- The item was made inconsistent by an older `round` plan change whose patch contained only:
  - `{"day_date": "2026-08-19"}`
- Current backend decision code already syncs `day_index` when applying a new `day_date`, but this existing local database row was already dirty.
- The frontend Plan UI derived each day header date from the first item in that day. One stale item date could therefore make the whole Day card show the wrong date.

Files changed:

- `backend/app/api/main.py`
- `trip/src/final/TripAppState.jsx`
- `backend/tests/test_trips.py`
- `backend/tests/conftest.py`
- `frontend/public/trip-app/index.html`
- `frontend/public/trip-app/embed-manifest.json`
- `frontend/public/trip-app/assets/*`

What changed:

- `GET /api/trips/:trip_id/plans/current` now returns a canonical `day_date` on each day object.
- The canonical day date is computed from:
  - `Trip.preferred_start_date + (day_index - 1)`
- If a trip has no preferred start date, the API falls back to the first item date.
- `TripAppState.normalizePlan()` now uses day-level `day.day_date` first and only falls back to the first item date for older API responses.
- Added an API regression test proving `/plans/current` returns canonical day dates even when a historical item row has a stale `day_date`.
- `backend/tests/conftest.py` now forces `MOCK_AI=1` during tests instead of respecting a local `.env` value. This prevents local provider settings from making deterministic tests call the real planner path.
- Rebuilt and synced the embedded `/trip` preview bundle used by `localhost:3000/trip`.

Local database repair:

- The local trip `111` was repaired in PostgreSQL.
- Fixed item row:
  - `Shedd Aquarium`: `2026-08-19` -> `2026-08-20`
- Fixed matching `PlanChange` row:
  - before: `{"day_date": "2026-08-19"}`
  - after: `{"day_date": "2026-08-20", "day_index": 2}`
- A follow-up local DB check reported:
  - trip `111` items: `27`
  - mismatched day/date rows: `[]`

Verification:

- Focused date regression tests passed:
  - `cd backend && .venv/bin/python -m pytest tests/test_trips.py::test_current_plan_reports_canonical_day_dates_from_trip_window tests/test_trips.py::test_submit_change_with_day_date_moves_item_to_matching_day_index -q`
  - Result: `2 passed`
- Related backend suite passed:
  - `cd backend && .venv/bin/python -m pytest tests/test_plan_generation.py::test_mocked_planner_path_still_uses_rules_generation_by_default tests/test_plan_generation.py tests/test_preferences.py tests/test_trips.py -q`
  - Result: `78 passed`
- Embedded preview sync passed:
  - `cd frontend && npm run build:trip-preview`
  - Output synced `tripsync@0.4.0` to `frontend/public/trip-app`

Operational note:

- The browser page at `localhost:3000/trip` uses the embedded preview bundle under `frontend/public/trip-app`.
- After changing `trip/src`, run `cd frontend && npm run build:trip-preview` or the visible iframe can keep using stale frontend code.
- If Chrome still shows the old date after this fix, hard-refresh the page and make sure the backend is restarted or running with reload.

## Older Cleanup Archive

These entries describe earlier repository cleanup work. They are kept after the current product/workspace log so the active handoff stays readable.

## Summary

Completed three requested changes:

1. Translated Chinese documentation content into English.
2. Renamed documentation files so filenames are English and use `_` instead of `-`.
3. Translated Chinese code comments and Python docstrings into English.

Runtime strings, UI copy, test data strings, Chinese keyword matching, and user-facing Chinese text inside executable code were left unchanged unless they were comments/docstrings.

## Documentation Content Translated

These files had Chinese documentation content translated to English:

- `AGENTS.md`
- `AI.md`
- `AWS/TRIPSYNC_AWS_MASTER_CONTEXT_FINAL.md`
- `backend/README.md`
- `docs/AGENTS.md`
- `docs/HANDOFF_PROMPT_CURRENT.md`
- `docs/HANDOFF_PROMPT_BACKEND_REFACTOR_CURRENT.md`
- `docs/PRODUCT.md`
- `docs/PROPOSAL.md`
- `docs/PROPOSAL_EN.md`
- `docs/_archive/README.md`
- `docs/_archive/capstone-project-proposal-revised-zh.md`
- `docs/_archive/多人协作式 AI 旅行规划平台——完整项目想法.docx`
- `docs/_archive/群体旅行决策引擎_中文方案.docx`
- `docs/_archive/群体旅行决策引擎_功能优先级.xlsx`
- `docs/frontend/ai-travel-hero-scroll-storytelling-final.md`
- `docs/产品介绍页面.md`
- `trip/BACKEND.md`
- `trip/FRONTEND.md`
- `trip/README.md`
- `交接.md`

Original backup:

- `/private/tmp/main_sync_fresh_chinese_document_backup/20260812_230828`

## Documentation Filename Cleanup

Documentation filenames were normalized to avoid Chinese names and avoid hyphens. The affected files were:

- `.agents/skills/improve-codebase-architecture/HTML-REPORT.md`
- `INTEGRATION-ROADMAP.md`
- `backend/app/agents/issue-tracker.md`
- `docs/HANDOFF_PROMPT_CURRENT.md`
- `docs/HANDOFF_PROMPT_BACKEND_REFACTOR_CURRENT.md`
- `docs/_archive/capstone-project-proposal-revised.md`
- `docs/_archive/collaborative-ai-travel-planning-platform-full-idea.docx`
- `docs/_archive/group-travel-decision-engine-feature-priority.xlsx`
- `docs/_archive/group-travel-decision-engine-proposal.docx`
- `docs/frontend/3d-collaborative-idea-sphere-design.md`
- `docs/frontend/ai-travel-hero-scroll-storytelling-final.md`
- `docs/navigation-execution-notes.md`
- `docs/navigation-known-wrong-behavior.md`
- `docs/product-introduction-page.md`

Examples of final naming:

- `INTEGRATION-ROADMAP.md` -> `INTEGRATION_ROADMAP.md`
- `docs/product-introduction-page.md` -> `docs/product_introduction_page.md`
- older dated handoff prompts -> `docs/HANDOFF_PROMPT_CURRENT.md`
- `docs/frontend/ai-travel-hero-scroll-storytelling-final.md` -> `docs/frontend/ai_travel_hero_scroll_storytelling_final.md`
- `交接.md` -> `HANDOFF.md`
- `docs/产品介绍页面.md` -> `docs/product_introduction_page.md`
- `backend/app/agents/issue-tracker.md` -> `backend/app/agents/issue_tracker.md`

Original backup:

- `/private/tmp/main_sync_fresh_filename_backup/20260812_231559`

## Code Comments Translated

Chinese comments and Python docstrings were translated to English in these code files:

- `trip/vite.config.js`
- `frontend/app/site-shell.tsx`
- `frontend/app/page.tsx`
- `backend/tests/test_engine.py`
- `backend/tests/conftest.py`
- `backend/tests/test_preferences.py`
- `backend/tests/test_trips.py`
- `backend/tests/test_schema.py`
- `backend/tests/test_chat.py`
- `backend/tests/test_paths.py`
- `backend/tests/test_jobs.py`
- `backend/tests/test_agents_base.py`
- `backend/data/poi_chicago.py`
- `backend/app/agents/chat.py`
- `backend/app/agents/base.py`
- `backend/app/db/models.py`
- `backend/app/db/session.py`
- `backend/app/db/reset_demo.py`
- `backend/app/db/seed.py`
- `backend/app/db/clear_plan.py`
- `backend/app/api/main.py`
- `backend/app/jobs/scheduler.py`
- `backend/app/agents/agent-server/agent.py`
- `backend/app/agents/agent-server/main.py`
- `backend/app/domain/preferences/service.py`
- `backend/app/domain/constraints/types.py`
- `backend/app/domain/constraints/engine.py`
- `backend/app/domain/chat/service.py`
- `backend/app/domain/plans/generator.py`
- `backend/app/domain/decisions/orchestrator.py`
- `backend/app/domain/trips/service.py`
- `trip/legacy/context/TripContext.jsx`
- `trip/legacy/components/StepStatus.jsx`
- `trip/legacy/components/DemoSwitch.jsx`
- `trip/legacy/components/DemoSwitch.module.css`
- `trip/legacy/components/ReviewPanel.jsx`
- `trip/legacy/components/LogicNote.module.css`
- `trip/legacy/components/Sidebar.jsx`
- `trip/legacy/components/primitives.module.css`
- `trip/legacy/components/LogicNote.jsx`
- `trip/legacy/components/SubNav.jsx`
- `trip/legacy/components/TripRow.jsx`
- `trip/legacy/components/PlanSectionCard.jsx`
- `trip/legacy/components/primitives.jsx`
- `trip/legacy/components/AiNote.jsx`
- `trip/legacy/layouts/AppLayout.module.css`
- `trip/legacy/layouts/TripWorkspace.jsx`
- `trip/legacy/layouts/OrganizerLayout.jsx`
- `trip/legacy/layouts/MemberLayout.jsx`
- `trip/legacy/data/trips.js`
- `trip/legacy/data/seed.js`
- `trip/legacy/pages/HomePage.jsx`
- `trip/legacy/pages/member/Chat.module.css`
- `trip/legacy/pages/member/InvitePage.jsx`
- `trip/legacy/pages/member/PreferencesStep.jsx`
- `trip/legacy/pages/member/ReviewStep.jsx`
- `trip/legacy/pages/member/TripListPage.jsx`
- `trip/legacy/pages/member/ConfirmStep.jsx`
- `trip/legacy/pages/organizer/PlanStage.jsx`
- `trip/legacy/pages/organizer/ReviewStage.jsx`
- `trip/legacy/pages/organizer/AnalyzeStage.jsx`
- `trip/legacy/pages/organizer/CollectStage.jsx`
- `trip/legacy/pages/organizer/CreateTripPage.jsx`
- `trip/legacy/pages/organizer/TripListPage.jsx`
- `trip/legacy/pages/organizer/LockStage.jsx`
- `trip/src/final/TripMap.jsx`
- `trip/src/final/final.css`
- `trip/src/final/FinalApp.jsx`
- `trip/src/final/TripAppState.jsx`

Original backup:

- `/private/tmp/main_sync_fresh_code_comment_backup/20260812_234449`

Repair backup for the 17 Python files that were re-written from the pre-translation backup after a docstring offset issue:

- `/private/tmp/main_sync_fresh_python_repair_backup/20260812_234855`

## Verification Completed

The final checks passed:

- Python syntax check: `64` Python files checked, `0` parse errors.
- Chinese comment/docstring scan: `0` matches in code comments and Python docstrings.
- Documentation filename scan: `0` Chinese documentation filenames.
- Documentation filename scan: `0` documentation filenames containing `-`.

## Notes For Next Person

- The repository already had unrelated worktree changes before and during this cleanup. I did not revert unrelated edits.
- `frontend/package-lock.json`, `trip/src/final/*`, `frontend/public/trip-app/*`, and generated app assets showed unrelated diffs in the working tree; treat them separately before committing.
- If you need to audit only this cleanup, compare against the backup directories above rather than assuming every current `git status` entry came from this pass.
- Chinese runtime strings still exist in places like UI labels, test values, chat keyword handling, and seed/demo content. That was intentional because the request was specifically about docs, filenames, and code comments.
