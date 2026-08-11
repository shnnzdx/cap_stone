import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolveRestoredWorkspaceDestination } from "../../trip/src/final/workspace-navigation-model.js";

function accountUser(overrides = {}) {
  return {
    tripId: "t1",
    role: "participant",
    isGuest: false,
    ...overrides,
  };
}

function resolveRestoration(overrides = {}) {
  return resolveRestoredWorkspaceDestination({
    currentRoutePath: "/",
    authToken: "token-1",
    membershipId: "m-1",
    currentUser: accountUser(),
    tripSummaries: [
      { id: "t1", status: "Planning", my_role: "participant" },
    ],
    activeTrip: {
      id: "t1",
      status: "Planning",
    },
    activeTripId: "t1",
    restoredTripId: "t1",
    ...overrides,
  });
}

test("phase 9 restoration uses the restored trip as a policy intent instead of leaving home as the implicit winner", () => {
  const resolution = resolveRestoration({
    tripSummaries: [
      { id: "t1", status: "Planning", my_role: "participant" },
      { id: "t2", status: "Traveling", my_role: "organizer" },
    ],
    explain: true,
  });

  assert.equal(resolution.disposition, "redirect");
  assert.equal(resolution.destinationHref, "/trip/t1/plan");
  assert.equal(resolution.diagnostics?.acceptedCode, "restored-selection-accepted");
});

test("phase 9 restoration keeps a valid restored trip eligible even when multiple memberships exist", () => {
  const resolution = resolveRestoration({
    tripSummaries: [
      { id: "t1", status: "Planning", my_role: "participant" },
      { id: "t2", status: "Traveling", my_role: "participant" },
    ],
    restoredTripId: "t1",
    explain: true,
  });

  assert.equal(resolution.disposition, "redirect");
  assert.equal(resolution.destinationHref, "/trip/t1/plan");
  assert.equal(resolution.diagnostics?.acceptedCode, "restored-selection-accepted");
});

test("phase 9 restoration rejects stale restored selections through policy when authoritative trip facts disagree", () => {
  const resolution = resolveRestoration({
    currentRoutePath: "/trip/t-old/plan",
    currentUser: accountUser({ tripId: "t2" }),
    tripSummaries: [
      { id: "t2", status: "Planning", my_role: "participant" },
    ],
    activeTrip: {
      id: "t2",
      status: "Planning",
    },
    activeTripId: "t2",
    restoredTripId: "t-old",
    explain: true,
  });

  assert.equal(resolution.disposition, "redirect");
  assert.equal(resolution.destinationHref, "/");
  assert.equal(resolution.diagnostics?.acceptedCode, "default-home");
  assert.equal(resolution.diagnostics?.rejectedIntents?.[0]?.code, "stale-restored-selection");
});

test("phase 9 restoration preserves unknown trip state as a valid restored-selection input", () => {
  const resolution = resolveRestoration({
    tripSummaries: [
      { id: "t1", my_role: "participant" },
    ],
    activeTrip: {
      id: "t1",
    },
    explain: true,
  });

  assert.equal(resolution.disposition, "redirect");
  assert.equal(resolution.destinationHref, "/trip/t1/plan");
  assert.equal(resolution.diagnostics?.acceptedCode, "restored-selection-accepted");
});

test("phase 9 runtime resolves restoration inside the workspace guard while leaving join outside that bootstrap flow", async () => {
  const source = await readFile(new URL("../../trip/src/final/FinalApp.jsx", import.meta.url), "utf8");

  assert.match(source, /resolveRestoredWorkspaceDestination/);
  assert.match(source, /const initialPathRef = useRef\(location\.pathname\)/);
  assert.match(source, /app\.tripSummariesStatus === 'loading'/);
  assert.match(source, /if \(restorationResolution\?\.disposition === 'redirect'\)/);
  assert.match(source, /<Route element={<WorkspaceRouteGuard\/>}>/);
  assert.match(source, /<Route path="\/join\/:token" element={<JoinInvitePage\/>}\/>/);
});

test("phase 9 TripAppState keeps storage and request-header ownership while adding authoritative trip summaries for restoration", async () => {
  const source = await readFile(new URL("../../trip/src/final/TripAppState.jsx", import.meta.url), "utf8");

  assert.match(source, /const \[restoredTripId\] = useState\(\(\) => readLocal\('tripsync:tripId'\)/);
  assert.match(source, /const \[activeTripId, setActiveTripId\] = useState\(\(\) => readLocal\('tripsync:tripId'\)/);
  assert.match(source, /writeLocal\('tripsync:membershipId', nextMembershipId\)/);
  assert.match(source, /writeLocal\('tripsync:tripId', nextTripId\)/);
  assert.match(source, /\.\.\.\(activeTripId \? \{ 'X-Trip-Id': activeTripId \} : \{\}\),/);
  assert.match(source, /\.\.\.\(DEV_ALLOW_MEMBERSHIP_HEADER && membershipId \? \{ 'X-Membership-Id': membershipId \} : \{\}\),/);
  assert.match(source, /const raw = await accountRequestJson\('\/api\/trips'\)/);
  assert.match(source, /setTripSummariesStatus\('failed'\)/);
  assert.match(source, /writeLocal\(`\$\{INVITE_SESSION_PREFIX\}\$\{inviteToken\}`/);
});
