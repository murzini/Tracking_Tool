import { test, expect, Page } from "@playwright/test";
import fs from "fs";

const SKU = "001";
const INACTIVITY_MS = 2000;
const EVIDENCE_BASE = "test-results/Test - Element anchor precision/Check evidence";

// How close a dot must be to an element center to pass (on-element click → snap to center).
const ON_ELEMENT_TOLERANCE_PX = 5;
// How close a dot must be to the actual click position (free-space click → exact position).
const FREE_SPACE_TOLERANCE_PX = 10;

// ─── helpers ────────────────────────────────────────────────────────────────

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
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
  await page.goto(`${url}${sep}m1HeatmapTest=1&m1HeatmapAnchor=1`);
  await page.waitForLoadState("networkidle");
  await page.locator('input[placeholder="Your name"]').waitFor({ state: "visible", timeout: 20000 });
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

async function getHeatmapDots(page: Page): Promise<Array<{ cx: number; cy: number }>> {
  return page.evaluate(() => {
    const dots = Array.from(document.querySelectorAll<HTMLElement>('[title*="click"]'));
    return dots.map((dot) => {
      const style = dot.style;
      const left = parseFloat(style.left);
      const top = parseFloat(style.top);
      const width = parseFloat(style.width);
      const height = parseFloat(style.height);
      return { cx: left + width / 2, cy: top + height / 2 };
    });
  });
}

// Returns the center of a data-heatmap-id element relative to the shop-content surface.
async function getHeatmapElementCenter(page: Page, heatmapId: string): Promise<{ x: number; y: number }> {
  const center = await page.evaluate((id) => {
    const el = document.querySelector(`[data-heatmap-id="${id}"]`);
    const surface = document.querySelector('[data-checkout-heatmap-surface="shop-content"]');
    if (!el || !surface) return null;
    const elRect = el.getBoundingClientRect();
    const surfaceRect = surface.getBoundingClientRect();
    return {
      x: elRect.left + elRect.width / 2 - surfaceRect.left,
      y: elRect.top + elRect.height / 2 - surfaceRect.top,
    };
  }, heatmapId);
  if (!center) throw new Error(`Element [data-heatmap-id="${heatmapId}"] not found in heatmap`);
  return center;
}

// Returns viewport-relative center of a data-heatmap-id element on the checkout page.
async function getCheckoutElementCenter(page: Page, heatmapId: string): Promise<{ x: number; y: number }> {
  const center = await page.evaluate((id) => {
    const el = document.querySelector(`[data-heatmap-id="${id}"]`);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, heatmapId);
  if (!center) throw new Error(`Element [data-heatmap-id="${heatmapId}"] not found on checkout page`);
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

async function saveEvidenceScreenshots(page: Page, evidenceDir: string) {
  const scrollPositions = await page.evaluate(() => {
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    return { top: 0, mid: Math.round(maxScroll / 2), bottom: maxScroll };
  });
  for (const [name, top] of Object.entries(scrollPositions)) {
    await page.evaluate((scrollTop) => window.scrollTo({ top: scrollTop, behavior: "instant" }), top);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${evidenceDir}/evidence-${name}.png` });
  }
}

// ─── Test 7: on-element clicks snap to element center (desktop + mobile) ─────

test("[desktop + mobile] on-element clicks produce dots at element center in heatmap", async ({ page }) => {
  const targets = [
    "text:name",
    "text:zip",
    "dropdown:phone-code",
    "checkbox:waterproof-cover",
    "cta:choose-delivery",
  ];

  async function runOnElementScenario(view: string, evidenceDir: string) {
    ensureDir(evidenceDir);
    await clearHeatmapData(page);
    await navigateToPersonalInfo(page);

    for (const heatmapId of targets) {
      const pos = await getCheckoutElementCenter(page, heatmapId);
      await page.evaluate((y) => window.scrollTo({ top: Math.max(0, y - window.innerHeight / 2), behavior: "instant" }), pos.y);
      await page.waitForTimeout(100);
      const freshPos = await getCheckoutElementCenter(page, heatmapId);
      await page.mouse.click(freshPos.x, freshPos.y);
      console.log(`  [${view}] Clicked [${heatmapId}] at viewport (${Math.round(freshPos.x)}, ${Math.round(freshPos.y)})`);
    }

    await page.waitForTimeout(INACTIVITY_MS + 500);
    await flushActiveHeatmapSession(page);

    await page.goto(`/checkout/${SKU}/heatmap?view=${view}`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    const dots = await getHeatmapDots(page);
    expect(dots.length).toBeGreaterThan(0);
    await saveEvidenceScreenshots(page, evidenceDir);

    for (const heatmapId of targets) {
      const center = await getHeatmapElementCenter(page, heatmapId);
      const { dot, dist } = closestDot(dots, center.x, center.y);
      console.log(
        `  [${view}] [${heatmapId}]: element center=(${Math.round(center.x)},${Math.round(center.y)}) | dot=(${Math.round(dot.cx)},${Math.round(dot.cy)}) | dist=${dist.toFixed(1)}px`
      );
      expect(
        dist,
        `[${view}] [${heatmapId}] dot is ${dist.toFixed(1)}px from element center (tolerance: ${ON_ELEMENT_TOLERANCE_PX}px)`
      ).toBeLessThanOrEqual(ON_ELEMENT_TOLERANCE_PX);
    }
  }

  // Desktop
  await page.setViewportSize({ width: 1280, height: 800 });
  await runOnElementScenario("desktop_view", `${EVIDENCE_BASE}/desktop/on-element`);

  // Mobile
  await page.setViewportSize({ width: 430, height: 932 });
  await runOnElementScenario("mobile_view", `${EVIDENCE_BASE}/mobile/on-element`);
});

// ─── Test 8: free-space clicks land at correct offset ────────────────────────

test("[desktop] free-space clicks produce dots at the correct offset from the nearest element", async ({ page }) => {
  const evidenceDir = `${EVIDENCE_BASE}/desktop/free-space`;
  ensureDir(evidenceDir);
  await clearHeatmapData(page);
  await navigateToPersonalInfo(page);

  // Click 30px below the CTA button — free space, nearest anchor is the CTA.
  const ctaPos = await getCheckoutElementCenter(page, "cta:choose-delivery");
  await page.evaluate((y) => window.scrollTo({ top: Math.max(0, y - window.innerHeight / 2), behavior: "instant" }), ctaPos.y);
  await page.waitForTimeout(100);

  const ctaBox = await page.evaluate(() => {
    const el = document.querySelector('[data-heatmap-id="cta:choose-delivery"]');
    const surface = document.querySelector('[data-checkout-heatmap-surface="shop-content"]');
    if (!el || !surface) return null;
    const elRect = el.getBoundingClientRect();
    const surfaceRect = surface.getBoundingClientRect();
    return { bottom: elRect.bottom, halfHeight: elRect.height / 2, surfaceLeft: surfaceRect.left, surfaceTop: surfaceRect.top };
  });
  if (!ctaBox) throw new Error("CTA box not found");

  const freeSpaceViewportX = ctaPos.x;
  const freeSpaceViewportY = ctaBox.bottom + 30;

  await page.mouse.click(freeSpaceViewportX, freeSpaceViewportY);
  console.log(`  Clicked 30px below CTA bottom at viewport (${Math.round(freeSpaceViewportX)}, ${Math.round(freeSpaceViewportY)})`);

  await page.waitForTimeout(INACTIVITY_MS + 500);
  await flushActiveHeatmapSession(page);

  await page.goto(`/checkout/${SKU}/heatmap?view=desktop_view`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);

  const dots = await getHeatmapDots(page);
  expect(dots.length).toBeGreaterThan(0);
  await saveEvidenceScreenshots(page, evidenceDir);

  // Anchor approach: the dot should appear at the same OFFSET from the CTA on the heatmap page.
  // The click was ctaHalfHeight + 30px below the CTA center. Verify that offset is preserved.
  const ctaHeatmapBox = await page.evaluate(() => {
    const el = document.querySelector('[data-heatmap-id="cta:choose-delivery"]');
    const surface = document.querySelector('[data-checkout-heatmap-surface="shop-content"]');
    if (!el || !surface) return null;
    const elRect = el.getBoundingClientRect();
    const surfaceRect = surface.getBoundingClientRect();
    return {
      centerX: elRect.left + elRect.width / 2 - surfaceRect.left,
      bottomY: elRect.bottom - surfaceRect.top,
    };
  });
  if (!ctaHeatmapBox) throw new Error("CTA heatmap box not found");

  const expectedDotX = ctaHeatmapBox.centerX;
  const expectedDotY = ctaHeatmapBox.bottomY + 30;

  const { dot, dist } = closestDot(dots, expectedDotX, expectedDotY);
  console.log(
    `  Free space: expected=(${Math.round(expectedDotX)},${Math.round(expectedDotY)}) | dot=(${Math.round(dot.cx)},${Math.round(dot.cy)}) | dist=${dist.toFixed(1)}px`
  );
  expect(
    dist,
    `Free-space dot is ${dist.toFixed(1)}px from expected offset position (tolerance: ${FREE_SPACE_TOLERANCE_PX}px)`
  ).toBeLessThanOrEqual(FREE_SPACE_TOLERANCE_PX);
});

// ─── Test 9: validation state does not displace dots (desktop + mobile) ─────
// Core regression test for the anchor approach: validation errors shift layout,
// but dots must still land on the correct elements at both viewports.

test("[desktop + mobile] dots land on correct elements after validation is triggered", async ({ page }) => {
  const allTargets = ["cta:choose-delivery", "text:name", "text:zip"];

  async function runValidationScenario(view: string, evidenceDir: string) {
    ensureDir(evidenceDir);
    await clearHeatmapData(page);
    await navigateToPersonalInfo(page);

    // Click CTA to trigger validation (all fields empty → errors appear, content shifts).
    const ctaPos = await getCheckoutElementCenter(page, "cta:choose-delivery");
    await page.evaluate((y) => window.scrollTo({ top: Math.max(0, y - window.innerHeight / 2), behavior: "instant" }), ctaPos.y);
    await page.waitForTimeout(100);
    await page.mouse.click(ctaPos.x, ctaPos.y);
    await page.waitForTimeout(300);

    // Click elements while validation errors are visible (content is shifted).
    for (const heatmapId of ["text:name", "text:zip", "cta:choose-delivery"]) {
      const pos = await getCheckoutElementCenter(page, heatmapId);
      await page.evaluate((y) => window.scrollTo({ top: Math.max(0, y - window.innerHeight / 2), behavior: "instant" }), pos.y);
      await page.waitForTimeout(100);
      const freshPos = await getCheckoutElementCenter(page, heatmapId);
      await page.mouse.click(freshPos.x, freshPos.y);
      console.log(`  [${view}] Clicked [${heatmapId}] in validation state at (${Math.round(freshPos.x)}, ${Math.round(freshPos.y)})`);
    }

    await page.waitForTimeout(INACTIVITY_MS + 500);
    await flushActiveHeatmapSession(page);

    await page.goto(`/checkout/${SKU}/heatmap?view=${view}`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    const dots = await getHeatmapDots(page);
    expect(dots.length).toBeGreaterThan(0);
    await saveEvidenceScreenshots(page, evidenceDir);

    for (const heatmapId of allTargets) {
      const center = await getHeatmapElementCenter(page, heatmapId);
      const { dot, dist } = closestDot(dots, center.x, center.y);
      console.log(
        `  [${view}] [${heatmapId}]: element center=(${Math.round(center.x)},${Math.round(center.y)}) | dot=(${Math.round(dot.cx)},${Math.round(dot.cy)}) | dist=${dist.toFixed(1)}px`
      );
      expect(
        dist,
        `[${view}] [${heatmapId}] dot displaced ${dist.toFixed(1)}px after validation — anchor approach must correct this (tolerance: ${ON_ELEMENT_TOLERANCE_PX}px)`
      ).toBeLessThanOrEqual(ON_ELEMENT_TOLERANCE_PX);
    }
  }

  // Desktop
  await page.setViewportSize({ width: 1280, height: 800 });
  await runValidationScenario("desktop_view", `${EVIDENCE_BASE}/desktop/validation`);

  // Mobile
  await page.setViewportSize({ width: 430, height: 932 });
  await runValidationScenario("mobile_view", `${EVIDENCE_BASE}/mobile/validation`);
});

