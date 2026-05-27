import { test, expect, Page } from "@playwright/test";

// ─── M6 Parts 2+3 — runtime config store + capture gating ────────────────────
// Test 49: GET /api/checkout-heatmap/config returns defaults with no saved row.
// Test 50: POST saves config (valid token); POST without/wrong token → 401.
// Test 51: Disabling a step in config stops capture on that step.
// Test 52: Disabling the mouse-move event type stops mouse-move capture.
// Test 53: Sampling rate from config — 0% produces no sessions.

const SKU = "001";
const TOKEN = "m6-dev-token";

type Config = {
  steps?: Record<string, boolean>;
  eventTypes?: Record<string, boolean>;
  elementTypes?: Record<string, boolean>;
  samplingRate?: number;
  captureWindow?: { from: string | null; to: string | null };
};

type Session = {
  step?: string;
  outcome?: string | null;
  events?: { type?: string }[];
};

async function clearHeatmapData(page: Page) {
  const res = await page.request.delete("/api/checkout-heatmap");
  expect(res.ok()).toBeTruthy();
}

async function getStoredSessions(page: Page): Promise<Session[]> {
  const res = await page.request.get("/api/checkout-heatmap");
  const data = await res.json();
  return (data.sessions ?? []) as Session[];
}

async function getConfig(page: Page): Promise<Config> {
  const res = await page.request.get("/api/checkout-heatmap/config");
  const data = await res.json();
  return data.config as Config;
}

async function saveConfig(page: Page, config: Config) {
  const res = await page.request.post("/api/checkout-heatmap/config", {
    headers: { Authorization: `Bearer ${TOKEN}` },
    data: { config },
  });
  expect(res.ok(), `saveConfig failed: ${res.status()}`).toBeTruthy();
}

async function deleteConfig(page: Page) {
  const res = await page.request.delete("/api/checkout-heatmap/config", {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  expect(res.ok()).toBeTruthy();
}

async function sweep(page: Page) {
  const res = await page.request.post("/api/checkout-heatmap/sweep", { data: { force: true } });
  expect(res.ok()).toBeTruthy();
}

// Navigate through login and land on personal-info with the short autotest window.
async function gotoCheckout(page: Page, { automation = true } = {}) {
  const params = new URLSearchParams({ step: "login" });
  if (automation) params.set("m1HeatmapTest", "1");
  await page.goto(`/checkout/${SKU}?${params.toString()}`);
  await page.waitForLoadState("networkidle");
  await page.locator("#login_name").waitFor({ state: "visible", timeout: 20000 });
  await page.locator("#login_name").fill("Test");
  await page.getByRole("button", { name: /continue/i }).click();
  await page.waitForURL(/step=personal-info/, { timeout: 10000 });
  await page.locator('input[placeholder="Your name"]').waitFor({ state: "visible", timeout: 20000 });
}

// ─── Test 49 — config GET returns defaults with no saved row ──────────────────
test("Test 49 — GET /api/checkout-heatmap/config returns defaults when no row exists", async ({ page }) => {
  // Ensure no config row is saved.
  await deleteConfig(page);

  const config = await getConfig(page);

  // All three steps enabled.
  expect(config.steps?.["personal-info"], "personal-info enabled by default").toBe(true);
  expect(config.steps?.["delivery"], "delivery enabled by default").toBe(true);
  expect(config.steps?.["pay"], "pay enabled by default").toBe(true);

  // Core event types enabled.
  expect(config.eventTypes?.["click"], "click enabled by default").toBe(true);
  expect(config.eventTypes?.["mouse-move"], "mouse-move enabled by default").toBe(true);
  expect(config.eventTypes?.["scroll"], "scroll enabled by default").toBe(true);

  // Sampling defaults to 100%.
  expect(config.samplingRate, "sampling defaults to 1").toBe(1);

  // Capture window open (no from/to).
  expect(config.captureWindow?.from ?? null, "captureWindow.from is null").toBeNull();
  expect(config.captureWindow?.to ?? null, "captureWindow.to is null").toBeNull();

  console.log(`  defaults OK — steps: ${Object.keys(config.steps ?? {}).length}, samplingRate: ${config.samplingRate}`);
});

// ─── Test 50 — config POST auth: valid token saves; invalid → 401 ─────────────
test("Test 50 — POST saves config with valid token; wrong/missing token → 401", async ({ page }) => {
  await deleteConfig(page);

  // POST without token → 401.
  const noToken = await page.request.post("/api/checkout-heatmap/config", {
    data: { config: { samplingRate: 0.5 } },
  });
  expect(noToken.status(), "missing token → 401").toBe(401);

  // POST with wrong token → 401.
  const wrongToken = await page.request.post("/api/checkout-heatmap/config", {
    headers: { Authorization: "Bearer wrong-token" },
    data: { config: { samplingRate: 0.5 } },
  });
  expect(wrongToken.status(), "wrong token → 401").toBe(401);

  // POST with valid token → 200 and config persisted.
  const saved = { samplingRate: 0.75, steps: { "personal-info": true, delivery: true, pay: false } };
  await saveConfig(page, saved);

  const fetched = await getConfig(page);
  expect(fetched.samplingRate, "saved samplingRate persists").toBe(0.75);
  expect(fetched.steps?.["pay"], "saved pay=false persists").toBe(false);

  // Restore.
  await deleteConfig(page);
  console.log(`  auth gate OK — 401 on missing/wrong token, 200 + persisted on valid`);
});

// ─── Test 51 — disabled step gates capture ────────────────────────────────────
test("Test 51 — disabling a step in config prevents capture on that step", async ({ page }) => {
  await clearHeatmapData(page);

  // Disable personal-info; other steps stay enabled.
  await saveConfig(page, {
    steps: { "personal-info": false, delivery: true, pay: true },
  });

  // Navigate to personal-info and interact; capture should be skipped.
  await gotoCheckout(page);
  await page.locator('[data-heatmap-id="text:name"]').click();
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await sweep(page);

  const sessions = await getStoredSessions(page);
  const piSessions = sessions.filter((s) => s.step === "personal-info");
  expect(piSessions.length, "no sessions captured when step is disabled").toBe(0);

  // Restore.
  await deleteConfig(page);
  console.log(`  step gate OK — 0 personal-info sessions with step disabled`);
});

// ─── Test 52 — disabled event type (mouse-move) gates capture ─────────────────
test("Test 52 — disabling mouse-move event type stops mouse-move capture", async ({ page }) => {
  await clearHeatmapData(page);

  // Disable mouse-move events only.
  await saveConfig(page, {
    eventTypes: {
      click: true, tap: true, scroll: true,
      "mouse-move": false,
      "field-focus": true, "field-blur": true, "field-change": true,
      "validation-error": true, "element-visible": true, "element-hidden": true,
    },
  });

  await gotoCheckout(page);

  // Move the mouse over the surface.
  await page.mouse.move(300, 400);
  await page.mouse.move(350, 450);
  await page.mouse.move(400, 500);
  await page.waitForTimeout(300);

  // Record a click so the session is committed.
  await page.locator('[data-heatmap-id="text:name"]').click();
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await sweep(page);

  const sessions = await getStoredSessions(page);
  expect(sessions.length, "session was captured (click is still enabled)").toBeGreaterThanOrEqual(1);

  const moveSessions = sessions.filter((s) =>
    (s.events ?? []).some((e) => e.type === "mouse-move")
  );
  expect(moveSessions.length, "no mouse-move events when event type is disabled").toBe(0);

  // Restore.
  await deleteConfig(page);
  console.log(`  event-type gate OK — 0 mouse-move events with mouse-move disabled, click still captured`);
});

// ─── Test 53 — sampling rate from config ──────────────────────────────────────
test("Test 53 — sampling rate 0% in config produces no sessions", async ({ page }) => {
  await clearHeatmapData(page);

  // Set sampling to 0% via runtime config; clear any existing sampling cookie.
  await saveConfig(page, { samplingRate: 0 });
  await page.context().clearCookies();

  await gotoCheckout(page);
  await page.locator('[data-heatmap-id="text:name"]').click();
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await sweep(page);

  const sessions = await getStoredSessions(page);
  expect(sessions.length, "no sessions recorded at 0% sampling").toBe(0);

  // Restore and verify 100% works.
  await deleteConfig(page);
  await page.context().clearCookies();

  await gotoCheckout(page);
  await page.locator('[data-heatmap-id="text:name"]').click();
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await sweep(page);

  const afterSessions = await getStoredSessions(page);
  expect(afterSessions.length, "sessions recorded after restoring defaults (100%)").toBeGreaterThanOrEqual(1);

  console.log(`  sampling gate OK — 0 sessions at 0%, ${afterSessions.length} at defaults`);
});
