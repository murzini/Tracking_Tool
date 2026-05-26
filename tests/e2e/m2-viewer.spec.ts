import { test, expect, Page } from "@playwright/test";
import fs from "fs";

// ─── M2 Part 4 — Test 19: step-aware heatmap viewer ───────────────────────────
// The single heatmap route is now step-aware via `?step=`. With one drop-off
// session seeded per step, opening a step's heatmap must show ONLY that step's
// session/dots, and the desktop/mobile toggle must stay within the viewer while
// preserving the step.
//
// Navigation note (same as m2-delivery-pay): the sandbox cannot advance checkout
// steps interactively, so each step is reached by navigating the full visitor
// path to checkout and then switching to the target step via `?step=`.

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

type Step = "personal-info" | "delivery" | "pay";

// Seed exactly one drop-off session on the given step by clicking a tracked
// element, then waiting out the (test-mode 2s) inactivity threshold.
//
// Navigate DIRECTLY to the target step (the catalog item resolves from the sku).
// Going through the funnel and then jumping steps would leave an untouched
// pass-through page that — since M4 Part 5 — is recorded as a zero-interaction
// bounce, inflating the seeded count. Each prior step's page is already finalized
// before the next direct navigation, so its unload is a no-op.
//
// M5: the login gate must be satisfied first. For the initial call we navigate
// through login with m1HeatmapTest=1 so the app carries it to personal-info in
// one client navigation — no stray session. Subsequent calls reuse the existing
// sessionStorage gate and skip the login flow.
async function seedStepClick(page: Page, step: Step, sentinelId: string, targetId: string) {
  const isLoggedIn = await page.evaluate(() => {
    try {
      return typeof sessionStorage !== "undefined" && sessionStorage.getItem("m1.login.done") === "1";
    } catch {
      return false;
    }
  });
  if (!isLoggedIn) {
    await page.goto("/checkout/001?step=login&m1HeatmapTest=1");
    await page.locator("#login_name").waitFor({ state: "visible", timeout: 20000 });
    await page.locator("#login_name").fill("Test");
    await page.getByRole("button", { name: /continue/i }).click();
    await page.waitForURL(/step=personal-info/, { timeout: 10000 });
    if (step !== "personal-info") {
      await page.goto(`/checkout/001?step=${step}&m1HeatmapTest=1`);
      await page.waitForURL(new RegExp(`step=${step}`), { timeout: 10000 });
    }
  } else {
    await page.goto(`/checkout/001?step=${step}&m1HeatmapTest=1`);
    await page.waitForURL(new RegExp(`step=${step}`), { timeout: 10000 });
  }
  await page.locator(`[data-heatmap-id="${sentinelId}"]`).waitFor({ state: "visible", timeout: 10000 });
  await page.locator(`[data-heatmap-id="${targetId}"]`).click();
  await page.waitForTimeout(INACTIVITY_MS + 500);
  await flushActiveHeatmapSession(page);
}

async function getStoredSessions(page: Page) {
  const res = await page.request.get("/api/checkout-heatmap");
  const data = await res.json();
  return (data.sessions ?? []) as { step?: string }[];
}

test("Test 19 — step-aware viewer shows only the requested step's sessions and toggles view", async ({ page }) => {
  const EVIDENCE = "test-results/M2 Test 19 - Step-aware viewer/Check evidence";
  fs.mkdirSync(EVIDENCE, { recursive: true });

  await clearHeatmapData(page);

  // One drop-off session per step (captured at the default desktop viewport).
  await seedStepClick(page, "personal-info", "text:name", "text:name");
  await seedStepClick(page, "delivery", "radio:delivery-novaposhta", "radio:delivery-courier-kyiv");
  await seedStepClick(page, "pay", "radio:pay-card", "radio:pay-gpay");

  const all = await getStoredSessions(page);
  const perStep = all.reduce<Record<string, number>>((acc, s) => {
    acc[s.step ?? "?"] = (acc[s.step ?? "?"] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`  seeded sessions: total=${all.length}, perStep=${JSON.stringify(perStep)}`);
  expect(all.length, "three sessions (one per step) must be stored").toBe(3);

  const steps: { step: Step; title: string }[] = [
    { step: "personal-info", title: "Personal Information" },
    { step: "delivery", title: "Choose Delivery" },
    { step: "pay", title: "Pay & Finish" },
  ];

  // Each step's viewer shows its own title, exactly one session, and a dot —
  // proving sessions are filtered to the requested step (3 stored, 1 shown).
  for (const { step, title } of steps) {
    await page.goto(`/checkout/001/heatmap?step=${step}&view=desktop_view`);
    await page.waitForLoadState("networkidle");

    await expect(page.locator("h1"), `${step}: viewer must be titled for the step`).toContainText(title);
    await expect(
      page.locator("div.text-xs.text-slate-500").first(),
      `${step}: only this step's single session must be shown`
    ).toContainText("1 sessions", { timeout: 15000 });
    await expect(
      page.locator('[title="1 click"]').first(),
      `${step}: a dot must be rendered for this step`
    ).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: `${EVIDENCE}/${step}-desktop.png` });
  }

  // The desktop/mobile toggle lives inside the viewer and preserves the step.
  await page.goto(`/checkout/001/heatmap?step=delivery&view=desktop_view`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("link", { name: "Mobile" }).click();
  await page.waitForURL(/view=mobile_view/, { timeout: 10000 });

  expect(page.url(), "toggling to mobile must preserve the active step").toContain("step=delivery");
  // Sessions were captured at desktop, so the mobile view of this step shows none.
  await expect(
    page.locator("div.text-xs.text-slate-500").first(),
    "mobile view of a desktop-captured step must show 0 sessions"
  ).toContainText("0 sessions", { timeout: 15000 });
  await page.screenshot({ path: `${EVIDENCE}/delivery-mobile-toggle.png` });
});
