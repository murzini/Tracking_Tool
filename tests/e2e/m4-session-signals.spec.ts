import { test, expect, Page } from "@playwright/test";

// ─── M4 Part 5 — session signals + outcomes ──────────────────────────────────
// Test 36: a zero-interaction visit is committed on exit and the lazy/derived
//          sweep finalizes it as an `abandoned` bounce with an exit reason.
// Test 37: advancing a step records `advanced`; finishing checkout records
//          `completed` on the pay step.
// Test 38: a finalized session records step_active_ms / step_idle_ms that
//          reconcile with the duration.
// Test 41: returning within X resumes the same session id; after X is a new one.

const INACTIVITY_MS = 2000;
const SKU = "001";
const RESUME_KEY = "m1.checkoutHeatmap.resume";
const ACTIVE_KEY = "m1.checkoutHeatmap.activeSession";

type Anchor = { id?: string; type?: string };
type Event = { type?: string; anchor?: Anchor };
type Session = {
  step?: string;
  outcome?: string | null;
  exitReason?: string | null;
  stepActiveMs?: number;
  stepIdleMs?: number;
  durationMs?: number;
  events?: Event[];
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

async function sweep(page: Page, force = true) {
  const res = await page.request.post("/api/checkout-heatmap/sweep", { data: { force } });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).finalized as number;
}

// Direct navigation to the checkout step (the catalog item resolves from the sku,
// so the full funnel is unnecessary). `automation` flips the short autotest
// inactivity/grace window (2s) on via m1HeatmapTest=1; omit it for the longer
// 30s window when a test needs time to act (e.g. filling fields before advancing).
async function gotoCheckout(page: Page, { automation = true, step = "personal-info" } = {}) {
  const params = new URLSearchParams({ step });
  if (automation) params.set("m1HeatmapTest", "1");
  await page.goto(`/checkout/${SKU}?${params.toString()}`);
  await page.waitForLoadState("networkidle");
  await page.locator('input[placeholder="Your name"]').waitFor({ state: "visible", timeout: 20000 });
}

async function resumeId(page: Page): Promise<string | null> {
  return page.evaluate((key) => {
    try {
      return JSON.parse(window.localStorage.getItem(key) || "null")?.id ?? null;
    } catch {
      return null;
    }
  }, RESUME_KEY);
}

async function waitForSessionFinalized(page: Page, timeoutMs = 10000) {
  await page.waitForFunction((key) => !window.sessionStorage.getItem(key), ACTIVE_KEY, { timeout: timeoutMs });
}

async function flushActiveHeatmapSession(page: Page) {
  await page.evaluate(async () => {
    const flush = (window as Window & { __m1CheckoutHeatmapFlush?: () => Promise<boolean> }).__m1CheckoutHeatmapFlush;
    if (typeof flush === "function") await flush();
  });
  await waitForSessionFinalized(page);
}

// Mandatory personal-info fields (mirrors m4-step-nav).
async function fillPersonalInfo(page: Page) {
  await page.locator('[data-heatmap-id="text:name"]').fill("Test Visitor");
  await page.locator('[data-heatmap-id="date:birthdate"]').fill("01.01.1990");
  await page.locator('[data-heatmap-id="tel:phone-number"]').fill("1701234567");
  await page.locator('[data-heatmap-id="dropdown:phone-code"]').selectOption("+49");
  await page.locator('[data-heatmap-id="dropdown:street"]').selectOption("Fehrbelliner Strasse");
}

// ─── Test 36 — zero-interaction bounce ───────────────────────────────────────

test("Test 36 — a zero-interaction visit is recorded as an abandoned bounce", async ({ page }) => {
  await clearHeatmapData(page);
  await gotoCheckout(page);

  // No interaction at all, then leave (tab close) → the exit beacon commits the
  // bare session even with no events.
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));

  // No always-on runtime: force the lazy/derived finalize.
  await sweep(page, true);

  const sessions = await getStoredSessions(page);
  expect(sessions.length, "the zero-interaction visit must be recorded").toBeGreaterThanOrEqual(1);

  for (const s of sessions) {
    expect(s.outcome, "a non-completed visit is abandoned").toBe("abandoned");
    expect(["idle", "nav-click", "back", "left-browser"], "a known exit reason must be recorded").toContain(s.exitReason);
    const interactionEvents = (s.events ?? []).filter((e) =>
      ["click", "tap", "scroll", "mouse-move"].includes(e.type ?? "")
    );
    expect(interactionEvents.length, "a bounce has no interaction events").toBe(0);
  }

  console.log(`  bounce sessions: ${sessions.length}, exitReason: ${sessions[0].exitReason}`);
});

// ─── Test 37 — outcome advanced / completed ──────────────────────────────────

test("Test 37 — advancing records advanced; finishing records completed", async ({ page }) => {
  await clearHeatmapData(page);
  // 30s window so filling the form does not trip the inactivity finalize.
  await gotoCheckout(page, { automation: false });
  await fillPersonalInfo(page);

  // Personal Information → Delivery (advanced), Delivery → Pay (advanced).
  await page.locator('[data-heatmap-id="cta:choose-delivery"]').click();
  await page.waitForURL(/step=delivery/, { timeout: 10000 });
  await page.locator('[data-heatmap-id="cta:pay-finish"]').click();
  await page.waitForURL(/step=pay/, { timeout: 10000 });

  // Pay → thank-you (completed).
  await page.locator('[data-heatmap-id="cta:pay"]').click();
  await page.waitForURL(/thankyou/, { timeout: 10000 });

  // The three step sessions land via keepalive flushes — poll until present.
  let sessions: Session[] = [];
  await expect
    .poll(async () => {
      sessions = await getStoredSessions(page);
      return sessions.length;
    }, { timeout: 10000, intervals: [200, 300, 500] })
    .toBeGreaterThanOrEqual(3);

  const byStep = (step: string) => sessions.find((s) => s.step === step);
  expect(byStep("personal-info")?.outcome, "personal-info was advanced").toBe("advanced");
  expect(byStep("delivery")?.outcome, "delivery was advanced").toBe("advanced");
  expect(byStep("pay")?.outcome, "pay was completed").toBe("completed");

  // Success outcomes carry no exit reason.
  expect(byStep("pay")?.exitReason ?? null, "a completed step has no exit reason").toBeNull();

  console.log(`  outcomes — ${sessions.map((s) => `${s.step}:${s.outcome}`).join(", ")}`);
});

// ─── Test 38 — step active / idle timing ─────────────────────────────────────

test("Test 38 — a finalized session records reconciling active/idle timing", async ({ page }) => {
  await clearHeatmapData(page);
  await gotoCheckout(page);

  await page.locator('[data-heatmap-id="text:name"]').click();
  await page.waitForTimeout(600);
  await page.locator('[data-heatmap-id="text:zip"]').click();

  await page.waitForTimeout(INACTIVITY_MS + 500);
  await flushActiveHeatmapSession(page);

  const sessions = await getStoredSessions(page);
  expect(sessions.length, "one session must be stored").toBe(1);
  const s = sessions[0];

  expect(typeof s.stepActiveMs, "step_active_ms must be present").toBe("number");
  expect(typeof s.stepIdleMs, "step_idle_ms must be present").toBe("number");
  expect(typeof s.durationMs, "duration must be present").toBe("number");
  expect(s.stepActiveMs! >= 0 && s.stepIdleMs! >= 0, "timing must be non-negative").toBeTruthy();
  // active + idle reconcile with the duration (idle = duration − active).
  expect(s.stepActiveMs! + s.stepIdleMs!, "active + idle must equal duration").toBe(s.durationMs);
  // The trailing inactivity window is idle time, so idle must be positive.
  expect(s.stepIdleMs!, "a timed-out session has idle time").toBeGreaterThan(0);

  console.log(`  active:${s.stepActiveMs}ms idle:${s.stepIdleMs}ms duration:${s.durationMs}ms`);
});

// ─── Test 41 — session resume within X ───────────────────────────────────────

test("Test 41 — return within X resumes the same session; after X is a new one", async ({ page }) => {
  await clearHeatmapData(page);
  await gotoCheckout(page); // automation → X = 2s

  // Record an interaction, then capture the active session id.
  await page.locator('[data-heatmap-id="text:name"]').click();
  const idBefore = await resumeId(page);
  expect(idBefore, "a session id must be persisted").toBeTruthy();

  // Return within X: reload immediately → the same session resumes.
  await page.reload();
  await page.waitForLoadState("networkidle");
  await page.locator('input[placeholder="Your name"]').waitFor({ state: "visible", timeout: 20000 });
  const idWithin = await resumeId(page);
  expect(idWithin, "returning within X must resume the same session").toBe(idBefore);

  // Return after X: stay idle past the window, then reload → a new session.
  await page.waitForTimeout(INACTIVITY_MS + 1000);
  await page.reload();
  await page.waitForLoadState("networkidle");
  await page.locator('input[placeholder="Your name"]').waitFor({ state: "visible", timeout: 20000 });
  const idAfter = await resumeId(page);
  expect(idAfter, "returning after X must start a new session").not.toBe(idBefore);

  console.log(`  idBefore=${idBefore?.slice(-8)} within=${idWithin?.slice(-8)} after=${idAfter?.slice(-8)}`);
});

// ─── Test 42 — stored in-progress outcome (M4 Part 6) ─────────────────────────
// A committed-but-unfinalized session reads `in-progress` (not null); the sweep
// finalizes it as `abandoned`. A second case confirms a resolved outcome is not
// reverted by a later sweep (terminal outcomes win).

test("Test 42 — an unfinalized session reads in-progress, then a sweep finalizes it as abandoned", async ({ page }) => {
  await clearHeatmapData(page);
  // 30s window so the client does not auto-finalize while we read the in-progress
  // state — we want the committed-but-unfinalized snapshot, not a timed-out one.
  await gotoCheckout(page, { automation: false });

  await page.locator('[data-heatmap-id="text:name"]').click();
  // Leave (tab close) WITHOUT a finalize — the exit beacon commits the session
  // unfinalized, so it persists with outcome `in-progress`.
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));

  let session: Session | undefined;
  await expect
    .poll(async () => {
      const sessions = await getStoredSessions(page);
      session = sessions[0];
      return sessions.length;
    }, { timeout: 10000, intervals: [200, 300, 500] })
    .toBeGreaterThanOrEqual(1);
  expect(session?.outcome, "an unfinalized committed session reads in-progress, not null").toBe("in-progress");

  // No always-on runtime: the lazy/derived sweep finalizes it as a drop-off.
  await sweep(page, true);
  const after = await getStoredSessions(page);
  expect(after[0].outcome, "the sweep flips in-progress → abandoned").toBe("abandoned");

  console.log(`  in-progress → ${after[0].outcome}`);
});

test("Test 42 — a resolved outcome is not reverted by a later sweep", async ({ page }) => {
  await clearHeatmapData(page);
  // 30s window so filling + advancing does not trip the inactivity finalize.
  await gotoCheckout(page, { automation: false });
  await fillPersonalInfo(page);

  // Advance personal-info → delivery: the personal-info session resolves to `advanced`.
  await page.locator('[data-heatmap-id="cta:choose-delivery"]').click();
  await page.waitForURL(/step=delivery/, { timeout: 10000 });

  let personalInfo: Session | undefined;
  await expect
    .poll(async () => {
      personalInfo = (await getStoredSessions(page)).find((s) => s.step === "personal-info");
      return personalInfo?.outcome ?? null;
    }, { timeout: 10000, intervals: [200, 300, 500] })
    .toBe("advanced");

  // A later sweep must NOT overwrite the resolved outcome (terminal wins).
  await sweep(page, true);
  personalInfo = (await getStoredSessions(page)).find((s) => s.step === "personal-info");
  expect(personalInfo?.outcome, "a resolved (advanced) outcome survives a sweep").toBe("advanced");

  console.log(`  resolved outcome after sweep: ${personalInfo?.outcome}`);
});
