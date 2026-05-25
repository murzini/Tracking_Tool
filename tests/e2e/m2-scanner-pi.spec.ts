import { test, expect, Page } from "@playwright/test";

// ─── M2 Part 1 — scanner behaviour on the Personal Information step ───────────
// New cases 13–16. These verify the auto-discovery scanner that replaces the
// hand-maintained registry: untagged elements are discovered automatically,
// data-heatmap-type hints win over structural tags, and the two new
// non-interactive types (display, error) are captured.

const INACTIVITY_MS = 2000;

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
  await page.goto(`${url}${sep}m1HeatmapTest=1`);
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

type Anchor = { id: string; type?: string; dx: number; dy: number };

async function getStoredAnchors(page: Page): Promise<Anchor[]> {
  const res = await page.request.get("/api/checkout-heatmap");
  const data = await res.json();
  const anchors: Anchor[] = [];
  for (const session of data.sessions ?? []) {
    for (const event of session.events ?? []) {
      if (event?.anchor?.id) anchors.push(event.anchor);
    }
  }
  return anchors;
}

// ─── Test 13 — scanner auto-discovers an untagged element ─────────────────────

test("Test 13 — scanner captures an untagged element (tooltip close button)", async ({ page }) => {
  await clearHeatmapData(page);
  await navigateToPersonalInfo(page);

  // Open the birthdate tooltip via its tagged trigger, then click the close (X)
  // button — which carries NO data-heatmap-id and has no registry entry.
  await page.locator('[data-heatmap-id="tooltip:birthdate-help"]').click();
  const closeButton = page.getByRole("button", { name: "Close birthdate help" });
  await closeButton.waitFor({ state: "visible", timeout: 5000 });
  await closeButton.click();

  await page.waitForTimeout(INACTIVITY_MS + 500);
  await flushActiveHeatmapSession(page);

  const anchors = await getStoredAnchors(page);
  const ids = anchors.map((a) => a.id);
  console.log(`  stored anchors: ${JSON.stringify(ids)}`);

  const autoAnchor = anchors.find((a) => a.id === "button:close-birthdate-help");
  expect(autoAnchor, "the untagged close button must be auto-discovered by the scanner").toBeTruthy();
  expect(autoAnchor?.type).toBe("button");
});

// ─── Test 14 — data-heatmap-type hint is honored ─────────────────────────────

test("Test 14 — data-heatmap-type hint wins over the structural tag", async ({ page }) => {
  await clearHeatmapData(page);
  await navigateToPersonalInfo(page);

  // The Private control is a <button> declared data-heatmap-type="toggle".
  await page.locator('[data-heatmap-id="toggle:private"]').click();

  await page.waitForTimeout(INACTIVITY_MS + 500);
  await flushActiveHeatmapSession(page);

  const anchors = await getStoredAnchors(page);
  const privateAnchor = anchors.find((a) => a.id === "toggle:private");
  expect(privateAnchor, "an anchor for the Private control must be stored").toBeTruthy();
  expect(
    privateAnchor?.type,
    "Private is a <button> but hinted as toggle — type must be toggle, not button"
  ).toBe("toggle");
});

// ─── Test 15 — display type capture ──────────────────────────────────────────

test("Test 15 — read-only value fields are captured as display anchors", async ({ page }) => {
  await clearHeatmapData(page);
  await navigateToPersonalInfo(page);

  await page.locator('[data-heatmap-id="display:city"]').click();
  await page.locator('[data-heatmap-id="display:country"]').click();

  await page.waitForTimeout(INACTIVITY_MS + 500);
  await flushActiveHeatmapSession(page);

  const anchors = await getStoredAnchors(page);
  const ids = anchors.map((a) => a.id);
  console.log(`  stored anchors: ${JSON.stringify(ids)}`);

  expect(ids, "City must be captured as display:city").toContain("display:city");
  expect(ids, "Country must be captured as display:country").toContain("display:country");
  expect(anchors.find((a) => a.id === "display:city")?.type).toBe("display");
  expect(anchors.find((a) => a.id === "display:country")?.type).toBe("display");
});

// ─── Test 16 — error type capture ────────────────────────────────────────────

test("Test 16 — validation error messages are captured as error anchors", async ({ page }) => {
  await clearHeatmapData(page);
  await navigateToPersonalInfo(page);

  // Trigger validation so error messages render, then click one.
  await page.locator('[data-heatmap-id="cta:choose-delivery"]').click();
  await page.waitForTimeout(300);

  const firstError = page.locator("[data-field-error]").first();
  await firstError.waitFor({ state: "visible", timeout: 5000 });
  await firstError.scrollIntoViewIfNeeded();
  await firstError.click();

  await page.waitForTimeout(INACTIVITY_MS + 500);
  await flushActiveHeatmapSession(page);

  const anchors = await getStoredAnchors(page);
  console.log(`  stored anchors: ${JSON.stringify(anchors.map((a) => a.id))}`);

  const errorAnchors = anchors.filter((a) => a.type === "error" || a.id.startsWith("error:"));
  expect(errorAnchors.length, "at least one error-type anchor must be stored").toBeGreaterThan(0);
});

// ─── Test 12 — step-field tagging ────────────────────────────────────────────
// Part 2 enables step tagging on the personal-info step (the only step with
// capture wired up so far). The delivery/pay scenarios from the full Test 12
// spec land in Part 3, when capture is extended to those steps.

test("Test 12 — sessions are tagged with the personal-info step", async ({ page }) => {
  await clearHeatmapData(page);
  await navigateToPersonalInfo(page);

  await page.locator('[data-heatmap-id="text:name"]').click();

  await page.waitForTimeout(INACTIVITY_MS + 500);
  await flushActiveHeatmapSession(page);

  const res = await page.request.get("/api/checkout-heatmap");
  const data = await res.json();
  console.log(`  sessions: ${data.sessions?.length}, step = ${data.sessions?.[0]?.step}`);

  expect(data.sessions.length, "one session must be stored").toBe(1);
  expect(data.sessions[0].step, "session must be tagged step: personal-info").toBe("personal-info");
});
