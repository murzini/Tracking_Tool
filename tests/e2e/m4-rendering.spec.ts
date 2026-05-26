import { test, expect, Page } from "@playwright/test";

// ─── M4 Part 8 — rendering (one chosen style per type, no style toggle) ────────
// Test 39: the mouse-move type renders path trails on the step surface; the
//          default view (no type param) stays on click dots with no style row.
// Test 40: the scroll type renders the green colour-by-depth gradient with an
//          inline "<n>% saw it" legend.
// Test 43: mobile finger movement (touchmove) renders in the same "See mouse moves"
//          view, and the mobile view shows a finger-movement disclaimer (Part 7).
//
// Seeding mirrors m4-mousemove-scroll: capture a real session on personal-info at
// the default desktop viewport, then open that step's heatmap and switch type via
// the URL-param-driven type toggle (like the existing desktop/mobile toggle). The
// session lookups tolerate a stray funnel bounce by selecting the session that
// actually carries the seeded events rather than assuming a single stored session.

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

  const url = page.url();
  const sep = url.includes("?") ? "&" : "?";
  await page.goto(`${url}${sep}m1HeatmapTest=1`);
  await page.waitForLoadState("networkidle");
  await page.locator("#login_name").waitFor({ state: "visible", timeout: 20000 });

  // Complete the login step; the app carries m1HeatmapTest through to personal-info.
  await page.locator("#login_name").fill("Test");
  await page.getByRole("button", { name: /continue/i }).click();
  await page.waitForURL(/step=personal-info/, { timeout: 10000 });
  await page.locator('input[placeholder="Your name"]').waitFor({ state: "visible", timeout: 20000 });
}

type Event = { type?: string };
type Session = { view?: string; step?: string; events?: Event[] };

async function getStoredSessions(page: Page): Promise<Session[]> {
  const res = await page.request.get("/api/checkout-heatmap");
  const data = await res.json();
  return (data.sessions ?? []) as Session[];
}

function eventCount(session: Session | undefined, type: string): number {
  return (session?.events ?? []).filter((e) => e.type === type).length;
}

async function openHeatmap(page: Page, query: string) {
  await page.goto(`/checkout/001/heatmap?step=personal-info&view=desktop_view${query}`);
  await page.waitForLoadState("networkidle");
}

// ─── Test 39 — mouse-move rendering + toggle ──────────────────────────────────

test("Test 39 — mouse-move heatmap renders trails; default view stays on click dots", async ({ page }) => {
  await clearHeatmapData(page);
  await navigateToPersonalInfo(page); // default viewport 1280 → desktop_view

  // Capture a session with several mouse-move events.
  await page.locator('input[placeholder="Your name"]').click();
  for (let i = 0; i < 10; i++) {
    await page.mouse.move(360 + i * 12, 280 + i * 18);
    await page.waitForTimeout(130);
  }
  await page.waitForTimeout(INACTIVITY_MS + 500);
  await flushActiveHeatmapSession(page);

  const sessions = await getStoredSessions(page);
  const session = sessions.find((s) => eventCount(s, "mouse-move") >= 3);
  expect(session, "a session carrying mouse-move events must be stored").toBeTruthy();

  // Default (no type param) is the click view — no mouse-move overlay, and the
  // style toggle no longer exists anywhere.
  await openHeatmap(page, "");
  await expect(page.locator('[data-heatmap-layer="mouse-moves"]')).toHaveCount(0);
  await expect(page.locator("[data-heatmap-style-toggle]")).toHaveCount(0);
  // The clicks view forces the expanded layout (validation on) so error-clicks anchor.
  await expect(page.getByText("Required field").first(), "clicks view forces the validation errors").toBeVisible();

  // Switch to mouse moves via the type toggle → trails render directly (one style).
  await page.getByRole("link", { name: "See mouse moves" }).click();
  await page.waitForURL(/type=moves/, { timeout: 10000 });
  await expect(page.locator("[data-heatmap-style-toggle]"), "the style row is gone — each type has one style").toHaveCount(0);
  const trails = page.locator('[data-heatmap-layer="mouse-moves"][data-heatmap-style="trails"]');
  await expect(trails, "trails overlay must render on the surface").toBeVisible({ timeout: 15000 });
  await expect(trails.locator("polyline").first(), "trails overlay must draw a path").toBeVisible();
  // The dropped density style must not render.
  await expect(page.locator('[data-heatmap-style="density"]'), "density style is dropped").toHaveCount(0);
  // Capture-time layout: the moves view must NOT force the validation errors, so
  // trails align with the shorter layout visitors actually moved against.
  await expect(page.getByText("Required field"), "moves view renders the capture-time layout — no forced validation").toHaveCount(0);
});

// ─── Test 40 — scroll rendering + toggle ──────────────────────────────────────

test("Test 40 — scroll heatmap renders the green colour-by-depth gradient with a legend", async ({ page }) => {
  await clearHeatmapData(page);
  await navigateToPersonalInfo(page);

  // Capture a session with scroll-depth events.
  await page.locator('input[placeholder="Your name"]').click();
  for (let i = 0; i < 8; i++) {
    await page.mouse.wheel(0, 250);
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(INACTIVITY_MS + 500);
  await flushActiveHeatmapSession(page);

  const sessions = await getStoredSessions(page);
  const session = sessions.find((s) => eventCount(s, "scroll") >= 2);
  expect(session, "a session carrying scroll events must be stored").toBeTruthy();

  // Scroll type → the gradient renders directly (one style, no style row).
  await openHeatmap(page, "&type=scrolls");
  await expect(page.locator("[data-heatmap-style-toggle]"), "the style row is gone — each type has one style").toHaveCount(0);
  const gradient = page.locator('[data-heatmap-layer="scrolls"][data-heatmap-style="gradient"]');
  await expect(gradient, "gradient overlay must render on the surface").toBeVisible({ timeout: 15000 });
  await expect(gradient).toHaveAttribute("data-heatmap-has-data", "true");

  // The inline legend marks reach depths with "<n>% saw it" labels.
  const legend = gradient.locator("[data-heatmap-scroll-legend]");
  await expect(legend.first(), "the gradient must show an inline reach legend").toBeVisible();
  await expect(legend.first()).toContainText("saw it");

  // The dropped fold-line style must not render.
  await expect(page.locator('[data-heatmap-style="fold"]'), "fold-line style is dropped").toHaveCount(0);

  // Capture-time layout: the scrolls view must NOT force the validation errors.
  await expect(page.getByText("Required field"), "scrolls view renders the capture-time layout — no forced validation").toHaveCount(0);
});

// ─── Test 43 — mobile finger-movement render + disclaimer ─────────────────────

test("Test 43 — mobile finger movement renders in the moves view with a mobile-only disclaimer", async ({ page }) => {
  await page.setViewportSize({ width: MOBILE_WIDTH, height: 800 });
  await clearHeatmapData(page);
  await navigateToPersonalInfo(page); // mobile width → mobile_view

  // Capture a mobile session with finger movement (simulated touchmove drags).
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
  const session = sessions.find((s) => s.view === "mobile_view" && eventCount(s, "mouse-move") >= 3);
  expect(session, "a mobile session carrying finger-move events must be stored").toBeTruthy();

  // Open the mobile moves heatmap → finger movement renders as trails + the disclaimer shows.
  await page.goto("/checkout/001/heatmap?step=personal-info&view=mobile_view&type=moves");
  await page.waitForLoadState("networkidle");
  const trails = page.locator('[data-heatmap-layer="mouse-moves"][data-heatmap-style="trails"]');
  await expect(trails, "finger movement must render in the moves view on mobile").toBeVisible({ timeout: 15000 });
  await expect(trails.locator("polyline").first(), "moves overlay must draw a finger-movement path").toBeVisible();

  const disclaimer = page.locator("[data-heatmap-mobile-moves-disclaimer]");
  await expect(disclaimer, "mobile moves view must show the finger-movement disclaimer").toBeVisible();
  await expect(disclaimer).toContainText("finger movements that include scrolling");

  // The disclaimer must NOT appear on the desktop moves view.
  await page.goto("/checkout/001/heatmap?step=personal-info&view=desktop_view&type=moves");
  await page.waitForLoadState("networkidle");
  await expect(
    page.locator("[data-heatmap-mobile-moves-disclaimer]"),
    "disclaimer must not show on the desktop moves view"
  ).toHaveCount(0);
});
