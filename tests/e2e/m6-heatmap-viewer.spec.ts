import { test, expect, Page } from "@playwright/test";

// ─── M6 Part 5 — Heatmap viewer outcome filter + timeframe ───────────────────
// Test 55: outcome=drop-offs shows only abandoned sessions;
//          outcome=completers shows only completed sessions;
//          no outcome param shows all sessions.
// Test 56: from/to outside the captured data range → 0 sessions (no-data state).

async function clearSessions(page: Page) {
  const res = await page.request.delete("/api/checkout-heatmap");
  expect(res.ok()).toBeTruthy();
}

async function seedSession(page: Page, outcome: string, id: string) {
  const session = {
    id,
    step: "personal-info",
    view: "desktop_view",
    outcome,
    samplingRate: 1,
    events: [],
  };
  const res = await page.request.post("/api/checkout-heatmap", { data: { session } });
  expect(res.ok(), `seedSession(${outcome}) failed: ${res.status()}`).toBeTruthy();
}

// Wait until the heatmap stats element contains a stable session count (not still loading).
async function waitForSessionCount(page: Page, expected: number) {
  await expect(page.locator("[data-heatmap-session-count]")).toHaveText(String(expected), { timeout: 8000 });
}

// ─── Test 55 — Viewer outcome filter ─────────────────────────────────────────
test("Test 55 — Viewer outcome filter: drop-offs, completers, all", async ({ page }) => {
  await clearSessions(page);
  await seedSession(page, "abandoned", `t55-abandoned-${Date.now()}`);
  await seedSession(page, "completed", `t55-completed-${Date.now() + 1}`);

  // ── drop-offs only → 1 session ────────────────────────────────────────────
  await page.goto("/checkout/001/heatmap?step=personal-info&view=desktop_view&outcome=drop-offs");
  await page.waitForLoadState("networkidle");
  await waitForSessionCount(page, 1);
  console.log("  outcome=drop-offs → 1 session ✓");

  // ── completers only → 1 session ───────────────────────────────────────────
  await page.goto("/checkout/001/heatmap?step=personal-info&view=desktop_view&outcome=completers");
  await page.waitForLoadState("networkidle");
  await waitForSessionCount(page, 1);
  console.log("  outcome=completers → 1 session ✓");

  // ── all (no outcome param) → 2 sessions ──────────────────────────────────
  await page.goto("/checkout/001/heatmap?step=personal-info&view=desktop_view");
  await page.waitForLoadState("networkidle");
  await waitForSessionCount(page, 2);
  console.log("  no outcome param → 2 sessions ✓");

  await page.screenshot({
    path: "test-results/Test 55 - Viewer outcome filter/Check evidence/outcome-all.png",
    fullPage: false,
  });
});

// ─── Test 56 — Viewer timeframe filter: out-of-range → no data ───────────────
test("Test 56 — Viewer timeframe: out-of-range from/to shows 0 sessions", async ({ page }) => {
  await clearSessions(page);
  await seedSession(page, "abandoned", `t56-now-${Date.now()}`);

  // Current date is 2026 — a from/to in year 2000 excludes all current sessions.
  await page.goto(
    "/checkout/001/heatmap?step=personal-info&view=desktop_view&from=2000-01-01&to=2000-01-02"
  );
  await page.waitForLoadState("networkidle");
  await waitForSessionCount(page, 0);
  console.log("  out-of-range timeframe → 0 sessions ✓");

  // Confirm same session IS visible without the timeframe filter.
  await page.goto("/checkout/001/heatmap?step=personal-info&view=desktop_view");
  await page.waitForLoadState("networkidle");
  await waitForSessionCount(page, 1);
  console.log("  no timeframe filter → 1 session visible ✓");

  await page.screenshot({
    path: "test-results/Test 56 - Viewer timeframe filter/Check evidence/no-data.png",
    fullPage: false,
  });
});
