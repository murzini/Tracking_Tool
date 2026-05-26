import { test, expect, Page } from "@playwright/test";
import fs from "fs";

const SKU = "001";
const SECOND_SKU = "002";
const HEATMAP_URL = `/checkout/${SKU}/heatmap?view=desktop_view`;
const INACTIVITY_MS = 2000;

// ─── helpers ────────────────────────────────────────────────────────────────

async function navigateToPersonalInfo(page: Page, options: { testParam?: boolean; anchorMode?: boolean; sku?: string } = {}) {
  const targetSku = options.sku || SKU;
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /shop backpacks/i }).first().click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: new RegExp(`open details for adventurebag ${targetSku}`, "i") }).click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /add to cart/i }).click();
  await page.waitForLoadState("networkidle");
  // M5: funnel lands on the login step.
  await page.locator("#login_name").waitFor({ state: "visible", timeout: 20000 });

  if (options.testParam) {
    const url = page.url();
    const sep = url.includes("?") ? "&" : "?";
    const extra = options.anchorMode ? "&m1HeatmapAnchor=1" : "";
    await page.goto(`${url}${sep}m1HeatmapTest=1${extra}`);
    await page.waitForLoadState("networkidle");
    await page.locator("#login_name").waitFor({ state: "visible", timeout: 20000 });
  }

  // Complete the login step; the app carries any test params through to personal-info.
  await page.locator("#login_name").fill("Test");
  await page.getByRole("button", { name: /continue/i }).click();
  await page.waitForURL(/step=personal-info/, { timeout: 10000 });
  await page.locator('input[placeholder="Your name"]').waitFor({ state: "visible", timeout: 20000 });
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

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

// ─── shared setup ───────────────────────────────────────────────────────────

async function createOneSession(page: Page) {
  await navigateToPersonalInfo(page, { testParam: true });
  await page.locator('input[placeholder="Your name"]').click();
  await page.waitForTimeout(INACTIVITY_MS + 500);
  await waitForSessionFinalized(page);
}

// ─── Test 1 — Drop-off storage rules ────────────────────────────────────────

test("[desktop] zero-interaction visits bounce; interaction sessions store events", async ({ page }) => {
  const EVIDENCE = "test-results/Test 1 - Drop-off storage rules/Check evidence";
  ensureDir(EVIDENCE);

  await clearHeatmapData(page);

  // Scenario A: no interactions → recorded as a zero-interaction bounce (M4
  // Part 5). The visit is committed on exit and the lazy/derived sweep finalizes
  // it as `abandoned` with no interaction events. (Before M4 Part 5 this stored
  // nothing; the product now records bounces.)
  await navigateToPersonalInfo(page, { testParam: true });
  await page.waitForTimeout(INACTIVITY_MS + 500);

  // Navigate away to fire pagehide → sendBeacon commits the zero-interaction session.
  // M5: login→PI is a client-side nav (no pagehide), so the session stays in memory
  // until the visitor actually leaves the page.
  await page.goto(HEATMAP_URL);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500); // let the beacon reach the server

  const sweepRes = await page.request.post("/api/checkout-heatmap/sweep", { data: { force: true } });
  expect(sweepRes.ok()).toBeTruthy();

  const resA = await page.request.get("/api/checkout-heatmap");
  const dataA = await resA.json();
  console.log(`  Scenario A (no interaction): bounce sessions = ${dataA.sessions.length}`);
  await page.screenshot({ path: `${EVIDENCE}/no-interaction.png` });

  expect(dataA.sessions.length, "Scenario A: a zero-interaction visit must be recorded as a bounce").toBeGreaterThanOrEqual(1);
  for (const s of dataA.sessions as Array<{ outcome?: string; events?: Array<{ type?: string }> }>) {
    expect(s.outcome, "Scenario A: a bounce is abandoned").toBe("abandoned");
    const interactions = (s.events ?? []).filter((e) => ["click", "tap", "scroll", "mouse-move"].includes(e.type ?? ""));
    expect(interactions.length, "Scenario A: a bounce has no interaction events").toBe(0);
  }

  // Scenario B: one interaction + inactivity → session stored with ≥1 click
  await clearHeatmapData(page);
  await navigateToPersonalInfo(page, { testParam: true });
  await page.locator('input[placeholder="Your name"]').click();
  await page.waitForTimeout(INACTIVITY_MS + 500);
  await waitForSessionFinalized(page);

  const resB = await page.request.get("/api/checkout-heatmap");
  const dataB = await resB.json();
  console.log(`  Scenario B (with interaction): sessions = ${dataB.sessions.length}, events = ${dataB.sessions[0]?.events?.length}, step = ${dataB.sessions[0]?.step}`);

  await page.goto(HEATMAP_URL);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${EVIDENCE}/with-interaction.png` });

  expect(dataB.sessions.length, "Scenario B: session with interaction must be stored").toBe(1);
  expect(dataB.sessions[0].events.length, "Scenario B: stored session must contain at least one event").toBeGreaterThanOrEqual(1);
  expect(dataB.sessions[0].step, "Scenario B: stored session must be tagged with the personal-info step").toBe("personal-info");
});

// ─── Test 3 — Heatmap step dropdown opens the selected step in a new tab ──────

test("[desktop] heatmap step dropdown opens the selected step in a new tab", async ({ page, context }) => {
  const EVIDENCE = "test-results/M2 - Heatmap step dropdown/Check evidence";
  ensureDir(EVIDENCE);

  await navigateToPersonalInfo(page);

  // Clicking Heatmap now opens a dropdown listing every step (not a tab directly).
  await page.getByRole("button", { name: /heatmap/i }).click();

  const menu = page.getByRole("menu", { name: /open heatmap for step/i });
  await expect(menu, "the Heatmap button must open a step dropdown").toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Personal Information" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Choose Delivery" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Pay & Finish" })).toBeVisible();
  await page.screenshot({ path: `${EVIDENCE}/dropdown.png` });

  // Selecting a step opens that step's heatmap in a new tab.
  const newTabPromise = context.waitForEvent("page");
  await page.getByRole("menuitem", { name: "Choose Delivery" }).click();
  const newTab = await newTabPromise;
  await newTab.waitForLoadState("networkidle");

  const newTabUrl = newTab.url();
  console.log(`  New tab URL: ${newTabUrl}`);
  console.log(`  Original tab URL: ${page.url()}`);

  // Evidence
  await page.screenshot({ path: `${EVIDENCE}/checkout-tab.png` });
  await newTab.screenshot({ path: `${EVIDENCE}/heatmap-tab.png` });

  expect(newTabUrl, "New tab URL must open the selected step's heatmap").toContain("/heatmap?step=delivery");
  expect(page.url(), "Original tab must still be on the checkout page").toContain("/checkout");
});

// ─── Test 2 — Clear data removes stored history ──────────────────────────────

test("[desktop] clear data button removes all stored sessions", async ({ page }) => {
  const EVIDENCE = "test-results/Test 2 - Clear data removes history/Check evidence";
  ensureDir(EVIDENCE);

  await clearHeatmapData(page);
  await createOneSession(page);

  // Confirm pre-condition: 1 session stored
  const resPre = await page.request.get("/api/checkout-heatmap");
  const dataPre = await resPre.json();
  console.log(`  Pre-clear: sessions stored = ${dataPre.sessions.length}`);
  expect(dataPre.sessions.length, "Pre-condition: 1 session must exist before clearing").toBe(1);

  // Open heatmap page and take before screenshot
  await page.goto(HEATMAP_URL);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${EVIDENCE}/before-clear.png` });

  // Click the Clear data button
  await page.getByRole("button", { name: /clear data/i }).click();
  await page.waitForTimeout(500);

  // Reload heatmap page to show fresh state, then verify stats and take after screenshot
  await page.goto(HEATMAP_URL);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);

  const statsText = await page.locator("div.text-xs.text-slate-500").first().textContent();
  console.log(`  Post-clear heatmap stats: ${statsText}`);
  expect(statsText, "Heatmap stats must show 0 sessions after clear").toContain("0 sessions");

  await page.screenshot({ path: `${EVIDENCE}/after-clear.png` });

  // Verify API returns 0 sessions
  const resPost = await page.request.get("/api/checkout-heatmap");
  const dataPost = await resPost.json();
  console.log(`  Post-clear: sessions stored = ${dataPost.sessions.length}`);

  expect(dataPost.sessions.length, "After clear: API must return 0 sessions").toBe(0);
});

// ─── Test 4 — Mobile layout regression at iPhone 14 Pro Max ──────────────────

test("[mobile] personal-info step is mobile-friendly at iPhone 14 Pro Max (430 × 932)", async ({ page }) => {
  const EVIDENCE = "test-results/Test 4 - Mobile layout iPhone 14 Pro Max/Check evidence";
  ensureDir(EVIDENCE);

  await page.setViewportSize({ width: 430, height: 932 });
  await navigateToPersonalInfo(page);

  // Inject URL banner so it appears in the screenshot
  const currentUrl = page.url();
  await page.evaluate((url) => {
    const banner = document.createElement("div");
    banner.id = "__test_url_banner__";
    banner.style.cssText =
      "position:fixed;top:0;left:0;width:100%;background:#1e293b;color:#f8fafc;font:12px/1.6 monospace;padding:4px 8px;z-index:999999;word-break:break-all;";
    banner.textContent = url;
    document.body.prepend(banner);
  }, currentUrl);

  await page.screenshot({ path: `${EVIDENCE}/personal-info-mobile.png`, fullPage: false });

  await page.evaluate(() => document.getElementById("__test_url_banner__")?.remove());

  // ── 1. All three step pills must be fully visible within the 430px viewport ──
  for (const label of ["Personal Information", "Choose Delivery", "Pay & Finish"]) {
    const pill = page.locator("div.rounded-full").filter({ hasText: new RegExp(`^${label}$`) });
    await expect(pill, `"${label}" pill must be visible`).toBeVisible();
    const box = await pill.boundingBox();
    expect(box, `"${label}" pill must have a bounding box`).not.toBeNull();
    expect(box!.x, `"${label}" left edge must not be outside viewport`).toBeGreaterThanOrEqual(0);
    expect(
      box!.x + box!.width,
      `"${label}" right edge must not be clipped — pill must fit within 430px viewport`
    ).toBeLessThanOrEqual(430);
  }

  // ── 2. No horizontal page overflow ───────────────────────────────────────────
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth
  );
  expect(hasHorizontalOverflow, "Page must not overflow horizontally at 430px").toBe(false);

  // ── 3. Single-column layout: Name and Birthdate must stack vertically ────────
  const nameBox = await page.locator('input[placeholder="Your name"]').boundingBox();
  const birthdateBox = await page.locator('input[placeholder="TT.MM.JJJJ"]').boundingBox();
  expect(nameBox, "Name input must have a bounding box").not.toBeNull();
  expect(birthdateBox, "Birthdate input must have a bounding box").not.toBeNull();
  expect(
    birthdateBox!.y,
    "Birthdate must be below Name (single-column layout — not desktop side-by-side)"
  ).toBeGreaterThan(nameBox!.y + nameBox!.height * 0.9);
});

// ─── Test 5 — View separation ────────────────────────────────────────────────

test("[desktop + mobile] sessions recorded at different viewports are stored under separate views", async ({ page }) => {
  const EVIDENCE = "test-results/Test 5 - View separation/Check evidence";
  ensureDir(EVIDENCE);

  await clearHeatmapData(page);

  // Desktop session (viewport ≥ 1024px → desktop_view)
  await page.setViewportSize({ width: 1280, height: 800 });
  await navigateToPersonalInfo(page, { testParam: true });
  await page.locator('input[placeholder="Your name"]').click();
  await page.waitForTimeout(INACTIVITY_MS + 500);
  await waitForSessionFinalized(page);

  // Mobile session (viewport < 1024px → mobile_view)
  await page.setViewportSize({ width: 430, height: 932 });
  await navigateToPersonalInfo(page, { testParam: true });
  await page.locator('input[placeholder="Your name"]').click();
  await page.waitForTimeout(INACTIVITY_MS + 500);
  await waitForSessionFinalized(page);

  // API: 2 sessions total, one tagged desktop_view and one tagged mobile_view
  const res = await page.request.get("/api/checkout-heatmap");
  const data = await res.json();
  const desktopSessions = data.sessions.filter((s: { view: string }) => s.view === "desktop_view");
  const mobileSessions = data.sessions.filter((s: { view: string }) => s.view === "mobile_view");
  console.log(`  Sessions: total=${data.sessions.length}, desktop=${desktopSessions.length}, mobile=${mobileSessions.length}`);

  expect(data.sessions.length, "2 sessions must be stored total").toBe(2);
  expect(desktopSessions.length, "Exactly 1 session must be tagged desktop_view").toBe(1);
  expect(mobileSessions.length, "Exactly 1 session must be tagged mobile_view").toBe(1);

  // Desktop heatmap shows 1 session, mobile shows 0
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/checkout/${SKU}/heatmap?view=desktop_view`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);
  const desktopStatsText = await page.locator("div.text-xs.text-slate-500").first().textContent();
  console.log(`  Desktop heatmap stats: ${desktopStatsText}`);
  expect(desktopStatsText, "Desktop heatmap must show 1 session").toContain("1 sessions");
  await page.screenshot({ path: `${EVIDENCE}/desktop-view.png` });

  // Mobile heatmap shows 1 session, desktop shows 0
  await page.goto(`/checkout/${SKU}/heatmap?view=mobile_view`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);
  const mobileStatsText = await page.locator("div.text-xs.text-slate-500").first().textContent();
  console.log(`  Mobile heatmap stats: ${mobileStatsText}`);
  expect(mobileStatsText, "Mobile heatmap must show 1 session").toContain("1 sessions");
  await page.screenshot({ path: `${EVIDENCE}/mobile-view.png` });
});

// ─── Test 10 — Radius scaling ────────────────────────────────────────────────

test("[desktop + mobile] repeated clicks on the same element produce a proportionally larger dot", async ({ page }) => {
  async function runRadiusScenario(view: string, evidenceDir: string) {
    ensureDir(evidenceDir);
    await clearHeatmapData(page);
    await navigateToPersonalInfo(page, { testParam: true, anchorMode: true });

    // Click Name input 3 times → anchor aggregates to count 3
    const nameInput = page.locator('input[placeholder="Your name"]');
    await nameInput.click();
    await page.waitForTimeout(100);
    await nameInput.click();
    await page.waitForTimeout(100);
    await nameInput.click();

    // Click ZIP input once → anchor aggregates to count 1
    await page.locator('[data-heatmap-id="text:zip"]').click();

    await page.waitForTimeout(INACTIVITY_MS + 500);
    await flushActiveHeatmapSession(page);

    await page.goto(`/checkout/${SKU}/heatmap?view=${view}`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    const dot3 = page.locator('[title="3 clicks"]');
    const dot1 = page.locator('[title="1 click"]');

    await expect(dot3, `[${view}] A dot for 3 clicks must exist`).toBeVisible();
    await expect(dot1, `[${view}] A dot for 1 click must exist`).toBeVisible();

    const dot3Box = await dot3.boundingBox();
    const dot1Box = await dot1.boundingBox();
    expect(dot3Box, `[${view}] 3-click dot must have a bounding box`).not.toBeNull();
    expect(dot1Box, `[${view}] 1-click dot must have a bounding box`).not.toBeNull();

    // 3-click dot is the maximum (count === maxCount) → radius = 24px → width = 48px
    // 1-click dot: radius = 24 * (1/3) = 8px → width = 16px
    expect(dot3Box!.width, `[${view}] 3-click dot width must equal 2 × maxRadius (48px)`).toBeCloseTo(48, 0);
    expect(dot1Box!.width, `[${view}] 1-click dot width must be proportionally smaller`).toBeCloseTo(16, 0);
    expect(dot3Box!.width, `[${view}] 3-click dot must be wider than 1-click dot`).toBeGreaterThan(dot1Box!.width);

    console.log(`  [${view}] 3-click dot width: ${dot3Box!.width}px, 1-click dot width: ${dot1Box!.width}px`);
    await page.screenshot({ path: `${evidenceDir}/radius-scaling.png`, fullPage: true });
  }

  // Desktop
  await page.setViewportSize({ width: 1280, height: 800 });
  await runRadiusScenario("desktop_view", "test-results/Test 10 - Radius scaling/Check evidence/desktop");

  // Mobile
  await page.setViewportSize({ width: 430, height: 932 });
  await runRadiusScenario("mobile_view", "test-results/Test 10 - Radius scaling/Check evidence/mobile");
});

// ─── Test 6 — Cross-backpack aggregation ────────────────────────────────────

test("[desktop] sessions from different products aggregate into the same Personal Information heatmap", async ({ page }) => {
  const EVIDENCE = "test-results/Test 6 - Cross-backpack aggregation/Check evidence";
  ensureDir(EVIDENCE);

  await clearHeatmapData(page);

  // Session for SKU 001
  await page.setViewportSize({ width: 1280, height: 800 });
  await navigateToPersonalInfo(page, { testParam: true, sku: SKU });
  await page.locator('input[placeholder="Your name"]').click();
  await page.waitForTimeout(INACTIVITY_MS + 500);
  await waitForSessionFinalized(page);

  // Session for SKU 002
  await navigateToPersonalInfo(page, { testParam: true, sku: SECOND_SKU });
  await page.locator('input[placeholder="Your name"]').click();
  await page.waitForTimeout(INACTIVITY_MS + 500);
  await waitForSessionFinalized(page);

  // API: 2 sessions with different SKUs
  const res = await page.request.get("/api/checkout-heatmap");
  const data = await res.json();
  const skus = data.sessions.map((s: { sku: string }) => s.sku);
  console.log(`  Sessions: total=${data.sessions.length}, SKUs=${JSON.stringify(skus)}`);

  expect(data.sessions.length, "2 sessions must be stored total").toBe(2);
  expect(skus, "Sessions must include SKU 001").toContain(SKU);
  expect(skus, "Sessions must include SKU 002").toContain(SECOND_SKU);

  // Both sessions appear in the heatmap regardless of which SKU URL is used
  await page.goto(`/checkout/${SKU}/heatmap?view=desktop_view`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);
  const statsText = await page.locator("div.text-xs.text-slate-500").first().textContent();
  console.log(`  Heatmap stats (SKU 001 URL): ${statsText}`);
  expect(statsText, "Heatmap must aggregate sessions from all SKUs — must show 2 sessions").toContain("2 sessions");

  await page.screenshot({ path: `${EVIDENCE}/cross-backpack.png` });
});
