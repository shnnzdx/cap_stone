import assert from "node:assert/strict";
import test from "node:test";
import {
  parseWorkspaceRoute,
  serializeWorkspaceRoute,
} from "../../shared/trip-navigation-route/index.js";
import { buildTripPreviewFrameSrc } from "../../shared/tripsync-preview-contract.js";

const roundTripCases = [
  { ref: { kind: "home" }, path: "/" },
  { ref: { kind: "create-trip" }, path: "/create" },
  { ref: { kind: "account", section: "profile" }, path: "/account/profile" },
  { ref: { kind: "account", section: "travel" }, path: "/account/travel" },
  { ref: { kind: "account", section: "notifications" }, path: "/account/notifications" },
  { ref: { kind: "account", section: "settings" }, path: "/account/settings" },
  { ref: { kind: "trip", tripId: "t1", section: "plan" }, path: "/trip/t1/plan" },
  { ref: { kind: "trip", tripId: "t1", section: "chat" }, path: "/trip/t1/chat" },
  { ref: { kind: "trip", tripId: "t1", section: "conflict" }, path: "/trip/t1/conflict" },
  { ref: { kind: "trip", tripId: "t1", section: "updates" }, path: "/trip/t1/updates" },
  { ref: { kind: "trip", tripId: "t1", section: "preferences" }, path: "/trip/t1/preferences" },
  { ref: { kind: "trip", tripId: "t1", section: "members" }, path: "/trip/t1/members" },
  { ref: { kind: "trip", tripId: "t1", section: "invite" }, path: "/trip/t1/invite" },
  { ref: { kind: "join", token: "invite-token" }, path: "/join/invite-token" },
];

test("workspace route codec round-trips every frozen route-ref variant", () => {
  for (const testCase of roundTripCases) {
    const serialized = serializeWorkspaceRoute(testCase.ref);
    const parsed = parseWorkspaceRoute(serialized);

    assert.equal(serialized, testCase.path);
    assert.deepEqual(parsed, testCase.ref, testCase.path);
  }
});

test("workspace route codec rejects malformed and unsupported workspace paths deterministically", () => {
  for (const path of [
    "",
    "trip/t1/plan",
    "/trip/",
    "/trip/t1",
    "/trip/t1/not-a-section",
    "/account/not-a-section",
    "/join/",
    "/unknown",
    "/trip/t1/plan/",
    "/trip//plan",
    "/trip-app/index.html#/trip/t1/plan",
    "https://example.com/trip-app/index.html#/trip/t1/plan",
    "/trip/t1/plan?debug=1",
    "#/trip/t1/plan",
  ]) {
    assert.equal(parseWorkspaceRoute(path), null, path);
  }
});

test("workspace route codec encodes and decodes dynamic trip and invite identifiers canonically", () => {
  const tripRef = { kind: "trip", tripId: "trip alpha/beta", section: "updates" };
  const joinRef = { kind: "join", token: "token with spaces/and?symbols" };

  const tripPath = serializeWorkspaceRoute(tripRef);
  const joinPath = serializeWorkspaceRoute(joinRef);

  assert.equal(tripPath, "/trip/trip%20alpha%2Fbeta/updates");
  assert.equal(joinPath, "/join/token%20with%20spaces%2Fand%3Fsymbols");
  assert.deepEqual(parseWorkspaceRoute(tripPath), tripRef);
  assert.deepEqual(parseWorkspaceRoute(joinPath), joinRef);
});

test("workspace route codec composes with preview host formatting without owning iframe URL construction", () => {
  const path = serializeWorkspaceRoute({ kind: "join", token: "invite-token" });

  assert.equal(path, "/join/invite-token");
  assert.equal(buildTripPreviewFrameSrc(path), "/trip-app/index.html#/join/invite-token");
});

test("workspace route codec rejects unsupported route-ref shapes during serialization", () => {
  assert.throws(
    () => serializeWorkspaceRoute({ kind: "trip", tripId: "", section: "plan" }),
    (error) => error?.code === "missing-trip-id",
  );
  assert.throws(
    () => serializeWorkspaceRoute({ kind: "account", section: "billing" }),
    (error) => error?.code === "invalid-account-section",
  );
  assert.throws(
    () => serializeWorkspaceRoute({ kind: "trip", tripId: "t1", section: "billing" }),
    (error) => error?.code === "invalid-trip-section",
  );
});
