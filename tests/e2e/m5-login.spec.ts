import { test, expect, Page } from "@playwright/test";

// ─── M5 — Login Step + Individual Session Attribution ─────────────────────────
// Test 45: the login step renders when the checkout is opened fresh (no prior
//          login); navigating to any checkout step without login shows login.
// Test 46: clicking Continue with an empty name shows a validation error and
//          keeps the visitor on the login step.
// Test 47: a valid name advances to personal-info and writes a UUID visitor_id to
//          localStorage; sessionStorage login gate is set.
// Test 48: sessions written after login carry the visitor_id; completing login a
//          second time (new call to mintVisitorId) mints a different UUID.

const SKU = "001";
const INACTIVITY_MS = 2000;
const VISITOR_ID_KEY = "m1.heatmap.visitorId";
const LOGIN_DONE_KEY = "m1.login.done";

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
    if (typeof flush === "function") await flush();
  });
  await waitForSessionFinalized(page);
}

// ─── Test 45 — Login step renders ─────────────────────────────────────────────

test("Test 45 — login step renders when checkout is opened without prior login", async ({ page }) => {
  // Direct navigation to ?step=login → login form renders.
  await page.goto(`/checkout/${SKU}?step=login`);
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("heading", { name: /sign in/i }), "Sign in heading must be visible").toBeVisible();
  await expect(page.locator("#login_name"), "name input must be visible").toBeVisible();
  await expect(page.getByRole("button", { name: /continue/i }), "Continue button must be visible").toBeVisible();

  // Navigating to a checkout step without login must redirect to the login step.
  await page.goto(`/checkout/${SKU}?step=personal-info`);
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByRole("heading", { name: /sign in/i }),
    "login gate must redirect ?step=personal-info → login when not logged in"
  ).toBeVisible();

  console.log("  login step renders and login gate is enforced");
});

// ─── Test 46 — Empty name blocks Continue ─────────────────────────────────────

test("Test 46 — clicking Continue with an empty name shows a validation error", async ({ page }) => {
  await page.goto(`/checkout/${SKU}?step=login`);
  await page.waitForLoadState("networkidle");
  await page.locator("#login_name").waitFor({ state: "visible", timeout: 20000 });

  // Click Continue without filling the name field.
  await page.getByRole("button", { name: /continue/i }).click();

  // A validation error must appear and the visitor must stay on login.
  const errorEl = page.locator("[data-field-error]").first();
  await expect(errorEl, "a validation error must be shown").toBeVisible({ timeout: 5000 });
  await expect(
    page.getByRole("heading", { name: /sign in/i }),
    "visitor must remain on the login step"
  ).toBeVisible();
  await expect(page).not.toHaveURL(/step=personal-info/);

  console.log("  empty name blocks Continue and shows validation error");
});

// ─── Test 47 — Valid name advances to PI and writes visitor_id ─────────────────

test("Test 47 — valid name advances to personal-info and writes visitor_id to localStorage", async ({ page }) => {
  await page.goto(`/checkout/${SKU}?step=login`);
  await page.waitForLoadState("networkidle");
  await page.locator("#login_name").waitFor({ state: "visible", timeout: 20000 });

  await page.locator("#login_name").fill("Test Visitor");
  await page.getByRole("button", { name: /continue/i }).click();

  // Visitor must advance to personal-info.
  await page.waitForURL(/step=personal-info/, { timeout: 10000 });
  await expect(
    page.locator('input[placeholder="Your name"]'),
    "personal-info form must be visible after login"
  ).toBeVisible({ timeout: 20000 });

  // visitor_id must be written to localStorage as a v4 UUID.
  const visitorId = await page.evaluate((key) => localStorage.getItem(key), VISITOR_ID_KEY);
  expect(visitorId, "visitor_id must be written to localStorage").toBeTruthy();
  expect(visitorId, "visitor_id must be a v4 UUID").toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  );

  // Login gate flag must be set in sessionStorage.
  const loginDone = await page.evaluate((key) => sessionStorage.getItem(key), LOGIN_DONE_KEY);
  expect(loginDone, "sessionStorage login gate must be '1'").toBe("1");

  console.log(`  visitor_id: ${visitorId?.slice(0, 8)}... — login gate: ${loginDone}`);
});

// ─── Test 48 — visitor_id on sessions; new login mints a new id ────────────────

test("Test 48 — sessions carry visitor_id; a second login mints a different visitor_id", async ({ page }) => {
  await clearHeatmapData(page);

  // First login → PI with m1HeatmapTest=1, record a click, flush the session.
  await page.goto(`/checkout/${SKU}?step=login&m1HeatmapTest=1`);
  await page.waitForLoadState("networkidle");
  await page.locator("#login_name").waitFor({ state: "visible", timeout: 20000 });
  await page.locator("#login_name").fill("Test Visitor");
  await page.getByRole("button", { name: /continue/i }).click();
  await page.waitForURL(/step=personal-info/, { timeout: 10000 });
  await page.locator('input[placeholder="Your name"]').waitFor({ state: "visible", timeout: 20000 });

  const visitorIdA = await page.evaluate((key) => localStorage.getItem(key), VISITOR_ID_KEY);
  expect(visitorIdA, "visitor_id must be set after first login").toBeTruthy();

  await page.locator('[data-heatmap-id="text:name"]').click();
  await page.waitForTimeout(INACTIVITY_MS + 500);
  await flushActiveHeatmapSession(page);

  // The stored session must carry the visitor_id.
  const res = await page.request.get("/api/checkout-heatmap");
  const data = await res.json();
  expect(data.sessions.length, "at least one session must be stored").toBeGreaterThanOrEqual(1);
  const session = data.sessions[0] as { visitorId?: string | null };
  expect(session.visitorId, "stored session must carry the visitor_id").toBe(visitorIdA);

  // Second login: clear the sessionStorage gate so the login form re-appears,
  // then complete login again — mintVisitorId generates a fresh UUID.
  await clearHeatmapData(page);
  await page.evaluate((key) => sessionStorage.removeItem(key), LOGIN_DONE_KEY);
  await page.goto(`/checkout/${SKU}?step=login&m1HeatmapTest=1`);
  await page.waitForLoadState("networkidle");
  await page.locator("#login_name").waitFor({ state: "visible", timeout: 20000 });
  await page.locator("#login_name").fill("Test Visitor 2");
  await page.getByRole("button", { name: /continue/i }).click();
  await page.waitForURL(/step=personal-info/, { timeout: 10000 });

  const visitorIdB = await page.evaluate((key) => localStorage.getItem(key), VISITOR_ID_KEY);
  expect(visitorIdB, "a second login must mint a new visitor_id").toBeTruthy();
  expect(visitorIdB, "second visitor_id must differ from the first").not.toBe(visitorIdA);

  console.log(`  visitorIdA=...${visitorIdA?.slice(-8)} visitorIdB=...${visitorIdB?.slice(-8)} (must differ)`);
});
