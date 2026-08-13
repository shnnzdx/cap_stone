# Trip Frontend Logic

This document describes how the Trip workspace frontend should behave today.

Read this before changing Trip UI structure, especially around:

- navigation
- session restore
- Plan page state
- assistant drawer behavior
- activity history

## Frontend Rule

The Trip frontend is not the source of truth for decision policy.

It should:

- collect user intent
- show previews when appropriate
- call backend/runtime seams
- render the returned outcome

It should not:

- invent path policy locally
- own raw technical session persistence
- duplicate Plan state in multiple places

## Main Source Files

The most important runtime files are:

- `src/final/FinalApp.jsx`
- `src/final/TripAppState.jsx`
- `src/final/tripContent.js`
- `src/final/final.css`
- `src/final/plan-feature/PlanFeature.jsx`
- `src/final/plan-feature/usePlanInteractionRuntime.js`
- `src/final/plan-feature/useAssistantChangeRequestFlow.js`

## Frozen UI Ownership

Keep these boundaries intact:

- `FinalApp.jsx`
  - route mount
  - workspace composition
  - command execution
- `PlanFeature.jsx`
  - public Plan feature boundary
- `usePlanInteractionRuntime.js`
  - item selection
  - comments
  - map/list coordination
  - menu state
  - booking interactions
  - drawer open/close behavior
- `useAssistantChangeRequestFlow.js`
  - assistant conversation inside the drawer
  - proposal apply flow
  - confirm redirect command emission

## Routes

Main workspace routes:

- `/`
- `/create`
- `/account/:section`
- `/trip/:tripId/plan`
- `/trip/:tripId/chat`
- `/trip/:tripId/conflict`
- `/trip/:tripId/updates`
- `/trip/:tripId/preferences`
- `/trip/:tripId/members`
- `/trip/:tripId/invite`
- `/join/:token`

Navigation policy is not owned inline by route tabs or page-local fallback code. It flows
through `shared/trip-navigation-policy/`.

## Current UX Behaviors That Matter

These are important current behaviors already merged into `New`:

- account login should stay on `My Trips` when landing on workspace home
- refreshing an already open trip route should preserve that trip route when valid
- guest-backed sessions still return into their trip
- My Trips should not show fake default trips in real account flows
- creating a trip should update local UI state immediately
- saving preferences should return to the Plan page
- the Plan page should show real empty states instead of forced demo fallbacks
- activity history should come from real backend `PlanChange` rows only
- initial generation rows should not appear as user-facing activity change history
- clicking an activity number should only show history when that activity really has later
  history worth showing

## Assistant Drawer Rules

The assistant drawer may:

- propose a change
- dry-run a change
- explain likely impact

It must not:

- mutate itinerary state locally as final truth
- bypass the backend change flow
- hide whether a result is applied, pending, or blocked

## Comments And Booking

Comments and booking are part of real Plan interaction state.

Do not move them out into disconnected local component state just for visual refactors.

## Styling Notes

Visual redesign is allowed, but product policy must stay out of styling components.

Be especially careful not to reintroduce these old mistakes:

- role-based destination logic inside UI tabs
- raw session storage reads inside random components
- second copies of Plan interaction state
- hardcoded route fallback logic inside leaf pages

## Current Frontend Follow-Up Candidates

Good next frontend work includes:

- clearer blocked-generation UX
- stronger organizer/member surface polish
- better account/dashboard empty states
- cleaner visual treatment for assistant and change-request flows
- further reduction of remaining demo-only fallback copy
