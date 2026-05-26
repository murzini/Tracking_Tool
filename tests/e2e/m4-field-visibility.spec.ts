import { test, expect, Page } from "@playwright/test";

// ─── M4 Part 4 — field + validation + visibility capture ─────────────────────
// Test 33: field focus/blur/change — change is recorded on blur (commit), not per
//          keystroke, and NO raw typed value is stored (only filled + length).
// Test 34: triggering validation records a validation-error event (distinct from a
//          click on the error anchor).
// Test 35: scrolling a tracked element out of / back into view records
//          element-hidden / element-visible, with a visible duration on hidden.

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

async function navigateToPersonalInfo(page: Page, extraParams = "m1HeatmapTest=1") {
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
  await page.goto(`${url}${sep}${extraParams}`);
  await page.waitForLoadState("networkidle");
  await page.locator("#login_name").waitFor({ state: "visible", timeout: 20000 });

  // Complete the login step; the app carries extraParams through to personal-info.
  await page.locator("#login_name").fill("Test");
  await page.getByRole("button", { name: /continue/i }).click();
  await page.waitForURL(/step=personal-info/, { timeout: 10000 });
  await page.locator('input[placeholder="Your name"]').waitFor({ state: "visible", timeout: 20000 });
}

type Anchor = { id?: string; type?: string };
type Event = {
  type?: string;
  anchor?: Anchor;
  filled?: boolean;
  length?: number;
  visibleMs?: number;
  value?: unknown;
};
type Session = { view?: string; events?: Event[] };

async function getStoredSessions(page: Page): Promise<Session[]> {
  const res = await page.request.get("/api/checkout-heatmap");
  const data = await res.json();
  return (data.sessions ?? []) as Session[];
}

function eventsOfType(session: Session | undefined, type: string): Event[] {
  return (session?.events ?? []).filter((e) => e.type === type);
}

// ─── Test 33 — field events (change on blur, no raw value) ────────────────────

test("Test 33 — field focus/blur/change recorded with anchor, no raw value", async ({ page }) => {
  await clearHeatmapData(page);
  await navigateToPersonalInfo(page);

  // A click finalizes the session on inactivity. Editing the name field focuses it
  // (field-focus), fills a value, and tabbing away commits the change on blur
  // (field-blur + field-change).
  const name = page.locator('[data-heatmap-id="text:name"]');
  await name.click();
  await name.fill("Jane Doe");
  await page.keyboard.press("Tab");
  await page.waitForTimeout(150);

  await page.waitForTimeout(INACTIVITY_MS + 500);
  await flushActiveHeatmapSession(page);

  const sessions = await getStoredSessions(page);
  expect(sessions.length, "one session must be stored").toBe(1);

  const focus = eventsOfType(sessions[0], "field-focus");
  const blur = eventsOfType(sessions[0], "field-blur");
  const change = eventsOfType(sessions[0], "field-change");
  expect(focus.length, "a focused field must record field-focus").toBeGreaterThanOrEqual(1);
  expect(blur.length, "leaving a field must record field-blur").toBeGreaterThanOrEqual(1);
  expect(change.length, "changing a field must record field-change").toBeGreaterThanOrEqual(1);

  // PII guard: every field event carries an anchor + filled/length, never the value.
  for (const e of [...focus, ...blur, ...change]) {
    expect(typeof e.anchor?.id, "field event must carry an anchor id").toBe("string");
    expect(e, "field event must NOT store the raw typed value").not.toHaveProperty("value");
    expect(typeof e.filled, "field event must carry a filled flag").toBe("boolean");
    expect(typeof e.length, "field event must carry a length").toBe("number");
  }

  // The name edit is recorded as a change on blur, filled with the text length.
  const nameChange = change.find((e) => e.anchor?.id === "text:name");
  expect(nameChange, "the name edit must record a field-change").toBeTruthy();
  expect(nameChange!.filled, "a filled name counts as filled").toBe(true);
  expect(nameChange!.length, '"Jane Doe" has length 8').toBe(8);

  console.log(`  field events — focus:${focus.length} blur:${blur.length} change:${change.length}`);
});

// ─── Test 34 — validation-error-shown event ──────────────────────────────────

test("Test 34 — triggering validation records a validation-error event", async ({ page }) => {
  await clearHeatmapData(page);
  await navigateToPersonalInfo(page);

  // Click the CTA with empty mandatory fields → validation errors render.
  await page.locator('[data-heatmap-id="cta:choose-delivery"]').click();
  await expect(page.locator("[data-field-error]").first(), "a validation error must appear").toBeVisible({
    timeout: 5000,
  });
  await page.waitForTimeout(300); // MutationObserver debounce + scan

  await page.waitForTimeout(INACTIVITY_MS + 500);
  await flushActiveHeatmapSession(page);

  const sessions = await getStoredSessions(page);
  expect(sessions.length, "one session must be stored").toBe(1);

  const errors = eventsOfType(sessions[0], "validation-error");
  expect(errors.length, "showing validation must record a validation-error event").toBeGreaterThanOrEqual(1);
  for (const e of errors) {
    expect(e.anchor?.type, "validation-error must carry an error anchor").toBe("error");
    expect(typeof e.anchor?.id, "validation-error must carry an anchor id").toBe("string");
  }

  console.log(`  validation-error events: ${errors.length}`);
});

// ─── Test 35 — element visibility (visible / hidden + duration) ───────────────

test("Test 35 — scrolling tracked elements records element-visible / -hidden", async ({ page }) => {
  await clearHeatmapData(page);
  await navigateToPersonalInfo(page);
  await page.waitForTimeout(500); // let the IntersectionObserver seed initial visibility

  // A click finalizes the session. Scrolling the (seeded-visible) top elements out
  // of view records element-hidden; scrolling back records element-visible.
  await page.locator('input[placeholder="Your name"]').click();

  for (let i = 0; i < 8; i++) {
    await page.mouse.wheel(0, 250);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(300);
  for (let i = 0; i < 8; i++) {
    await page.mouse.wheel(0, -250);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(300);

  await page.waitForTimeout(INACTIVITY_MS + 500);
  await flushActiveHeatmapSession(page);

  const sessions = await getStoredSessions(page);
  expect(sessions.length, "one session must be stored").toBe(1);

  const visible = eventsOfType(sessions[0], "element-visible");
  const hidden = eventsOfType(sessions[0], "element-hidden");
  expect(hidden.length, "scrolling tracked elements out of view must record element-hidden").toBeGreaterThanOrEqual(1);
  expect(visible.length, "scrolling them back into view must record element-visible").toBeGreaterThanOrEqual(1);

  for (const e of [...visible, ...hidden]) {
    expect(typeof e.anchor?.id, "visibility event must carry an anchor id").toBe("string");
  }
  for (const e of hidden) {
    expect(typeof e.visibleMs, "element-hidden must carry a visible duration").toBe("number");
    expect(e.visibleMs!, "visible duration must be non-negative").toBeGreaterThanOrEqual(0);
  }
  const maxVisibleMs = Math.max(...hidden.map((e) => e.visibleMs ?? 0));
  expect(maxVisibleMs, "at least one element must have a positive visible duration").toBeGreaterThan(0);

  console.log(`  visibility events — visible:${visible.length} hidden:${hidden.length} maxVisibleMs:${maxVisibleMs}`);
});
