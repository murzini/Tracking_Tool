import { test, expect, Page } from "@playwright/test";
import fs from "fs";

const EVIDENCE_DIR = "test-results/M2 Test 17 - Fixed-position precision/Check evidence";

// ─── Test 17 — fixed-position precision (M2 Part 5) ───────────────────────────
// `position: fixed` elements (the desktop order-summary sidebar and the chatbot
// icon) do not move with the page scroll. Capture stores their clicks against the
// element with a fixed-overlay anchor, and the heatmap viewer renders those dots
// in a `position: fixed` overlay so they stay glued to the element regardless of
// scroll. This test verifies the dot lands on the element center (≤10px) both at
// the top of the heatmap page and after scrolling down.
//
// Navigation note (same constraint as the delivery/pay specs): the sandbox cannot
// advance steps interactively, but the personal-info step already renders both
// fixed elements, so this test exercises them there.

const INACTIVITY_MS = 2000;
const FIXED_TOLERANCE_PX = 10;

const FIXED_TARGETS = ["area:order-summary", "icon:chatbot"];

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

// Full visitor path → checkout (personal-info), then enable the 2s test
// inactivity threshold so the session finalizes quickly.
async function navigateToPersonalInfo(page: Page) {
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

  const base = page.url().split("?")[0];
  await page.goto(`${base}?m1HeatmapTest=1`);
  await page.waitForLoadState("networkidle");
  await page.locator("#login_name").waitFor({ state: "visible", timeout: 20000 });

  // Complete the login step; the app carries m1HeatmapTest through to personal-info.
  await page.locator("#login_name").fill("Test");
  await page.getByRole("button", { name: /continue/i }).click();
  await page.waitForURL(/step=personal-info/, { timeout: 10000 });
  await page.locator('input[placeholder="Your name"]').waitFor({ state: "visible", timeout: 20000 });
}

// Center of every rendered dot, in viewport coordinates. Fixed-overlay dots are
// positioned with right/bottom (not left/top), so read getBoundingClientRect
// rather than parsing inline styles.
async function getDotCenters(page: Page): Promise<Array<{ cx: number; cy: number }>> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('[title*="click"]')).map((dot) => {
      const r = dot.getBoundingClientRect();
      return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    })
  );
}

// Viewport-relative center of a fixed element by its data-heatmap-id.
async function getFixedElementCenter(page: Page, heatmapId: string): Promise<{ x: number; y: number }> {
  const center = await page.evaluate((id) => {
    const el = document.querySelector(`[data-heatmap-id="${id}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, heatmapId);
  if (!center) throw new Error(`Fixed element [data-heatmap-id="${heatmapId}"] not found`);
  return center;
}

function distance(ax: number, ay: number, bx: number, by: number) {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

function closestDot(dots: Array<{ cx: number; cy: number }>, x: number, y: number) {
  return dots.reduce(
    (best, dot) => {
      const d = distance(dot.cx, dot.cy, x, y);
      return d < best.dist ? { dot, dist: d } : best;
    },
    { dot: dots[0], dist: Infinity }
  );
}

async function assertFixedDotsOnTargets(page: Page, label: string) {
  const dots = await getDotCenters(page);
  expect(dots.length, "fixed-overlay dots must be rendered").toBeGreaterThan(0);

  for (const heatmapId of FIXED_TARGETS) {
    const center = await getFixedElementCenter(page, heatmapId);
    const { dot, dist } = closestDot(dots, center.x, center.y);
    console.log(
      `  [${label}] [${heatmapId}]: element center=(${Math.round(center.x)},${Math.round(center.y)}) | dot=(${Math.round(dot.cx)},${Math.round(dot.cy)}) | dist=${dist.toFixed(1)}px`
    );
    expect(
      dist,
      `[${label}] [${heatmapId}] dot is ${dist.toFixed(1)}px from the fixed element (tolerance: ${FIXED_TOLERANCE_PX}px)`
    ).toBeLessThanOrEqual(FIXED_TOLERANCE_PX);
  }
}

test("Test 17 — clicks on fixed elements (desktop sidebar + chatbot) render in the fixed overlay after scrolling", async ({ page }) => {
  // Desktop viewport (config default 1280×800): the order-summary sidebar is
  // lg:block (≥1024px), so it is visible here.
  await clearHeatmapData(page);
  await navigateToPersonalInfo(page);

  // Scroll mid-page first to confirm the fixed elements stay clickable while the
  // page is scrolled, then click both. On-element clicks anchor with dx=dy=0.
  await page.evaluate(() => window.scrollTo({ top: Math.round(document.body.scrollHeight / 3), behavior: "instant" }));
  await page.waitForTimeout(150);
  await clearHeatmapData(page);

  for (const heatmapId of FIXED_TARGETS) {
    await page.locator(`[data-heatmap-id="${heatmapId}"]`).click();
    await page.waitForTimeout(100);
  }

  await page.waitForTimeout(INACTIVITY_MS + 500);
  await flushActiveHeatmapSession(page);

  await page.goto("/checkout/001/heatmap?step=personal-info&view=desktop_view");
  await page.waitForLoadState("networkidle");
  await page.locator('[data-heatmap-id="area:order-summary"]').waitFor({ state: "visible", timeout: 20000 });
  await page.waitForTimeout(1000);

  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

  // At the top of the heatmap page.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(200);
  await assertFixedDotsOnTargets(page, "scroll-top");
  await page.screenshot({ path: `${EVIDENCE_DIR}/evidence-scroll-top.png` });

  // After scrolling down: fixed dots and fixed elements both stay in place, so
  // the dot must still sit on the element.
  await page.evaluate(() => window.scrollTo({ top: 800, behavior: "instant" }));
  await page.waitForTimeout(300);
  await assertFixedDotsOnTargets(page, "scrolled");
  await page.screenshot({ path: `${EVIDENCE_DIR}/evidence-scrolled.png` });
});
