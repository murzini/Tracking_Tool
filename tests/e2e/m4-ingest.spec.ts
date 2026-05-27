import { test, expect, Page, Request } from "@playwright/test";

// ─── M4 Part 2 — batched ingestion pipe + sampling gate ──────────────────────
// Test 29: clicks are delivered via the batched /ingest endpoint (not the legacy
//          finalize POST), and buffered events survive a tab close (sendBeacon).
// Test 30: the per-session sampling gate works both ways — at 100% the session is
//          recorded; at 0% nothing is recorded.

const INACTIVITY_MS = 2000;
const INGEST_PATH = "/api/checkout-heatmap/ingest";
const LEGACY_PATH = "/api/checkout-heatmap";

async function clearHeatmapData(page: Page) {
  const res = await page.request.delete("/api/checkout-heatmap");
  expect(res.ok()).toBeTruthy();
}

async function waitForSessionFinalized(page: Page, timeoutMs = 10000) {
  await page.waitForFunction(
    () => !window.sessionStorage.getItem("m1.checkoutHeatmap.activeSession"),
    undefined,
    { timeout: timeoutMs }
  );
}

async function flushActiveHeatmapSession(page: Page) {
  await page.evaluate(async () => {
    const flush = (window as Window & { __m1CheckoutHeatmapFlush?: () => Promise<boolean> }).__m1CheckoutHeatmapFlush;
    if (typeof flush === "function") {
      await flush();
      return;
    }
    window.dispatchEvent(new Event("m1:checkout-heatmap-flush"));
  });
  await waitForSessionFinalized(page);
}

// Navigate the full visitor path to personal-info, then re-enter with the given
// extra query params so the capture client reads them from the URL.
async function navigateToPersonalInfo(page: Page, extraParams = "m1HeatmapTest=1") {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /shop backpacks/i }).first().click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /open details for adventurebag 001/i }).click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /add to cart/i }).click();
  await page.waitForLoadState("networkidle");
  // M5: funnel lands on the login step.
  await page.locator("#login_name").waitFor({ state: "visible", timeout: 20000 });

  const url = page.url();
  const sep = url.includes("?") ? "&" : "?";
  await page.goto(`${url}${sep}${extraParams}`);
  await page.waitForLoadState("networkidle");
  await page.locator("#login_name").waitFor({ state: "visible", timeout: 20000 });

  // Complete the login step; the app carries extraParams through to personal-info.
  await page.locator("#login_name").fill("Test");
  await page.getByRole("button", { name: /continue/i }).click();
  await page.waitForURL(/step=personal-info/, { timeout: 10000 });
  await page.locator('input[placeholder="Your name"]').waitFor({ state: "visible", timeout: 20000 });
}

type Session = {
  step?: string;
  view?: string;
  outcome?: string;
  samplingRate?: number;
  events?: Array<{ type?: string; anchor?: { id?: string; type?: string } }>;
};

async function getStoredSessions(page: Page): Promise<Session[]> {
  const res = await page.request.get("/api/checkout-heatmap");
  const data = await res.json();
  return (data.sessions ?? []) as Session[];
}

function pathOf(request: Request): string {
  return new URL(request.url()).pathname;
}

// ─── Test 29 — batched ingestion delivery ────────────────────────────────────

test("Test 29 — clicks are delivered via the batched ingest endpoint, not the legacy POST", async ({ page }) => {
  const ingestPosts: Request[] = [];
  const legacyPosts: Request[] = [];
  page.on("request", (request) => {
    if (request.method() !== "POST") return;
    const path = pathOf(request);
    if (path === INGEST_PATH) ingestPosts.push(request);
    else if (path === LEGACY_PATH) legacyPosts.push(request);
  });

  await clearHeatmapData(page);
  await navigateToPersonalInfo(page);

  await page.locator('[data-heatmap-id="text:name"]').click();
  await page.locator('[data-heatmap-id="text:zip"]').click();
  await page.waitForTimeout(INACTIVITY_MS + 500);
  await flushActiveHeatmapSession(page);

  // Delivery happened through the ingest pipe, carrying a batch of events…
  expect(ingestPosts.length, "at least one ingest request must be sent").toBeGreaterThan(0);
  const lastBody = JSON.parse(ingestPosts[ingestPosts.length - 1].postData() ?? "{}");
  expect(Array.isArray(lastBody.events), "ingest payload must carry an events[] batch").toBeTruthy();
  expect(lastBody.events.length, "the batch must contain the captured clicks").toBeGreaterThan(0);

  // …and the legacy finalize POST is no longer used by the client.
  expect(legacyPosts.length, "client must not call the legacy POST write path").toBe(0);

  // Clicks still land in the store.
  const sessions = await getStoredSessions(page);
  expect(sessions.length, "one session must be stored").toBe(1);
  // M4 Part 4: the clicked field also emits field events — filter by type.
  const nameEvent = sessions[0].events?.find((e) => e.anchor?.id === "text:name" && e.type === "click");
  expect(nameEvent, "the click must be persisted").toBeTruthy();
  expect(nameEvent?.type, "the click must be persisted as a click event").toBe("click");

  console.log(`  ingest: ${ingestPosts.length} POST(s), legacy POST: ${legacyPosts.length}`);
});

test("Test 29 — buffered events survive a tab close via sendBeacon", async ({ page }) => {
  await clearHeatmapData(page);
  await navigateToPersonalInfo(page);

  // Click, then simulate the tab closing BEFORE inactivity finalize runs.
  await page.locator('[data-heatmap-id="text:name"]').click();
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));

  // The unload beacon must deliver the buffered click even though the session was
  // never finalized — poll within the inactivity window so finalize cannot be the
  // source of the delivered data.
  await expect
    .poll(
      async () => {
        const sessions = await getStoredSessions(page);
        return sessions[0]?.events?.some((e) => e.anchor?.id === "text:name") ?? false;
      },
      { timeout: INACTIVITY_MS - 200, intervals: [100, 150, 200] }
    )
    .toBeTruthy();
});

// ─── Test 30 — visitor sampling gate ─────────────────────────────────────────

test("Test 30 — at 100% sampling the session is recorded", async ({ page }) => {
  await clearHeatmapData(page);
  await navigateToPersonalInfo(page); // default rate = 100%

  await page.locator('[data-heatmap-id="text:name"]').click();
  await page.waitForTimeout(INACTIVITY_MS + 500);
  await flushActiveHeatmapSession(page);

  const sessions = await getStoredSessions(page);
  expect(sessions.length, "the sampled visit must be recorded").toBe(1);
  expect(sessions[0].samplingRate, "effective samplingRate must be 1 at 100%").toBe(1);
});

test("Test 30 — at 0% sampling nothing is recorded", async ({ page }) => {
  await clearHeatmapData(page);
  await navigateToPersonalInfo(page, "m1HeatmapTest=1&heatmapSampleRate=0");

  // After M5 the login step creates no capture sessions, so this clear is a
  // no-op; kept so the assertion below is unambiguous regardless of run order.
  await clearHeatmapData(page);

  // Capture is gated off, so there is no active session to flush — clicking and
  // waiting past the inactivity window must leave the store empty.
  await page.locator('[data-heatmap-id="text:name"]').click();
  await page.waitForTimeout(INACTIVITY_MS + 500);

  const sessions = await getStoredSessions(page);
  expect(sessions.length, "an un-sampled visit must not be recorded").toBe(0);
});
