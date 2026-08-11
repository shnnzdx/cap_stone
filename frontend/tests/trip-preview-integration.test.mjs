import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { syncTripPreview } from "../scripts/sync-trip-preview.mjs";
import {
  buildTripPreviewAbsoluteUrl,
  buildTripPreviewFrameSrc,
  tripPreviewBasePath,
  tripPreviewDefaultHashRoute,
} from "../../shared/tripsync-preview-contract.js";
import { serializeWorkspaceRoute } from "../../shared/trip-navigation-route/index.js";
import {
  demoInitialDays,
  demoTrip,
  demoTripMembers,
} from "../../shared/tripsync-demo-data.js";
import {
  planningFlowSteps,
  productPrinciples,
} from "../../shared/tripsync-product-content.js";

test("shares one preview routing contract across frontend and trip", async () => {
  const [previewConfig, tripViteConfig, tripFinalApp] = await Promise.all([
    readFile(new URL("../app/trip/preview-config.ts", import.meta.url), "utf8"),
    readFile(new URL("../../trip/vite.config.js", import.meta.url), "utf8"),
    readFile(new URL("../../trip/src/final/FinalApp.jsx", import.meta.url), "utf8"),
  ]);

  assert.equal(tripPreviewBasePath, "/trip-app");
  assert.equal(tripPreviewDefaultHashRoute, "#/");
  assert.equal(buildTripPreviewFrameSrc(), "/trip-app/index.html#/");
  assert.equal(
    buildTripPreviewAbsoluteUrl("http://127.0.0.1:5173", "/join/chicago-birthday"),
    "http://127.0.0.1:5173/trip-app/index.html#/join/chicago-birthday",
  );
  assert.match(previewConfig, /tripsync-preview-contract\.js/);
  assert.match(tripViteConfig, /base:\s*["']\/trip-app\/["']/);
  assert.match(tripFinalApp, /path="\/"/);
  assert.match(tripFinalApp, /path="\/trip\/:tripId\/plan"/);
  assert.match(tripFinalApp, /path="\/join\/:token"/);
});

test("maps shared workspace route refs to the active workspace routes", () => {
  assert.equal(serializeWorkspaceRoute({ kind: "home" }), "/");
  assert.equal(serializeWorkspaceRoute({ kind: "create-trip" }), "/create");
  assert.equal(serializeWorkspaceRoute({ kind: "account", section: "settings" }), "/account/settings");
  assert.equal(serializeWorkspaceRoute({ kind: "trip", tripId: "demo-trip", section: "chat" }), "/trip/demo-trip/chat");
  assert.equal(serializeWorkspaceRoute({ kind: "join", token: "invite-token" }), "/join/invite-token");
  assert.equal(serializeWorkspaceRoute({ kind: "trip", tripId: "demo-trip", section: "updates" }), "/trip/demo-trip/updates");
  assert.equal(serializeWorkspaceRoute({ kind: "trip", tripId: "demo-trip", section: "plan" }), "/trip/demo-trip/plan");
});

test("keeps the Trip preview contract and shell connected", async () => {
  const [sharedTheme, tripPage, frontendGlobals, tripIndex] = await Promise.all([
    readFile(new URL("../../shared/tripsync-preview-theme.css", import.meta.url), "utf8"),
    readFile(new URL("../app/trip/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../public/trip-app/index.html", import.meta.url), "utf8"),
  ]);

  assert.match(sharedTheme, /--trip-preview-accent:/);
  assert.match(sharedTheme, /--trip-preview-background:/);
  assert.match(tripPage, /tripPreviewFrameSrc/);
  assert.match(frontendGlobals, /@import "\.\.\/\.\.\/shared\/tripsync-preview-theme\.css";/);
  assert.match(frontendGlobals, /var\(--trip-preview-accent\)/);
  assert.match(tripIndex, /\/trip-app\/assets\//);
});

test("shares product content and demo trip data across app boundaries", async () => {
  const [howItWorksPage, featureStory, productPrinciplesPage, tripContent] = await Promise.all([
    readFile(new URL("../app/how-it-works/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/FeatureStory.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ProductPrinciples.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../trip/src/final/tripContent.js", import.meta.url), "utf8"),
  ]);

  assert.equal(planningFlowSteps.length, 5);
  assert.equal(planningFlowSteps[0].title, "Create");
  assert.equal(planningFlowSteps[4].title, "Adapt");
  assert.equal(productPrinciples.length, 4);
  assert.equal(demoTrip.id, "chicago-birthday");
  assert.equal(demoTripMembers.length, demoTrip.people);
  assert.equal(demoInitialDays.length, 3);

  assert.match(howItWorksPage, /tripsync-product-content\.js/);
  assert.match(featureStory, /tripsync-product-content\.js/);
  assert.match(productPrinciplesPage, /tripsync-product-content\.js/);
  assert.match(tripContent, /tripsync-demo-data\.js/);
});

test("syncTripPreview copies dist output and writes an embed manifest", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "trip-preview-sync-"));
  const sourceRoot = path.join(tempRoot, "trip");
  const sourceDistDir = path.join(sourceRoot, "dist");
  const targetDir = path.join(tempRoot, "frontend", "public", "trip-app");

  await mkdir(sourceDistDir, { recursive: true });
  await writeFile(
    path.join(sourceRoot, "package.json"),
    JSON.stringify({ name: "tripsync", version: "9.9.9" }),
    "utf8",
  );
  await writeFile(path.join(sourceDistDir, "index.html"), "<html>preview</html>\n", "utf8");
  await writeFile(path.join(sourceDistDir, "asset.js"), "console.log('trip');\n", "utf8");

  const manifest = await syncTripPreview({ sourceRoot, sourceDistDir, targetDir });
  const copiedHtml = await readFile(path.join(targetDir, "index.html"), "utf8");
  const copiedManifest = JSON.parse(
    await readFile(path.join(targetDir, "embed-manifest.json"), "utf8"),
  );

  assert.equal(copiedHtml, "<html>preview</html>\n");
  assert.equal(manifest.sourceApp, "tripsync");
  assert.equal(manifest.sourceVersion, "9.9.9");
  assert.equal(manifest.frameSrc, buildTripPreviewFrameSrc());
  assert.deepEqual(copiedManifest.files, ["asset.js", "index.html"]);
  assert.equal(copiedManifest.sourceVersion, "9.9.9");
});
