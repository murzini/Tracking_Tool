import { test, expect, Page } from "@playwright/test";

// ─── M6.1 — Heatmap Simulation Mode ──────────────────────────────────────────
// Test 57: GET /simulate returns session count.
// Test 58: POST and DELETE /simulate require auth.
// Test 59: Generate writes only to the sim schema (isolation).
// Test 60: Discard wipes sim data only; real data intact.
// Test 61: Viewer renders sim data with source=sim; real heatmap unaffected.
// Test 62: Generated distribution is approximately correct (count + outcome mix).
// Test 63: Dashboard Simulation section — Generate / View Simulation / Discard.
//
// Pre-requisite: db-setup.mjs must have been run once to create the sim schemas
// (heatmap_sim + heatmap_test_sim). The suite runs against heatmap_test_sim.

const TOKEN = "dashboard-link";
const DASHBOARD_URL = `/dashboard?token=${TOKEN}`;

type SimSession = {
  outcome?: string | null;
};

async function discardSim(page: Page) {
  await page.request.delete("/api/checkout-heatmap/simulate", {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
}

async function generateSim(page: Page) {
  const res = await page.request.post("/api/checkout-heatmap/simulate", {
    headers: { Authorization: `Bearer ${TOKEN}` },
    timeout: 60_000,
  });
  expect(res.ok(), `generate failed: ${res.status()}`).toBeTruthy();
  return (await res.json()) as { count: number };
}

async function getSimCount(page: Page): Promise<number> {
  const res = await page.request.get("/api/checkout-heatmap/simulate");
  expect(res.ok()).toBeTruthy();
  const d = await res.json();
  return typeof d.count === "number" ? d.count : 0;
}

async function getRealSessions(page: Page): Promise<SimSession[]> {
  const res = await page.request.get("/api/checkout-heatmap");
  const d = await res.json();
  return (d.sessions ?? []) as SimSession[];
}

async function seedRealSession(page: Page) {
  const session = {
    id: `sim-test-real-${Date.now()}`,
    step: "personal-info",
    view: "desktop_view",
    outcome: "abandoned",
    samplingRate: 1,
    events: [],
  };
  const res = await page.request.post("/api/checkout-heatmap", { data: { session } });
  expect(res.ok()).toBeTruthy();
}

// Start each test with an empty sim schema.
test.beforeEach(async ({ page }) => {
  await discardSim(page);
});

// ─── Test 57 — GET /simulate returns session count ────────────────────────────
test("Test 57 — GET /simulate returns session count", async ({ page }) => {
  // No sim data → count must be 0.
  const countBefore = await getSimCount(page);
  expect(countBefore, "no sim data → count 0").toBe(0);

  // Generate → count must be > 1000.
  await generateSim(page);
  const countAfter = await getSimCount(page);
  expect(countAfter, "after generate → count > 1000").toBeGreaterThan(1000);

  console.log(`  GET /simulate: 0 → ${countAfter} ✓`);
});

// ─── Test 58 — POST and DELETE /simulate require auth ────────────────────────
test("Test 58 — POST and DELETE /simulate require auth", async ({ page }) => {
  // POST — no auth
  const postNoAuth = await page.request.post("/api/checkout-heatmap/simulate");
  expect(postNoAuth.status(), "POST no auth → 401").toBe(401);

  // POST — wrong token
  const postWrong = await page.request.post("/api/checkout-heatmap/simulate", {
    headers: { Authorization: "Bearer wrong-token" },
  });
  expect(postWrong.status(), "POST wrong token → 401").toBe(401);

  // DELETE — no auth
  const delNoAuth = await page.request.delete("/api/checkout-heatmap/simulate");
  expect(delNoAuth.status(), "DELETE no auth → 401").toBe(401);

  // DELETE — wrong token
  const delWrong = await page.request.delete("/api/checkout-heatmap/simulate", {
    headers: { Authorization: "Bearer wrong-token" },
  });
  expect(delWrong.status(), "DELETE wrong token → 401").toBe(401);

  console.log("  POST/DELETE auth gate: no-auth/wrong-token → 401 ✓");
});

// ─── Test 59 — Generate writes only to sim schema (isolation) ────────────────
test("Test 59 — Generate writes only to the sim schema", async ({ page }) => {
  // Start with clean real data.
  await page.request.delete("/api/checkout-heatmap");

  // Seed exactly 1 real session.
  await seedRealSession(page);
  const realBefore = await getRealSessions(page);
  expect(realBefore.length, "1 real session seeded").toBe(1);

  // Generate sim sessions.
  await generateSim(page);
  const simCount = await getSimCount(page);
  expect(simCount, "sim count > 1000 after generate").toBeGreaterThan(1000);

  // Real data must be untouched.
  const realAfter = await getRealSessions(page);
  expect(realAfter.length, "real sessions unchanged after generate").toBe(1);

  console.log(`  Generate isolation: real count unchanged at ${realAfter.length}, sim count ${simCount} ✓`);
});

// ─── Test 60 — Discard wipes sim data only; real data intact ─────────────────
test("Test 60 — Discard wipes sim data only; real data intact", async ({ page }) => {
  // Start with clean real data.
  await page.request.delete("/api/checkout-heatmap");

  // Generate sim sessions.
  await generateSim(page);
  const simBefore = await getSimCount(page);
  expect(simBefore, "sim sessions exist before discard").toBeGreaterThan(0);

  // Seed a real session.
  await seedRealSession(page);

  // Discard sim.
  const del = await page.request.delete("/api/checkout-heatmap/simulate", {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  expect(del.ok(), "DELETE /simulate ok").toBeTruthy();

  // Sim must be empty; real must be intact.
  const simAfter = await getSimCount(page);
  expect(simAfter, "sim count 0 after discard").toBe(0);

  const realAfter = await getRealSessions(page);
  expect(realAfter.length, "real session still present after discard").toBe(1);

  console.log("  Discard isolation: sim wiped, real untouched ✓");
});

// ─── Test 61 — Viewer renders sim data with source=sim; real unaffected ───────
test("Test 61 — Viewer renders sim data with source=sim; real heatmap unaffected", async ({ page }) => {
  test.setTimeout(120_000);

  // Start with no real data.
  await page.request.delete("/api/checkout-heatmap");

  // Generate sim sessions.
  await generateSim(page);

  // Warm the query route so the viewer's useEffect fetch hits a warm Neon connection.
  await page.request.get("/api/checkout-heatmap?source=sim", { timeout: 60_000 });

  // Open viewer with source=sim — session count must be > 1000.
  await page.goto("/checkout/001/heatmap?step=personal-info&view=desktop_view&source=sim");
  await page.waitForLoadState("networkidle");

  const simCountEl = page.locator("[data-heatmap-session-count]");
  // Wait for the sessions fetch (triggered by useEffect after mount) to populate the count.
  await expect(simCountEl, "viewer shows sim sessions").not.toHaveText("0", { timeout: 60_000 });
  const simCountText = await simCountEl.textContent();
  const simCount = parseInt(simCountText ?? "0", 10);
  expect(simCount, "viewer shows sim sessions (desktop_view ~60% of total)").toBeGreaterThan(500);

  await page.screenshot({
    path: "test-results/M6.1 Test 61 - Viewer sim source/Check evidence/viewer-sim.png",
    fullPage: false,
  });

  // Open viewer without source — must show 0 sessions (no real data).
  await page.goto("/checkout/001/heatmap?step=personal-info&view=desktop_view");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("[data-heatmap-session-count]")).toHaveText("0", { timeout: 15_000 });

  await page.screenshot({
    path: "test-results/M6.1 Test 61 - Viewer sim source/Check evidence/viewer-real-empty.png",
    fullPage: false,
  });

  console.log(`  Viewer sim source: ${simCount} sim sessions rendered; real shows 0 ✓`);
});

// ─── Test 62 — Generated distribution is approximately correct ────────────────
test("Test 62 — Generated distribution is approximately correct", async ({ page }) => {
  test.setTimeout(120_000);

  // Clear any sim data left by a previous test before generating a fresh batch.
  await discardSim(page);
  const { count: total } = await generateSim(page);

  // Total count must be in the expected range.
  expect(total, "total sessions in range 1400–1600").toBeGreaterThanOrEqual(1400);
  expect(total, "total sessions in range 1400–1600").toBeLessThanOrEqual(1600);

  // Fetch all sessions to check outcome distribution.
  const res = await page.request.get("/api/checkout-heatmap?source=sim", { timeout: 60_000 });
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  const sessions: SimSession[] = data.sessions ?? [];

  const abandonedCount = sessions.filter((s) => s.outcome === "abandoned").length;
  const completedCount = sessions.filter((s) => s.outcome === "completed").length;
  const abandonedRatio = abandonedCount / sessions.length;
  const completedRatio = completedCount / sessions.length;

  // Check both views represented.
  const anyDesktop = sessions.some((s: any) => s.view === "desktop_view");
  const anyMobile = sessions.some((s: any) => s.view === "mobile_view");

  console.log(`  total: ${sessions.length}, abandoned: ${abandonedCount} (${(abandonedRatio * 100).toFixed(1)}%), completed: ${completedCount} (${(completedRatio * 100).toFixed(1)}%)`);

  expect(sessions.length, "session count in range 1400–1600").toBeGreaterThanOrEqual(1400);
  expect(sessions.length, "session count in range 1400–1600").toBeLessThanOrEqual(1600);
  expect(abandonedRatio, "abandoned ≥50%").toBeGreaterThanOrEqual(0.50);
  expect(abandonedRatio, "abandoned ≤80%").toBeLessThanOrEqual(0.80);
  expect(completedRatio, "completed ≥20%").toBeGreaterThanOrEqual(0.20);
  expect(completedRatio, "completed ≤50%").toBeLessThanOrEqual(0.50);
  expect(anyDesktop, "at least one desktop_view session").toBeTruthy();
  expect(anyMobile, "at least one mobile_view session").toBeTruthy();

  console.log("  distribution check: outcome mix and views within tolerance ✓");
});

// ─── Test 63 — Dashboard Simulation section: Generate / View Sim / Discard ────
test("Test 63 — Dashboard Simulation section: Generate, View Simulation, Discard", async ({ page, context }) => {
  test.setTimeout(120_000);

  // Clear any real sessions left over from Tests 59/60 so the count starts at 0.
  await page.request.delete("/api/checkout-heatmap");

  // Navigate to dashboard.
  await page.goto(DASHBOARD_URL);
  await page.waitForLoadState("networkidle");

  // Simulation section must be visible.
  const simSection = page.locator("[data-dashboard-section=\"simulation\"]");
  await expect(simSection, "Simulation section visible").toBeVisible();

  // Status shows "No simulation data" initially.
  await expect(page.locator("[data-dashboard-sim-status]"), "initial status: no data")
    .toContainText("No simulation data");

  // "Heatmap simulation" button label (renamed from "Generate").
  await expect(page.locator("[data-dashboard-sim-generate]"), "button label is 'Heatmap simulation'")
    .toContainText("Heatmap simulation");

  // "Report simulation" button must be present and disabled when no sim data.
  const reportSimBtn = page.locator("[data-dashboard-sim-report]");
  await expect(reportSimBtn, "Report simulation button visible").toBeVisible();
  await expect(reportSimBtn, "Report simulation button disabled when no sim data").toBeDisabled();

  // Click "Heatmap simulation" — wait for status to update to a non-zero count.
  await page.locator("[data-dashboard-sim-generate]").click();
  await expect(page.locator("[data-dashboard-sim-status]"), "status shows count after generate")
    .not.toContainText("No simulation data", { timeout: 60_000 });
  await expect(page.locator("[data-dashboard-sim-status]"), "status shows sessions")
    .toContainText("simulated sessions ready", { timeout: 60_000 });

  // "Report simulation" button must be enabled after data is generated.
  await expect(reportSimBtn, "Report simulation button enabled after generate").toBeEnabled({ timeout: 5_000 });

  await page.screenshot({
    path: "test-results/M6.1 Test 63 - Dashboard Simulation section/Check evidence/dashboard-sim.png",
    fullPage: false,
  });

  // Note: "View Simulation" button was removed in M7 (replaced by "Report simulation").
  // Discard flow is tested below.

  // Click Discard — confirm overlay appears.
  await page.locator("[data-dashboard-sim-discard]").click();
  await expect(page.locator("[data-dashboard-sim-confirm-overlay]"), "confirm overlay appears").toBeVisible();

  // Confirm discard.
  await page.locator("[data-dashboard-sim-confirm-discard]").click();
  await expect(page.locator("[data-dashboard-sim-confirm-overlay]"), "overlay closes after confirm")
    .not.toBeVisible({ timeout: 10_000 });

  // Status shows "No simulation data" after discard.
  await expect(page.locator("[data-dashboard-sim-status]"), "status: no data after discard")
    .toContainText("No simulation data", { timeout: 10_000 });

  // Real sessions are untouched (no real data was seeded).
  const real = await getRealSessions(page);
  expect(real.length, "real sessions untouched").toBe(0);

  console.log("  Discard confirm → sim cleared, status reset ✓");
});
