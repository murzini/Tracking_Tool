import { test, expect, Page } from "@playwright/test";

// ─── M6 Part 4 — Dashboard shell + auth gate + Data section ──────────────────
// Test 54: Dashboard renders with valid token; wrong/missing token → blocked;
//          config Save updates the stored config; Clear-data wipes all sessions.

const TOKEN = "m6-dev-token";
const DASHBOARD_URL = `/dashboard?token=${TOKEN}`;

type Config = {
  steps?: Record<string, boolean>;
  samplingRate?: number;
};

async function saveConfig(page: Page, config: Config) {
  const res = await page.request.post("/api/checkout-heatmap/config", {
    headers: { Authorization: `Bearer ${TOKEN}` },
    data: { config },
  });
  expect(res.ok(), `saveConfig failed: ${res.status()}`).toBeTruthy();
}

async function deleteConfig(page: Page) {
  const res = await page.request.delete("/api/checkout-heatmap/config", {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  expect(res.ok()).toBeTruthy();
}

async function getConfig(page: Page): Promise<Config> {
  const res = await page.request.get("/api/checkout-heatmap/config");
  const data = await res.json();
  return data.config as Config;
}

async function getSessions(page: Page) {
  const res = await page.request.get("/api/checkout-heatmap");
  const data = await res.json();
  return data.sessions ?? [];
}

async function seedSession(page: Page) {
  // POST a minimal session directly to the store.
  const session = {
    id: `test-dash-${Date.now()}`,
    step: "personal-info",
    view: "desktop_view",
    outcome: "abandoned",
    samplingRate: 1,
    events: [{ id: "e1", type: "click", anchor: "text:name", x: 0, y: 0, t: Date.now() }],
  };
  const res = await page.request.post("/api/checkout-heatmap", { data: { session } });
  expect(res.ok()).toBeTruthy();
}

// ─── Test 54 — Dashboard auth gate + Data section + Save + Clear-data ─────────
test("Test 54 — Dashboard auth gate, Data section renders, Save updates config, Clear-data wipes sessions", async ({ page }) => {
  // Reset state.
  await deleteConfig(page);
  await page.request.delete("/api/checkout-heatmap");

  // ── 1. Wrong token → access denied ────────────────────────────────────────
  await page.goto("/dashboard?token=bad-token");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("[data-dashboard-blocked]")).toBeVisible();

  console.log("  auth gate: wrong token → blocked ✓");

  // ── 2. No token → access denied ───────────────────────────────────────────
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("[data-dashboard-blocked]")).toBeVisible();

  console.log("  auth gate: no token → blocked ✓");

  // ── 3. Valid token → dashboard renders with section headers ────────────────
  await page.goto(DASHBOARD_URL);
  await page.waitForLoadState("networkidle");

  // All four section headers must be visible (Data / Heatmap / Simulation / Report).
  const sections = page.locator("[data-dashboard-section]");
  await expect(sections.filter({ hasText: "Data" }).first()).toBeVisible();
  await expect(sections.filter({ hasText: "Heatmap" }).first()).toBeVisible();
  await expect(sections.filter({ hasText: "Simulation" }).first()).toBeVisible();
  await expect(sections.filter({ hasText: "Report" }).first()).toBeVisible();

  // Data section shows the Save button.
  await expect(page.locator("[data-dashboard-save]")).toBeVisible();

  // Open the Steps MultiSelect and verify all three checkout steps are present.
  await page.locator("[data-dashboard-steps-trigger]").click();
  for (const step of ["personal-info", "delivery", "pay"]) {
    await expect(page.locator(`[data-dashboard-step="${step}"]`)).toBeVisible();
  }

  console.log("  valid token → dashboard renders with all sections ✓");

  // ── 4. Toggle a step + Save → config API reflects the change ──────────────
  // Dropdown is already open. Toggle off "pay" (currently aria-pressed=true).
  const payOption = page.locator('[data-dashboard-step="pay"]');
  await expect(payOption).toHaveAttribute("aria-pressed", "true");
  await payOption.click();
  await expect(payOption).toHaveAttribute("aria-pressed", "false");

  // Click Save — mousedown outside MultiSelect closes the dropdown first.
  const saveBtn = page.locator("[data-dashboard-save]");
  await expect(saveBtn).not.toBeDisabled();
  await saveBtn.click();

  // Wait for the "Saved" feedback text.
  await expect(page.getByText("Saved")).toBeVisible({ timeout: 5000 });

  // Verify via API that the config was persisted.
  const afterSave = await getConfig(page);
  expect(afterSave.steps?.["pay"], "pay step disabled after Save").toBe(false);
  expect(afterSave.steps?.["personal-info"], "personal-info still enabled").toBe(true);

  console.log("  Save → config persisted: pay=false ✓");

  // Reset config so later assertions start clean.
  await deleteConfig(page);

  // Reload and verify pay is back to enabled (config restored to defaults).
  await page.goto(DASHBOARD_URL);
  await page.waitForLoadState("networkidle");
  await page.locator("[data-dashboard-steps-trigger]").click();
  await expect(page.locator('[data-dashboard-step="pay"]')).toHaveAttribute("aria-pressed", "true");

  // ── 5. Clear-data confirmation → confirm → all sessions wiped ─────────────
  // Seed a session via the API.
  await seedSession(page);
  const before = await getSessions(page);
  expect(before.length, "seeded session present before clear").toBeGreaterThanOrEqual(1);

  // Click the Clear-data button to open the confirmation pop-up.
  const clearBtn = page.locator("[data-dashboard-clear-data]");
  await clearBtn.click();

  // Confirmation overlay must appear.
  await expect(page.locator("[data-dashboard-confirm-overlay]")).toBeVisible();

  // Click "Yes, clear all".
  await page.locator("[data-dashboard-confirm-clear]").click();

  // Overlay should disappear and success feedback appears.
  await expect(page.locator("[data-dashboard-confirm-overlay]")).not.toBeVisible({ timeout: 5000 });
  await expect(page.getByText("All data cleared")).toBeVisible({ timeout: 5000 });

  // API should now return zero sessions.
  const after = await getSessions(page);
  expect(after.length, "all sessions wiped after clear-data").toBe(0);

  console.log("  Clear-data confirmation → all sessions wiped ✓");

  // Final screenshot for evidence.
  await page.screenshot({
    path: "test-results/Test 54 - Dashboard auth and Data section/Check evidence/dashboard.png",
    fullPage: true,
  });
});
