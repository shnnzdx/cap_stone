# Navigation Known-Wrong Behavior

Recorded on August 11, 2026 during Phase 1 characterization. These notes describe
current observable behavior that should not be silently frozen as desired product policy.

## Login and Return Intent

- The login page only transports a host-level `next` string and accepts it when it starts
  with `/`. It does not carry a structured workspace return intent.
- After that minimal check, login redirects to `window.location.href = nextPath` without
  route reachability or role-based validation.
- This means a slash-prefixed path can win even when it does not encode a valid workspace
  destination.

## Restored Trip Selection

- `TripAppState` restores `tripsync:tripId` directly into `activeTripId` and uses it for
  trip-scoped API requests.
- There is no centralized fallback that selects another reachable trip when the restored
  trip is stale or inaccessible.
- Current failure handling is user-visible load error / sign-in / retry behavior rather
  than product-policy destination fallback.

## Organizer-Only Workspace Routes

- Organizer-only entries are hidden in the `TripShell` tabs for non-organizers.
- The route declarations for `/trip/:tripId/members` and `/trip/:tripId/invite` still
  exist unconditionally in `FinalApp`.
- Current behavior therefore relies on UI visibility plus page-level logic instead of a
  single workspace route-policy owner.

## Phase 7 Audit Note

- Before: a participant could manually open `/trip/:tripId/members` or
  `/trip/:tripId/invite` because the workspace only hid tabs and the `members` page still
  rendered its own local fallback.
- After: current-route reachability is evaluated centrally through
  `tripNavigationPolicy.resolveDestination()`, and participants are redirected to
  `/trip/:tripId/plan` per the frozen `role-not-authorized` policy case.
- Reason: Phase 7 approved moving current-route authorization and fallback ownership out
  of `FinalApp` and into the shared workspace policy seam.
- Frozen policy cases: `current-route-organizer-only-rejected-for-participant` and
  `organizer-only-route-with-unknown-state-remains-role-restricted`.

## Phase 9 Audit Note

- Before: `TripAppState` restored `tripsync:tripId` as technical request context, but the
  runtime did not explicitly normalize that persisted value into a
  `restoredSelection` intent before deciding the initial workspace destination.
- After: once initial session facts and authoritative `/api/trips` access facts are
  hydrated, the initial workspace destination is resolved through
  `tripNavigationPolicy.resolveDestination()` using the restored selection plus the
  current route as competing intents.
- Reason: Phase 9 approved moving restoration-time destination ownership out of
  implicit `TripAppState` assumptions and into the frozen navigation-policy seam.
- Frozen policy cases: `restored-selection-used-when-no-stronger-valid-intent-exists`,
  `stale-restored-selection-absent-from-trip-facts-falls-back-to-default`, and
  `restored-selection-with-unknown-state-is-accepted-when-trip-is-reachable`.
- Remaining Candidate 2 debt: account bootstrap still starts with the stored
  `tripsync:tripId` as technical request context, so a stale stored trip that blocks
  initial session hydration is still a session-layer concern rather than a resolved
  product-policy fallback.

## Host / Workspace Handoff

- The host `/trip` page always boots the workspace through the default iframe preview
  source `/trip-app/index.html#/`.
- There is no structured host-to-workspace handoff for a workspace-level return intent.

## Invite / Join Flow

- Repeated-invite handling depends on a browser-local `tripsync:invite:<token>` record.
- Fresh join completion navigates to `/trip/:tripId/preferences`.
- Repeated invite reopen navigates to `/trip/:tripId/plan`.
- Invalid or stale invite links remain on the join route and render an unavailable UI state.

These behaviors are intentionally documented separately from the approved target product
policy so that Phase 2 matrix tests can encode the desired rules without inheriting the
current limitations.
