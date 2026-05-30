import { test, expect } from "@playwright/test";

const TOKEN = "dashboard-link";
const DASHBOARD = `/dashboard?token=${TOKEN}`;
const REPORT_PAGE = `/dashboard/report?token=${TOKEN}`;

// ── Test 64 ────────────────────────────────────────────────────────────────
test("Test 64 — Min-sessions gate: dropdown, count display, button state", async ({ page }) => {
  await page.goto(DASHBOARD);

  const dropdown = page.locator("[data-dashboard-report-min-sessions]");
  await expect(dropdown).toBeVisible();

  // Options 100 / 200 / 500 / 1000 must be present
  const optionValues = await dropdown.locator("option").evaluateAll(
    (els) => els.map((el) => Number((el as HTMLOptionElement).value))
  );
  expect(optionValues).toContain(100);
  expect(optionValues).toContain(200);
  expect(optionValues).toContain(500);
  expect(optionValues).toContain(1000);

  // Accumulated count element must be present
  await expect(page.locator("[data-dashboard-report-session-count]")).toBeVisible();

  // Generate Report button must be present
  const btn = page.locator("[data-dashboard-report-generate]");
  await expect(btn).toBeVisible();

  // Button is disabled when accumulated count < selected minimum (likely 0 in a clean run)
  const sessionText = await page.locator("[data-dashboard-report-session-count]").textContent();
  const sessionCount = parseInt((sessionText ?? "").replace(/[^0-9]/g, ""), 10) || 0;
  const minSessions = parseInt(await dropdown.inputValue(), 10);
  if (sessionCount < minSessions) {
    await expect(btn).toBeDisabled();
  }

  await page.screenshot({
    path: "test-results/M7 Test 64 - Min-sessions gate/Check evidence/screenshot.png",
    fullPage: true,
  });
});

// ── Test 65 ────────────────────────────────────────────────────────────────
test("Test 65 — Report section position in dashboard", async ({ page }) => {
  await page.goto(DASHBOARD);

  const order = ["data", "heatmap", "report", "simulation"];
  const boxes = await Promise.all(
    order.map((s) => page.locator(`[data-dashboard-section="${s}"]`).boundingBox())
  );

  for (const box of boxes) {
    expect(box).not.toBeNull();
  }

  // Each section must appear below the previous one
  for (let i = 1; i < boxes.length; i++) {
    expect(boxes[i]!.y).toBeGreaterThan(boxes[i - 1]!.y);
  }

  await page.screenshot({
    path: "test-results/M7 Test 65 - Report section position/Check evidence/screenshot.png",
    fullPage: true,
  });
});

// ── Test 66 ────────────────────────────────────────────────────────────────
test("Test 66 — Report API: auth gate", async ({ request }) => {
  // Unauthenticated → 401 (auth check only; no real Claude call in tests)
  const res401 = await request.post("/api/checkout-heatmap/report");
  expect(res401.status()).toBe(401);
});

// ── Test 67 ────────────────────────────────────────────────────────────────
test("Test 67 — Report: min-sessions selection persists after save and reload", async ({ page }) => {
  await page.goto(DASHBOARD);
  await page.waitForLoadState("networkidle");

  // Snapshot the user's current value before the test touches anything.
  const original = await page.evaluate(() => localStorage.getItem("reportMinSessions"));

  try {
    const dropdown = page.locator("[data-dashboard-report-min-sessions]");
    await expect(dropdown).toBeVisible();

    await dropdown.selectOption("500");

    const saveBtn = page.locator("[data-dashboard-report-save]");
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();
    await expect(saveBtn).toBeDisabled(); // disabled once value is saved

    // Reload — localStorage must restore the choice.
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.locator("[data-dashboard-report-min-sessions]")).toHaveValue("500");

    await page.screenshot({
      path: "test-results/M7 Test 67 - Report min-sessions persist/Check evidence/screenshot.png",
      fullPage: true,
    });
  } finally {
    // Restore the user's original value so the test leaves no trace.
    await page.evaluate((val) => {
      if (val === null) localStorage.removeItem("reportMinSessions");
      else localStorage.setItem("reportMinSessions", val);
    }, original);
  }
});

// ── Test 69 ────────────────────────────────────────────────────────────────
test("Test 69 — Heatmap: filter selections persist across page visits", async ({ page }) => {
  await page.goto(DASHBOARD);
  await page.waitForLoadState("networkidle");

  // Snapshot the user's current value before the test touches anything.
  const original = await page.evaluate(() => localStorage.getItem("heatmap-dashboard-heatmap"));

  try {
    // Change step → delivery, type → moves, outcome → drop-offs, view → mobile.
    await page.locator("[data-dashboard-heatmap-step]").selectOption("delivery");
    await page.locator("[data-dashboard-heatmap-type]").selectOption("moves");
    await page.locator("[data-dashboard-heatmap-outcome]").selectOption("drop-offs");
    await page.locator('[data-dashboard-heatmap-view="mobile_view"]').click();

    // Wait for the useEffect to flush the view change to localStorage before navigating.
    await page.waitForFunction(
      () => {
        try {
          const val = JSON.parse(localStorage.getItem("heatmap-dashboard-heatmap") ?? "{}");
          return val?.view === "mobile_view";
        } catch { return false; }
      },
      { timeout: 2000 }
    );

    // Navigate away then back — no Save button; localStorage persists on every change.
    await page.goto("/");
    await page.goto(DASHBOARD);
    await page.waitForLoadState("networkidle");

    await expect(page.locator("[data-dashboard-heatmap-step]")).toHaveValue("delivery");
    await expect(page.locator("[data-dashboard-heatmap-type]")).toHaveValue("moves");
    await expect(page.locator("[data-dashboard-heatmap-outcome]")).toHaveValue("drop-offs");
    await expect(page.locator('[data-dashboard-heatmap-view="mobile_view"]')).toHaveAttribute("aria-pressed", "true");

    await page.screenshot({
      path: "test-results/M7 Test 69 - Heatmap filter persist/Check evidence/screenshot.png",
      fullPage: true,
    });
  } finally {
    // Restore the user's original value so the test leaves no trace.
    await page.evaluate((val) => {
      if (val === null) localStorage.removeItem("heatmap-dashboard-heatmap");
      else localStorage.setItem("heatmap-dashboard-heatmap", val);
    }, original);
  }
});

// ── Test 68 ────────────────────────────────────────────────────────────────
test("Test 68 — Generate Report button note text", async ({ page }) => {
  await page.goto(DASHBOARD);

  const dropdown = page.locator("[data-dashboard-report-min-sessions]");
  await expect(dropdown).toBeVisible();
  await dropdown.selectOption("200");

  const note = page.locator("[data-dashboard-report-note]");
  await expect(note).toBeVisible();
  const noteText = await note.textContent() ?? "";
  expect(noteText).toContain("200");

  // Note must also contain the accumulated session count
  const countText = await page.locator("[data-dashboard-report-session-count]").textContent() ?? "";
  const countMatch = countText.match(/\d[\d,]*/);
  if (countMatch) {
    const rawCount = countMatch[0].replace(/,/g, "");
    expect(noteText).toContain(rawCount);
  }

  await page.screenshot({
    path: "test-results/M7 Test 68 - Gate note text/Check evidence/screenshot.png",
  });
});
