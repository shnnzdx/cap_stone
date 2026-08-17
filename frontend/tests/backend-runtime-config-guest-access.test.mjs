import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");

async function workflowText(...segments) {
  return readFile(path.join(repoRoot, ...segments), "utf8");
}

test("cloud backend runtime workflows keep guest membership-header access enabled", async () => {
  const [aiRuntime, phase7Runtime, phase10Https] = await Promise.all([
    workflowText(".github", "workflows", "backend-ai-runtime-config.yml"),
    workflowText(".github", "workflows", "phase7-backend-runtime-config.yml"),
    workflowText(".github", "workflows", "phase10-https-custom-domain.yml"),
  ]);

  assert.match(aiRuntime, /DEV_ALLOW_MEMBERSHIP_HEADER="1"/);
  assert.match(phase7Runtime, /"DEV_ALLOW_MEMBERSHIP_HEADER", "value": "1"/);
  assert.match(phase10Https, /"DEV_ALLOW_MEMBERSHIP_HEADER", "value": "1"/);
});
