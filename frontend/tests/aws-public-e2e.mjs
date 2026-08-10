import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const baseUrl = (process.env.TRIPSYNC_PUBLIC_URL ?? "").replace(/\/+$/, "");
const screenshotDir = process.env.TRIPSYNC_E2E_ARTIFACT_DIR ?? "test-results/aws-public-e2e";

if (!baseUrl) {
  console.error("TRIPSYNC_PUBLIC_URL is required.");
  process.exit(1);
}

async function expectOkResponse(page, urlPath) {
  const response = await page.goto(`${baseUrl}${urlPath}`, { waitUntil: "domcontentloaded" });
  assert(response, `No response for ${urlPath}`);
  assert(
    response.ok(),
    `Expected ${urlPath} to return 2xx/3xx, received ${response.status()}`,
  );
  return response;
}

async function main() {
  await mkdir(screenshotDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

  const consoleErrors = [];
  const failedRequests = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  page.on("requestfailed", (request) => {
    const url = request.url();
    if (!url.startsWith(baseUrl)) return;
    failedRequests.push(`${request.method()} ${url}: ${request.failure()?.errorText ?? "failed"}`);
  });

  await expectOkResponse(page, "/");
  await assert.match(await page.title(), /CADENSY/i);
  await page.getByRole("link", { name: /log in/i }).first().waitFor({ timeout: 10_000 });
  await page.getByText(/READY TO PLAN TOGETHER/i).waitFor({ timeout: 10_000 });
  await page.screenshot({ path: path.join(screenshotDir, "home.png"), fullPage: true });

  await expectOkResponse(page, "/login");
  await page.getByRole("heading", { name: /welcome back/i }).waitFor({ timeout: 10_000 });
  await page.getByLabel(/email address/i).waitFor({ timeout: 10_000 });
  await page.screenshot({ path: path.join(screenshotDir, "login.png"), fullPage: true });

  await expectOkResponse(page, "/trip");
  const iframeElement = page.locator("iframe.trip-preview-frame");
  await iframeElement.waitFor({ timeout: 20_000 });
  const iframeSrc = await iframeElement.getAttribute("src");
  assert.equal(iframeSrc, "/trip-app/index.html#/");
  await expectOkResponse(page, "/trip-app/index.html");

  await expectOkResponse(page, "/trip-app/index.html#/");
  await page.getByText(/TripSync/i).first().waitFor({ timeout: 20_000 });
  await page.screenshot({ path: path.join(screenshotDir, "trip.png"), fullPage: true });

  const healthResponse = await page.request.get(`${baseUrl}/api/health`);
  assert.equal(healthResponse.status(), 200);
  assert.deepEqual(await healthResponse.json(), { ok: true });

  assert.deepEqual(failedRequests, [], `Failed same-origin requests:\n${failedRequests.join("\n")}`);

  const blockingConsoleErrors = consoleErrors.filter((message) => {
    const normalized = message.toLowerCase();
    return !normalized.includes("favicon") && !normalized.includes("manifest");
  });
  assert.deepEqual(
    blockingConsoleErrors,
    [],
    `Browser console errors:\n${blockingConsoleErrors.join("\n")}`,
  );

  await browser.close();

  console.log(`AWS public E2E passed for ${baseUrl}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
