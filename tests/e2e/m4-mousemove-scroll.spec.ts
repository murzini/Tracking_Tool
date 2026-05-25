import { test, expect, Page } from "@playwright/test";

// ─── M4 Part 3 — mouse-move + scroll-depth capture ───────────────────────────
// Test 31: desktop mouse movement is captured, throttled to ~100ms (≈10Hz); mobile
//          captures finger movement (touchmove) as mouse-move events, also throttled
//          (M4 Part 7 — supersedes the original "movement = desktop-only" decision).
// Test 32: scrolling records scroll events carrying a depth that increases as the
//          visitor scrolls further down the page.

const INACTIVITY_MS = 2000;
const MOBILE_WIDTH = 390;

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

async function navigateToPersonalInfo(page: Page, extraParams = "m1HeatmapTest=1") {
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
  await page.goto(`${url}${sep}${extraParams}`);
  await page.waitForLoadState("networkidle");
  await page.locator('input[placeholder="Your name"]').waitFor({ state: "visible", timeout: 20000 });
}

type Event = { type?: string; x?: number; y?: number; depth?: number; scrollY?: number; timestamp?: string };
type Session = { view?: string; events?: Event[] };

async function getStoredSessions(page: Page): Promise<Session[]> {
  const res = await page.request.get("/api/checkout-heatmap");
  const data = await res.json();
  return (data.sessions ?? []) as Session[];
}

function eventsOfType(session: Session | undefined, type: string): Event[] {
  return (session?.events ?? []).filter((e) => e.type === type);
}

// ─── Test 31 — mouse-move capture (desktop only) ─────────────────────────────

test("Test 31 — desktop mouse movement is captured and throttled to ~100ms", async ({ page }) => {
  await clearHeatmapData(page);
  await navigateToPersonalInfo(page); // default viewport 1280 → desktop_view

  // A click guarantees the session finalizes on inactivity; the spaced moves below
  // each clear the ~100ms throttle so several distinct mouse-move events land.
  await page.locator('input[placeholder="Your name"]').click();
  for (let i = 0; i < 10; i++) {
    await page.mouse.move(360 + i * 12, 280 + i * 18);
    await page.waitForTimeout(130);
  }

  await page.waitForTimeout(INACTIVITY_MS + 500);
  await flushActiveHeatmapSession(page);

  const sessions = await getStoredSessions(page);
  expect(sessions.length, "one session must be stored").toBe(1);

  const moves = eventsOfType(sessions[0], "mouse-move");
  expect(moves.length, "desktop session must capture mouse-move events").toBeGreaterThanOrEqual(3);
  // Throttled, not per-pixel: 10 spaced moves must not explode into hundreds.
  expect(moves.length, "mouse-move must be throttled, not one-per-frame").toBeLessThanOrEqual(40);

  const times = moves.map((e) => new Date(e.timestamp as string).getTime()).sort((a, b) => a - b);
  for (let i = 1; i < times.length; i++) {
    expect(times[i] - times[i - 1], "consecutive mouse-move events must be ≥~100ms apart").toBeGreaterThanOrEqual(90);
  }

  console.log(`  desktop mouse-move events: ${moves.length}`);
});

test("Test 31 — finger movement IS captured on mobile (touchmove)", async ({ page }) => {
  await page.setViewportSize({ width: MOBILE_WIDTH, height: 800 });
  await clearHeatmapData(page);
  await navigateToPersonalInfo(page); // mobile width → mobile_view

  // Tap (records a click), then simulate finger drags via touchmove. Each move is
  // spaced past the ~100ms throttle so several distinct mouse-move events land.
  await page.locator('input[placeholder="Your name"]').click();
  for (let i = 0; i < 10; i++) {
    const x = 120 + i * 10;
    const y = 240 + i * 14;
    await page.evaluate(
      ([cx, cy]) => {
        const touch = new Touch({
          identifier: 1,
          target: document.body,
          clientX: cx,
          clientY: cy,
          pageX: cx,
          pageY: cy + window.scrollY,
        });
        window.dispatchEvent(
          new TouchEvent("touchmove", { touches: [touch], bubbles: true, cancelable: true })
        );
      },
      [x, y]
    );
    await page.waitForTimeout(130);
  }

  await page.waitForTimeout(INACTIVITY_MS + 500);
  await flushActiveHeatmapSession(page);

  const sessions = await getStoredSessions(page);
  expect(sessions.length, "one mobile session must be stored").toBe(1);
  expect(sessions[0].view, "session must be classified as mobile").toBe("mobile_view");

  const moves = eventsOfType(sessions[0], "mouse-move");
  expect(moves.length, "mobile must capture finger movement as mouse-move events").toBeGreaterThanOrEqual(3);
  // Throttled, not one-per-event: 10 spaced moves must not explode into hundreds.
  expect(moves.length, "finger movement must be throttled, not one-per-event").toBeLessThanOrEqual(40);

  const times = moves.map((e) => new Date(e.timestamp as string).getTime()).sort((a, b) => a - b);
  for (let i = 1; i < times.length; i++) {
    expect(times[i] - times[i - 1], "consecutive mouse-move events must be ≥~100ms apart").toBeGreaterThanOrEqual(90);
  }

  const clicks = eventsOfType(sessions[0], "click");
  const taps = eventsOfType(sessions[0], "tap");
  expect(clicks.length + taps.length, "capture still works on mobile (the tap is recorded)").toBeGreaterThanOrEqual(1);

  console.log(`  mobile finger-move events: ${moves.length}`);
});

// ─── Test 32 — scroll-depth capture ──────────────────────────────────────────

test("Test 32 — scrolling records scroll events with increasing depth", async ({ page }) => {
  await clearHeatmapData(page);
  await navigateToPersonalInfo(page);

  // Click so the session finalizes, then scroll down in spaced steps so each
  // throttled tick sees a new (larger) depth.
  await page.locator('input[placeholder="Your name"]').click();
  for (let i = 0; i < 8; i++) {
    await page.mouse.wheel(0, 250);
    await page.waitForTimeout(150);
  }

  await page.waitForTimeout(INACTIVITY_MS + 500);
  await flushActiveHeatmapSession(page);

  const sessions = await getStoredSessions(page);
  expect(sessions.length, "one session must be stored").toBe(1);

  const scrolls = eventsOfType(sessions[0], "scroll");
  expect(scrolls.length, "scrolling must record scroll events").toBeGreaterThanOrEqual(2);

  const depths = scrolls
    .map((e) => new Date(e.timestamp as string).getTime())
    .map((t, i) => ({ t, depth: scrolls[i].depth as number }))
    .sort((a, b) => a.t - b.t)
    .map((d) => d.depth);

  for (const depth of depths) {
    expect(depth, "depth must be a 0-100 percentage").toBeGreaterThanOrEqual(0);
    expect(depth, "depth must be a 0-100 percentage").toBeLessThanOrEqual(100);
  }
  // Recorded only on change while scrolling down, so depth is non-decreasing…
  for (let i = 1; i < depths.length; i++) {
    expect(depths[i], "scroll depth must not decrease while scrolling down").toBeGreaterThanOrEqual(depths[i - 1]);
  }
  // …and overall it must have grown.
  expect(depths[depths.length - 1], "scroll depth must increase as the visitor scrolls down").toBeGreaterThan(depths[0]);

  console.log(`  scroll events: ${scrolls.length}, depths: ${depths.join(",")}`);
});
