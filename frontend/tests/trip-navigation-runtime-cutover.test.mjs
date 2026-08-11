import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildWorkspaceNavigationModel } from "../../trip/src/final/workspace-navigation-model.js";

function entryIds(model) {
  return model.entries.map((entry) => entry.id);
}

function hrefById(model) {
  return Object.fromEntries(model.entries.map((entry) => [entry.id, entry.href]));
}

test("phase 6 organizer runtime navigation matches frozen described order and active members state", () => {
  const model = buildWorkspaceNavigationModel({
    currentRoutePath: "/trip/t1/members",
    currentUser: {
      tripId: "t1",
      role: "organizer",
      isGuest: false,
    },
    activeTripId: "t1",
    activeTrip: {
      id: "t1",
      status: "Planning",
    },
  });

  assert.deepEqual(entryIds(model), [
    "plan",
    "chat",
    "updates",
    "preferences",
    "members",
    "invite",
  ]);
  assert.equal(model.contextHref, "/");
  assert.equal(model.entries.find((entry) => entry.active)?.id, "members");
  assert.deepEqual(hrefById(model), {
    plan: "/trip/t1/plan",
    chat: "/trip/t1/chat",
    updates: "/trip/t1/updates",
    preferences: "/trip/t1/preferences",
    members: "/trip/t1/members",
    invite: "/trip/t1/invite",
  });
});

test("phase 6 participant runtime navigation hides organizer-only entries and marks updates active", () => {
  const model = buildWorkspaceNavigationModel({
    currentRoutePath: "/trip/t1/updates",
    currentUser: {
      tripId: "t1",
      role: "participant",
      isGuest: false,
    },
    activeTripId: "t1",
    activeTrip: {
      id: "t1",
      status: "Planning",
    },
  });

  assert.deepEqual(entryIds(model), [
    "plan",
    "chat",
    "updates",
    "preferences",
  ]);
  assert.equal(model.contextHref, "/");
  assert.equal(model.entries.find((entry) => entry.active)?.id, "updates");
  assert(!entryIds(model).includes("members"));
  assert(!entryIds(model).includes("invite"));
});

test("phase 6 guest-backed participant runtime navigation preserves no-home semantics and visible active preferences entry", () => {
  const model = buildWorkspaceNavigationModel({
    currentRoutePath: "/trip/t1/preferences",
    currentUser: {
      tripId: "t1",
      role: "guest",
      isGuest: true,
    },
    activeTripId: "t1",
    activeTrip: {
      id: "t1",
      status: "Planning",
    },
  });

  assert.deepEqual(entryIds(model), [
    "plan",
    "chat",
    "updates",
    "preferences",
  ]);
  assert.equal(model.contextHref, null);
  assert.equal(model.entries.find((entry) => entry.active)?.id, "preferences");
});

test("phase 6 account runtime navigation uses described account ordering and active settings entry", () => {
  const model = buildWorkspaceNavigationModel({
    currentRoutePath: "/account/settings",
    currentUser: {
      tripId: "t1",
      role: "participant",
      isGuest: false,
    },
    activeTripId: "t1",
    activeTrip: {
      id: "t1",
      status: "Planning",
    },
  });

  assert.deepEqual(entryIds(model), [
    "account-profile",
    "account-travel",
    "account-notifications",
    "account-settings",
  ]);
  assert.equal(model.contextHref, "/");
  assert.equal(model.entries.find((entry) => entry.active)?.id, "account-settings");
  assert.deepEqual(hrefById(model), {
    "account-profile": "/account/profile",
    "account-travel": "/account/travel",
    "account-notifications": "/account/notifications",
    "account-settings": "/account/settings",
  });
});

test("phase 6 no longer aliases the hidden conflict route to an active chat tab", () => {
  const model = buildWorkspaceNavigationModel({
    currentRoutePath: "/trip/t1/conflict",
    currentUser: {
      tripId: "t1",
      role: "participant",
      isGuest: false,
    },
    activeTripId: "t1",
    activeTrip: {
      id: "t1",
      status: "Planning",
    },
  });

  assert.deepEqual(entryIds(model), [
    "plan",
    "chat",
    "updates",
    "preferences",
  ]);
  assert.equal(model.entries.some((entry) => entry.active), false);
});

test("phase 6 FinalApp consumes the shared runtime navigation model instead of owning tab policy locally", async () => {
  const source = await readFile(new URL("../../trip/src/final/FinalApp.jsx", import.meta.url), "utf8");

  assert.match(source, /buildWorkspaceNavigationModel/);
  assert.match(source, /navigation\.entries\.map/);
  assert.match(source, /to=\{navigation\.contextHref\}/);
  assert.doesNotMatch(source, /const active = segment === 'conflict' \? 'chat' : segment/);
  assert.doesNotMatch(source, /\{isOrganizer && <Link className=\{active === 'members' \? 'active' : ''\}/);
  assert.doesNotMatch(source, /\{ id: 'profile', label: 'Profile', to: '\/account\/profile' \}/);
});
