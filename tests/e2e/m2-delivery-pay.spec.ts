import { test, expect, Page } from "@playwright/test";

// ─── M2 Part 3 — capture extended to the Delivery and Pay steps ───────────────
// Part 3 lifts the personal-info-only capture gate and tags the delivery/pay
// elements. These tests verify the CAPTURE side only: clicks on those steps are
// recorded and the session is tagged with the correct step.
//
// The RENDER side of Test 18/17 (open `?step=delivery` heatmap → dot present,
// fixed-position precision) depends on the step-aware viewer, which is delivered
// in Part 4 — those assertions are intentionally not included here yet.
//
// Navigation note: the sandbox cannot advance checkout steps *interactively*.
// In non-tour mode the step buttons (Choose delivery / Pay & Finish) drop the
// `step` query param (`buildShopQuery` only emits it under `tour=1`), so the
// step never changes; in tour mode a full-screen "view-only" overlay blocks all
// clicks. Capture itself is step-correct — `resolveStep` honours `?step=`
// regardless of tour — so these tests navigate the full visitor path to the
// checkout and then switch to the target step via URL, which is the only way to
// land on Delivery/Pay interactively in this prototype.

const INACTIVITY_MS = 2000;

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

// Full visitor path → checkout (personal-info step).
async function navigateToCheckout(page: Page) {
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
  await page.locator("#login_name").fill("Test");
  await page.getByRole("button", { name: /continue/i }).click();
  await page.waitForURL(/step=personal-info/, { timeout: 10000 });
  await page.locator('input[placeholder="Your name"]').waitFor({ state: "visible", timeout: 20000 });
}

// Switch the loaded checkout to a specific step (delivery | pay) via URL. The
// 2s test-inactivity threshold is enabled with m1HeatmapTest=1. A sentinel
// element confirms the target step rendered before the test interacts.
async function gotoStep(page: Page, step: "delivery" | "pay", sentinelId: string) {
  const base = page.url().split("?")[0];
  await page.goto(`${base}?step=${step}&m1HeatmapTest=1`);
  await page.waitForURL(new RegExp(`step=${step}`), { timeout: 10000 });
  await page.locator(`[data-heatmap-id="${sentinelId}"]`).waitFor({ state: "visible", timeout: 10000 });
}

type Event = { anchor?: { id?: string; type?: string } };
type Session = { step?: string; events?: Event[] };

async function getStoredSessions(page: Page): Promise<Session[]> {
  const res = await page.request.get("/api/checkout-heatmap");
  const data = await res.json();
  return (data.sessions ?? []) as Session[];
}

// ─── Test 12 — step-field tagging (delivery scenario) ─────────────────────────

test("Test 12 — sessions on the delivery step are tagged step: delivery", async ({ page }) => {
  await clearHeatmapData(page);
  await navigateToCheckout(page);
  await gotoStep(page, "delivery", "radio:delivery-novaposhta");

  // Drop any session created en route, then measure a clean delivery-only session.
  // Also clear sessionStorage so the in-flight delivery session started by gotoStep
  // doesn't get sent after the DB clear (that would produce 2 sessions).
  await clearHeatmapData(page);
  await page.evaluate(() => window.sessionStorage.removeItem("m1.checkoutHeatmap.activeSession"));

  await page.locator('[data-heatmap-id="radio:delivery-pickup"]').click();
  await page.waitForTimeout(INACTIVITY_MS + 500);
  await flushActiveHeatmapSession(page);

  const sessions = await getStoredSessions(page);
  console.log(`  sessions: ${sessions.length}, step = ${sessions[0]?.step}`);

  expect(sessions.length, "one session must be stored").toBe(1);
  expect(sessions[0].step, "session must be tagged step: delivery").toBe("delivery");
});

// ─── Test 12 — step-field tagging (pay scenario) ──────────────────────────────

test("Test 12 — sessions on the pay step are tagged step: pay", async ({ page }) => {
  await clearHeatmapData(page);
  await navigateToCheckout(page);
  await gotoStep(page, "pay", "radio:pay-card");

  // Same isolation fix as the delivery variant above.
  await clearHeatmapData(page);
  await page.evaluate(() => window.sessionStorage.removeItem("m1.checkoutHeatmap.activeSession"));

  await page.locator('[data-heatmap-id="radio:pay-card"]').click();
  await page.waitForTimeout(INACTIVITY_MS + 500);
  await flushActiveHeatmapSession(page);

  const sessions = await getStoredSessions(page);
  console.log(`  sessions: ${sessions.length}, step = ${sessions[0]?.step}`);

  expect(sessions.length, "one session must be stored").toBe(1);
  expect(sessions[0].step, "session must be tagged step: pay").toBe("pay");
});

// ─── Test 18 — Delivery & Pay coverage (capture half) ─────────────────────────
// The render-side assertion (open the step heatmap → dot present) lands in Part 4
// when the viewer becomes step-aware.

test("Test 18 — delivery click is captured with the correct anchor and step", async ({ page }) => {
  await clearHeatmapData(page);
  await navigateToCheckout(page);
  await gotoStep(page, "delivery", "radio:delivery-novaposhta");
  await clearHeatmapData(page);

  await page.locator('[data-heatmap-id="radio:delivery-courier-kyiv"]').click();
  await page.waitForTimeout(INACTIVITY_MS + 500);
  await flushActiveHeatmapSession(page);

  const sessions = await getStoredSessions(page);
  expect(sessions.length, "one delivery session must be stored").toBe(1);
  expect(sessions[0].step).toBe("delivery");

  const ids = (sessions[0].events ?? []).map((e) => e.anchor?.id);
  console.log(`  delivery anchors: ${JSON.stringify(ids)}`);
  expect(ids, "the clicked delivery option must be captured as its tagged anchor").toContain(
    "radio:delivery-courier-kyiv"
  );
  expect(
    (sessions[0].events ?? []).find((e) => e.anchor?.id === "radio:delivery-courier-kyiv")?.anchor?.type
  ).toBe("radio");
});

// Note: the final Pay CTA (`cta:pay`) navigates to the thank-you page, which
// unmounts the capture hook and discards the in-progress session — so it is not
// a usable capture target. We assert capture on a non-navigating pay option.
test("Test 18 — pay click is captured with the correct anchor and step", async ({ page }) => {
  await clearHeatmapData(page);
  await navigateToCheckout(page);
  await gotoStep(page, "pay", "radio:pay-card");
  await clearHeatmapData(page);

  await page.locator('[data-heatmap-id="radio:pay-gpay"]').click();
  await page.waitForTimeout(INACTIVITY_MS + 500);
  await flushActiveHeatmapSession(page);

  const sessions = await getStoredSessions(page);
  expect(sessions.length, "one pay session must be stored").toBe(1);
  expect(sessions[0].step).toBe("pay");

  const ids = (sessions[0].events ?? []).map((e) => e.anchor?.id);
  console.log(`  pay anchors: ${JSON.stringify(ids)}`);
  expect(ids, "the clicked pay option must be captured as its tagged anchor").toContain("radio:pay-gpay");
  expect((sessions[0].events ?? []).find((e) => e.anchor?.id === "radio:pay-gpay")?.anchor?.type).toBe("radio");
});

// ─── Test 18 — Delivery & Pay coverage (render half, Part 4) ──────────────────
// With the step-aware viewer in place, opening the step's heatmap must render a
// dot for the captured click. Completes the render half deferred from Part 3.

async function seedStepClick(
  page: Page,
  step: "delivery" | "pay",
  sentinelId: string,
  targetId: string
) {
  await clearHeatmapData(page);
  await navigateToCheckout(page);
  await gotoStep(page, step, sentinelId);
  await clearHeatmapData(page);
  await page.locator(`[data-heatmap-id="${targetId}"]`).click();
  await page.waitForTimeout(INACTIVITY_MS + 500);
  await flushActiveHeatmapSession(page);
}

test("Test 18 — captured delivery click is rendered as a dot in the step heatmap", async ({ page }) => {
  await seedStepClick(page, "delivery", "radio:delivery-novaposhta", "radio:delivery-courier-kyiv");

  await page.goto("/checkout/001/heatmap?step=delivery&view=desktop_view");
  await page.waitForLoadState("networkidle");

  await expect(page.locator("[data-heatmap-step-label]"), "the viewer must render the delivery step").toContainText("Choose Delivery");
  await expect(
    page.locator('[title="1 click"]').first(),
    "a dot must be rendered for the captured delivery click"
  ).toBeVisible({ timeout: 15000 });
});

test("Test 18 — captured pay click is rendered as a dot in the step heatmap", async ({ page }) => {
  await seedStepClick(page, "pay", "radio:pay-card", "radio:pay-gpay");

  await page.goto("/checkout/001/heatmap?step=pay&view=desktop_view");
  await page.waitForLoadState("networkidle");

  await expect(page.locator("[data-heatmap-step-label]"), "the viewer must render the pay step").toContainText("Pay & Finish");
  await expect(
    page.locator('[title="1 click"]').first(),
    "a dot must be rendered for the captured pay click"
  ).toBeVisible({ timeout: 15000 });
});
