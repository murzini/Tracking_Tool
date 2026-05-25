import { test, expect, Page } from "@playwright/test";

// ─── M3 Part 3 — store fields + query API ────────────────────────────────────
// Tests 20-22: outcome/samplingRate fields on stored sessions.
// Tests 23-26: read-only query endpoint GET /api/checkout-heatmap/query with
//              step / view / timeframe filters, individually and combined.

const INACTIVITY_MS = 2000;
const MOBILE_VIEWPORT = { width: 375, height: 812 };

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

async function navigateToPersonalInfo(page: Page) {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /shop backpacks/i }).first().click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /open details for adventurebag 001/i }).click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /add to cart/i }).click();
  await page.waitForLoadState("networkidle");
  await page.locator('input[placeholder="Your name"]').waitFor({ state: "visible", timeout: 20000 });

  const url = page.url();
  const sep = url.includes("?") ? "&" : "?";
  await page.goto(`${url}${sep}m1HeatmapTest=1`);
  await page.waitForLoadState("networkidle");
  await page.locator('input[placeholder="Your name"]').waitFor({ state: "visible", timeout: 20000 });
}

async function navigateToCheckout(page: Page) {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /shop backpacks/i }).first().click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /open details for adventurebag 001/i }).click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /add to cart/i }).click();
  await page.waitForLoadState("networkidle");
  await page.locator('input[placeholder="Your name"]').waitFor({ state: "visible", timeout: 20000 });
}

// Navigate DIRECTLY to the target step (the catalog item resolves from the sku).
// Funnelling to personal-info first and then jumping would leave an untouched
// pass-through page that — since M4 Part 5 — is recorded as a zero-interaction
// bounce, inflating the seeded session count.
async function gotoStep(page: Page, step: "delivery" | "pay", sentinelId: string) {
  await page.goto(`/checkout/001?step=${step}&m1HeatmapTest=1`);
  await page.waitForURL(new RegExp(`step=${step}`), { timeout: 10000 });
  await page.locator(`[data-heatmap-id="${sentinelId}"]`).waitFor({ state: "visible", timeout: 10000 });
}

type Session = {
  step?: string;
  view?: string;
  outcome?: string;
  samplingRate?: number;
  startedAt?: string;
  events?: Array<{ type?: string; anchor?: { id?: string; type?: string } }>;
};

async function getStoredSessions(page: Page): Promise<Session[]> {
  const res = await page.request.get("/api/checkout-heatmap");
  const data = await res.json();
  return (data.sessions ?? []) as Session[];
}

async function querySessions(page: Page, params: Record<string, string>): Promise<Session[]> {
  const qs = new URLSearchParams(params).toString();
  const res = await page.request.get(`/api/checkout-heatmap/query?${qs}`);
  const data = await res.json();
  return (data.sessions ?? []) as Session[];
}

// ─── Test 20 — click is stored as an event with type:"click" ─────────────────

test("Test 20 — click is stored as an event with type:click and the correct anchor", async ({ page }) => {
  await clearHeatmapData(page);
  await navigateToPersonalInfo(page);

  await page.locator('[data-heatmap-id="text:name"]').click();
  await page.waitForTimeout(INACTIVITY_MS + 500);
  await flushActiveHeatmapSession(page);

  const sessions = await getStoredSessions(page);
  expect(sessions.length, "one session must be stored").toBe(1);
  expect(Array.isArray(sessions[0].events), "session must expose events[]").toBeTruthy();

  // M4 Part 4: the same element now also carries field events (focus/blur) — filter
  // by type to find the click rather than assuming a click-only event list.
  const ev = sessions[0].events?.find((e) => e.anchor?.id === "text:name" && (e.type === "click" || e.type === "tap"));
  expect(ev, "the clicked element must be stored as a click event").toBeTruthy();
  expect(ev?.type, "click event must have type:click").toBe("click");
});

// ─── Test 21 — drop-off session is tagged outcome:abandoned ──────────────────

test("Test 21 — inactivity-finalized session has outcome:abandoned", async ({ page }) => {
  await clearHeatmapData(page);
  await navigateToPersonalInfo(page);

  await page.locator('[data-heatmap-id="text:name"]').click();
  await page.waitForTimeout(INACTIVITY_MS + 500);
  await flushActiveHeatmapSession(page);

  const sessions = await getStoredSessions(page);
  expect(sessions.length, "one session must be stored").toBe(1);
  expect(sessions[0].outcome, "drop-off session must be tagged outcome:abandoned").toBe("abandoned");
});

// ─── Test 22 — session carries a numeric samplingRate field ──────────────────

test("Test 22 — stored session has a numeric samplingRate field", async ({ page }) => {
  await clearHeatmapData(page);
  await navigateToPersonalInfo(page);

  await page.locator('[data-heatmap-id="text:name"]').click();
  await page.waitForTimeout(INACTIVITY_MS + 500);
  await flushActiveHeatmapSession(page);

  const sessions = await getStoredSessions(page);
  expect(sessions.length, "one session must be stored").toBe(1);
  expect(typeof sessions[0].samplingRate, "samplingRate must be a number").toBe("number");
  expect(Number.isFinite(sessions[0].samplingRate), "samplingRate must be finite").toBeTruthy();
});

// ─── Test 23 — query API filters by step ─────────────────────────────────────

test("Test 23 — query API returns only sessions for the requested step", async ({ page }) => {
  await clearHeatmapData(page);

  // Seed personal-info session.
  await navigateToPersonalInfo(page);
  await page.locator('[data-heatmap-id="text:name"]').click();
  await page.waitForTimeout(INACTIVITY_MS + 500);
  await flushActiveHeatmapSession(page);

  // Seed delivery session (direct nav; the personal-info page above is already
  // finalized, so navigating away from it does not create a bounce).
  await gotoStep(page, "delivery", "radio:delivery-novaposhta");
  await page.locator('[data-heatmap-id="radio:delivery-pickup"]').click();
  await page.waitForTimeout(INACTIVITY_MS + 500);
  await flushActiveHeatmapSession(page);

  const all = await getStoredSessions(page);
  expect(all.length, "two sessions must be stored").toBe(2);

  const piOnly = await querySessions(page, { step: "personal-info" });
  expect(piOnly.length, "step filter must return at least one session").toBeGreaterThan(0);
  expect(
    piOnly.every((s) => s.step === "personal-info"),
    "all returned sessions must be personal-info"
  ).toBeTruthy();

  const deliveryOnly = await querySessions(page, { step: "delivery" });
  expect(deliveryOnly.length, "delivery filter must return at least one session").toBeGreaterThan(0);
  expect(
    deliveryOnly.every((s) => s.step === "delivery"),
    "all returned sessions must be delivery"
  ).toBeTruthy();
  console.log(`  step filter: ${piOnly.length} personal-info, ${deliveryOnly.length} delivery`);
});

// ─── Test 24 — query API filters by view ─────────────────────────────────────

test("Test 24 — query API returns only sessions for the requested view", async ({ page }) => {
  await clearHeatmapData(page);

  // Seed desktop session with default (wide) viewport.
  await navigateToPersonalInfo(page);
  await page.locator('[data-heatmap-id="text:name"]').click();
  await page.waitForTimeout(INACTIVITY_MS + 500);
  await flushActiveHeatmapSession(page);

  // Seed mobile session by resizing the viewport before navigating.
  await page.setViewportSize(MOBILE_VIEWPORT);
  await navigateToPersonalInfo(page);
  await page.locator('[data-heatmap-id="text:name"]').click();
  await page.waitForTimeout(INACTIVITY_MS + 500);
  await flushActiveHeatmapSession(page);

  const all = await getStoredSessions(page);
  expect(all.length, "two sessions must be stored").toBe(2);

  const desktopOnly = await querySessions(page, { view: "desktop_view" });
  expect(desktopOnly.length, "desktop filter must return at least one session").toBeGreaterThan(0);
  expect(
    desktopOnly.every((s) => s.view === "desktop_view"),
    "all returned sessions must be desktop_view"
  ).toBeTruthy();

  const mobileOnly = await querySessions(page, { view: "mobile_view" });
  expect(mobileOnly.length, "mobile filter must return at least one session").toBeGreaterThan(0);
  expect(
    mobileOnly.every((s) => s.view === "mobile_view"),
    "all returned sessions must be mobile_view"
  ).toBeTruthy();
  console.log(`  view filter: ${desktopOnly.length} desktop, ${mobileOnly.length} mobile`);
});

// ─── Test 25 — query API filters by timeframe ────────────────────────────────

test("Test 25 — query API returns sessions inside the timeframe and excludes those outside", async ({ page }) => {
  await clearHeatmapData(page);

  const beforeSeed = new Date(Date.now() - 60_000).toISOString(); // 1 min before
  await navigateToPersonalInfo(page);
  await page.locator('[data-heatmap-id="text:name"]').click();
  await page.waitForTimeout(INACTIVITY_MS + 500);
  await flushActiveHeatmapSession(page);
  const afterSeed = new Date(Date.now() + 60_000).toISOString(); // 1 min after

  const inRange = await querySessions(page, { from: beforeSeed, to: afterSeed });
  expect(inRange.length, "session inside timeframe must be returned").toBeGreaterThan(0);

  const futureFrom = new Date(Date.now() + 3_600_000).toISOString(); // 1 hour in future
  const outOfRange = await querySessions(page, { from: futureFrom });
  expect(outOfRange.length, "no sessions should be returned for a future timeframe").toBe(0);
  console.log(`  timeframe: ${inRange.length} in range, ${outOfRange.length} out of range`);
});

// ─── Test 27 — TTL / archival ────────────────────────────────────────────────

test("Test 27 — cleanup deletes sessions before the cutoff and keeps recent ones", async ({ page }) => {
  await clearHeatmapData(page);

  // Seed session A — will be the "old" session.
  await navigateToPersonalInfo(page);
  await page.locator('[data-heatmap-id="text:name"]').click();
  await page.waitForTimeout(INACTIVITY_MS + 500);
  await flushActiveHeatmapSession(page);

  // Cutoff captured after A is in the DB; B will be inserted after this point.
  const cutoff = new Date().toISOString();

  // Seed session B — will be the "recent" session.
  await navigateToPersonalInfo(page);
  await page.locator('[data-heatmap-id="text:name"]').click();
  await page.waitForTimeout(INACTIVITY_MS + 500);
  await flushActiveHeatmapSession(page);

  const beforeCleanup = await getStoredSessions(page);
  expect(beforeCleanup.length, "two sessions must exist before cleanup").toBe(2);

  // Run cleanup with cutoff between A and B — removes A, keeps B.
  const res = await page.request.post("/api/checkout-heatmap/cleanup", {
    data: { before: cutoff },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.ok).toBeTruthy();
  expect(body.deleted, "cleanup must report 1 deleted session").toBe(1);

  // Verify only B remains via both the main store and the query API.
  const afterMain = await getStoredSessions(page);
  expect(afterMain.length, "only the recent session must remain").toBe(1);

  const afterQuery = await querySessions(page, {});
  expect(afterQuery.length, "query API must also reflect 1 remaining session").toBe(1);

  console.log(`  TTL archival: ${body.deleted} deleted, ${afterMain.length} remaining`);
});

// ─── Test 26 — query API combines step + view + timeframe ────────────────────

test("Test 26 — query API returns only the session matching all combined filters", async ({ page }) => {
  await clearHeatmapData(page);

  const fromTs = new Date(Date.now() - 60_000).toISOString();

  // Session A: personal-info, desktop.
  await navigateToPersonalInfo(page);
  await page.locator('[data-heatmap-id="text:name"]').click();
  await page.waitForTimeout(INACTIVITY_MS + 500);
  await flushActiveHeatmapSession(page);

  // Session B: delivery, desktop (direct nav; session A's page is already
  // finalized, so leaving it creates no bounce).
  await gotoStep(page, "delivery", "radio:delivery-novaposhta");
  await page.locator('[data-heatmap-id="radio:delivery-pickup"]').click();
  await page.waitForTimeout(INACTIVITY_MS + 500);
  await flushActiveHeatmapSession(page);

  const toTs = new Date(Date.now() + 60_000).toISOString();

  const combined = await querySessions(page, {
    step: "personal-info",
    view: "desktop_view",
    from: fromTs,
    to: toTs,
  });

  expect(combined.length, "combined filter must return exactly one session").toBe(1);
  expect(combined[0].step).toBe("personal-info");
  expect(combined[0].view).toBe("desktop_view");
  console.log(`  combined filter: ${combined.length} session(s)`);
});
