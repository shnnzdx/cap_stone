import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolveCurrentWorkspaceRoute } from "../../trip/src/final/workspace-navigation-model.js";

function accountUser(overrides = {}) {
  return {
    tripId: "t1",
    role: "participant",
    isGuest: false,
    ...overrides,
  };
}

function guestUser(overrides = {}) {
  return {
    tripId: "t1",
    role: "guest",
    isGuest: true,
    ...overrides,
  };
}

function resolveRoute(overrides = {}) {
  return resolveCurrentWorkspaceRoute({
    currentRoutePath: "/trip/t1/plan",
    currentUser: accountUser(),
    activeTripId: "t1",
    activeTrip: {
      id: "t1",
      status: "Planning",
    },
    ...overrides,
  });
}

test("phase 7 current-route guard allows organizer and participant routes that are reachable", () => {
  const organizerMembers = resolveRoute({
    currentRoutePath: "/trip/t1/members",
    currentUser: accountUser({ role: "organizer" }),
  });
  const participantUpdates = resolveRoute({
    currentRoutePath: "/trip/t1/updates",
  });

  assert.equal(organizerMembers.disposition, "allow");
  assert.equal(organizerMembers.destinationHref, "/trip/t1/members");
  assert.equal(participantUpdates.disposition, "allow");
  assert.equal(participantUpdates.destinationHref, "/trip/t1/updates");
});

test("phase 7 current-route guard redirects participant organizer-only routes to the frozen trip plan fallback", () => {
  const members = resolveRoute({
    currentRoutePath: "/trip/t1/members",
    explain: true,
  });
  const invite = resolveRoute({
    currentRoutePath: "/trip/t1/invite",
    explain: true,
  });

  for (const result of [members, invite]) {
    assert.equal(result.disposition, "redirect");
    assert.equal(result.destinationHref, "/trip/t1/plan");
    assert.equal(result.diagnostics?.acceptedCode, "role-not-authorized");
    assert.equal(result.diagnostics?.rejectedIntents?.[0]?.code, "role-not-authorized");
  }
});

test("phase 7 current-route guard keeps organizer-only invite reachable for organizers", () => {
  const organizerInvite = resolveRoute({
    currentRoutePath: "/trip/t1/invite",
    currentUser: accountUser({ role: "organizer" }),
  });

  assert.equal(organizerInvite.disposition, "allow");
  assert.equal(organizerInvite.destinationHref, "/trip/t1/invite");
});

test("phase 7 guest-backed participant behavior comes from policy for home, allowed trip routes, and disallowed account routes", () => {
  const guestHome = resolveRoute({
    currentRoutePath: "/",
    currentUser: guestUser(),
  });
  const guestPreferences = resolveRoute({
    currentRoutePath: "/trip/t1/preferences",
    currentUser: guestUser(),
  });
  const guestAccount = resolveRoute({
    currentRoutePath: "/account/profile",
    currentUser: guestUser(),
    explain: true,
  });

  assert.equal(guestHome.disposition, "redirect");
  assert.equal(guestHome.destinationHref, "/trip/t1/plan");
  assert.equal(guestPreferences.disposition, "allow");
  assert.equal(guestPreferences.destinationHref, "/trip/t1/preferences");
  assert.equal(guestAccount.disposition, "redirect");
  assert.equal(guestAccount.destinationHref, "/trip/t1/plan");
  assert.equal(guestAccount.diagnostics?.acceptedCode, "default-guest-trip-plan");
});

test("phase 7 current-route guard redirects inaccessible trip routes to the frozen account-backed fallback", () => {
  const inaccessibleTrip = resolveRoute({
    currentRoutePath: "/trip/t2/updates",
    explain: true,
  });

  assert.equal(inaccessibleTrip.disposition, "redirect");
  assert.equal(inaccessibleTrip.destinationHref, "/");
  assert.equal(inaccessibleTrip.diagnostics?.acceptedCode, "default-home");
  assert.equal(inaccessibleTrip.diagnostics?.rejectedIntents?.[0]?.code, "trip-not-accessible");
});

test("phase 7 current-route guard preserves unknown-state reachability and conflict-route access independently from nav visibility", () => {
  const unknownStateChat = resolveRoute({
    currentRoutePath: "/trip/t1/chat",
    activeTrip: {
      id: "t1",
    },
  });
  const conflictRoute = resolveRoute({
    currentRoutePath: "/trip/t1/conflict",
  });

  assert.equal(unknownStateChat.disposition, "allow");
  assert.equal(unknownStateChat.destinationHref, "/trip/t1/chat");
  assert.equal(conflictRoute.disposition, "allow");
  assert.equal(conflictRoute.destinationHref, "/trip/t1/conflict");
});

test("phase 7 malformed workspace paths stay outside product policy and do not become policy fallbacks", () => {
  const malformed = resolveRoute({
    currentRoutePath: "/trip-app/index.html#/trip/t1/plan",
  });

  assert.equal(malformed, null);
});

test("phase 7 FinalApp uses a shared route guard adapter while keeping join and catch-all routing outside policy execution", async () => {
  const source = await readFile(new URL("../../trip/src/final/FinalApp.jsx", import.meta.url), "utf8");

  assert.match(source, /resolveCurrentWorkspaceRoute/);
  assert.match(source, /function WorkspaceRouteGuard\(\)/);
  assert.match(source, /<Route element={<WorkspaceRouteGuard\/>}>/);
  assert.match(source, /<Route path="\*" element={<Navigate to="\/" replace\/>}\/>/);
  assert.match(source, /<Route path="\/join\/:token" element={<JoinInvitePage\/>}\/>/);
  assert.doesNotMatch(source, /if \(currentUser\.role === 'guest'\) return <Navigate to=\{`\/trip\/\$\{currentTrip\.id\}\/plan`\} replace\/>/);
  assert.doesNotMatch(source, /if \(currentUser\.role !== 'organizer'\)/);
});
