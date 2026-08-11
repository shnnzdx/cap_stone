import assert from "node:assert/strict";
import test from "node:test";
import { tripNavigationPolicy } from "../../shared/trip-navigation-policy/index.js";
import {
  NavigationNormalizationError,
  normalizeInviteFlowFacts,
  normalizeWorkspaceSessionFacts,
} from "../../trip/src/final/navigation-normalizers.js";

const trip = (tripId, section) => ({ kind: "trip", tripId, section });

function toResolutionInput(workspaceFacts, extras = {}) {
  return {
    accessState: workspaceFacts.accessState,
    relevantTripsById: workspaceFacts.relevantTripsById,
    intent: {
      ...workspaceFacts.intent,
      ...(extras.intent || {}),
    },
    ...(extras.invite ? { invite: extras.invite } : {}),
  };
}

test("normalizeWorkspaceSessionFacts maps multiple account-backed memberships and trip states", () => {
  const actual = normalizeWorkspaceSessionFacts({
    hasAccountSession: true,
    memberships: [
      { membership_id: "m-1", trip_id: "t-1", role: "organizer" },
      { membership_id: "m-2", trip_id: "t-2", role: "participant" },
    ],
    tripSummaries: [
      { id: "t-1", status: "planning", my_role: "organizer" },
      { id: "t-2", status: "Traveling", my_role: "participant" },
    ],
  });

  assert.equal(actual.accessState, "trip-session");
  assert.deepEqual(actual.relevantTripsById, {
    "t-1": { membership: { role: "organizer", identityKind: "account" }, state: "planning" },
    "t-2": { membership: { role: "participant", identityKind: "account" }, state: "active" },
  });
  assert.doesNotThrow(() => tripNavigationPolicy.resolveDestination(toResolutionInput(actual)));
});

test("normalizeWorkspaceSessionFacts maps current guest user into guest-backed participant membership", () => {
  const actual = normalizeWorkspaceSessionFacts({
    membershipId: "m-guest",
    activeTripId: "t-guest",
    currentUser: {
      membershipId: "m-guest",
      tripId: "t-guest",
      role: "guest",
      isGuest: true,
    },
    activeTrip: {
      id: "t-guest",
      status: "Planning",
    },
  });

  assert.equal(actual.accessState, "trip-session");
  assert.deepEqual(actual.relevantTripsById, {
    "t-guest": {
      membership: { role: "participant", identityKind: "guest" },
      state: "planning",
    },
  });
  assert.doesNotThrow(() => tripNavigationPolicy.resolveDestination(toResolutionInput(actual)));
});

test("normalizeWorkspaceSessionFacts keeps state-only trip facts and missing state becomes unknown", () => {
  const actual = normalizeWorkspaceSessionFacts({
    tripSummaries: [
      { id: "t-open", status: null },
      { id: "t-archive", status: "Past trip" },
    ],
  });

  assert.equal(actual.accessState, "signed-out");
  assert.deepEqual(actual.relevantTripsById, {
    "t-open": { state: "unknown" },
    "t-archive": { state: "archived" },
  });
  assert.doesNotThrow(() => tripNavigationPolicy.resolveDestination(toResolutionInput(actual)));
});

test("normalizeWorkspaceSessionFacts derives session-no-trip-access without manufacturing memberships", () => {
  const actual = normalizeWorkspaceSessionFacts({
    hasAccountSession: true,
  });

  assert.equal(actual.accessState, "session-no-trip-access");
  assert.deepEqual(actual.relevantTripsById, {});
  assert.doesNotThrow(() => tripNavigationPolicy.resolveDestination(toResolutionInput(actual)));
});

test("normalizeWorkspaceSessionFacts can delegate route-path parsing to the shared workspace route codec", () => {
  const actual = normalizeWorkspaceSessionFacts({
    hasAccountSession: true,
    memberships: [{ membership_id: "m-1", trip_id: "t-1", role: "participant" }],
    activeTrip: { id: "t-1", status: "planning" },
    restoredTripId: "t-stale",
    restoredPreferredSection: "plan",
    currentRoutePath: "/trip/t-1/chat",
    returnTargetPath: "/trip/t-1/updates",
  });

  assert.deepEqual(actual.intent, {
    currentRoute: trip("t-1", "chat"),
    returnTarget: trip("t-1", "updates"),
    restoredSelection: {
      tripId: "t-stale",
      preferredSection: "plan",
    },
  });
  assert.doesNotThrow(() => tripNavigationPolicy.resolveDestination(toResolutionInput(actual)));
});

test("normalizeWorkspaceSessionFacts rejects invalid route paths through the shared workspace route codec", () => {
  assert.throws(
    () => normalizeWorkspaceSessionFacts({
      currentRoutePath: "/trip/t-1/not-a-section",
    }),
    (error) => error instanceof NavigationNormalizationError && error.code === "current-route-invalid",
  );
});

test("normalizeWorkspaceSessionFacts throws on inconsistent guest organizer facts", () => {
  assert.throws(
    () => normalizeWorkspaceSessionFacts({
      currentUser: {
        tripId: "t-bad",
        role: "organizer",
        isGuest: true,
      },
    }),
    (error) => error instanceof NavigationNormalizationError && error.code === "guest-organizer-role",
  );
});

test("normalizeInviteFlowFacts keeps valid invite-open facts objective and does not classify repeated invite", () => {
  const actual = normalizeInviteFlowFacts({
    token: "inv-open",
    step: "open",
    invitePreview: {
      name: "Chicago birthday",
      destination: "Chicago",
    },
  });

  assert.deepEqual(actual, {
    invite: {
      token: "inv-open",
      validity: "valid",
    },
    intent: {
      inviteFlow: {
        token: "inv-open",
        step: "open",
      },
    },
  });
  assert(!JSON.stringify(actual).includes("repeat"));
  assert(!JSON.stringify(actual).includes("fresh"));
  assert(!JSON.stringify(actual).includes("stale"));
});

test("normalizeInviteFlowFacts can accept an explicit invite tripId from token-scoped saved invite state without fabricating one from preview", () => {
  const actual = normalizeInviteFlowFacts({
    token: "inv-saved",
    step: "open",
    invitePreview: {
      name: "Chicago birthday",
      destination: "Chicago",
    },
    tripId: "t-saved",
  });

  assert.deepEqual(actual, {
    invite: {
      token: "inv-saved",
      validity: "valid",
      tripId: "t-saved",
    },
    intent: {
      inviteFlow: {
        token: "inv-saved",
        step: "open",
      },
    },
  });
});

test("normalizeInviteFlowFacts maps invite completion with trip id into policy-ready invite facts", () => {
  const workspaceFacts = normalizeWorkspaceSessionFacts({
    currentUser: {
      tripId: "t-join",
      role: "guest",
      isGuest: true,
    },
    activeTrip: {
      id: "t-join",
      status: "unknown",
    },
  });
  const inviteFacts = normalizeInviteFlowFacts({
    token: "inv-complete",
    step: "complete",
    joinResult: {
      membership_id: "m-join",
      trip_id: "t-join",
      role: "participant",
    },
  });

  assert.deepEqual(inviteFacts, {
    invite: {
      token: "inv-complete",
      validity: "valid",
      tripId: "t-join",
    },
    intent: {
      inviteFlow: {
        token: "inv-complete",
        step: "complete",
      },
    },
  });
  assert.doesNotThrow(() => tripNavigationPolicy.resolveDestination(
    toResolutionInput(workspaceFacts, inviteFacts),
  ));
});

test("normalizeInviteFlowFacts maps invalid invites and enforces token consistency", () => {
  const invalidInvite = normalizeInviteFlowFacts({
    token: "inv-stale",
    step: "open",
    inviteErrorStatus: 404,
  });

  assert.deepEqual(invalidInvite, {
    invite: {
      token: "inv-stale",
      validity: "invalid",
    },
    intent: {
      inviteFlow: {
        token: "inv-stale",
        step: "open",
      },
    },
  });

  assert.throws(
    () => normalizeInviteFlowFacts({
      token: "inv-a",
      inviteToken: "inv-b",
      step: "open",
      invitePreview: { name: "Mismatch" },
    }),
    (error) => error instanceof NavigationNormalizationError && error.code === "invite-token-mismatch",
  );
});
