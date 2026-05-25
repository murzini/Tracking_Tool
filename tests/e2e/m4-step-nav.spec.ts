import { test, expect, Page } from "@playwright/test";

// ─── M4 Part 1 — interactive step navigation ─────────────────────────────────
// Before M4 the checkout CTA could not advance the visitor: getCheckoutHref only
// emitted the `step` query param under tour mode, so a normal-mode click landed
// back on personal-info. Part 1 makes the CTA carry the step in normal mode, so
// a single click advances each step when the mandatory fields are valid.

// Full visitor path → checkout (personal-info step).
async function navigateToCheckout(page: Page) {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /shop backpacks/i }).first().click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /open details for adventurebag 001/i }).click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /add to cart/i }).click();
  await page.waitForLoadState("networkidle");
  await page.locator('input[placeholder="Your name"]').waitFor({ state: "visible", timeout: 20000 });
}

// Fill every mandatory personal-info field. Only empty fields are typed into:
// selecting a phone code prepends it to the phone number, and selecting a street
// auto-fills house number + ZIP. Re-typing those would double the value (the
// inputs are controlled and remount on each render).
async function fillPersonalInfo(page: Page) {
  await page.locator('[data-heatmap-id="text:name"]').fill("Test Visitor");
  await page.locator('[data-heatmap-id="date:birthdate"]').fill("01.01.1990");
  await page.locator('[data-heatmap-id="tel:phone-number"]').fill("1701234567");
  await page.locator('[data-heatmap-id="dropdown:phone-code"]').selectOption("+49");
  await page.locator('[data-heatmap-id="dropdown:street"]').selectOption("Fehrbelliner Strasse");
}

// ─── Test 28 — single-click step navigation ──────────────────────────────────

test("Test 28 — a single CTA click advances each step (no double-click)", async ({ page }) => {
  await navigateToCheckout(page);
  await fillPersonalInfo(page);

  // Personal Information → Choose Delivery, one click.
  await page.locator('[data-heatmap-id="cta:choose-delivery"]').click();
  await page.waitForURL(/step=delivery/, { timeout: 10000 });
  await expect(
    page.locator('[data-heatmap-id="radio:delivery-novaposhta"]'),
    "one click must land on the delivery step"
  ).toBeVisible({ timeout: 10000 });

  // Choose Delivery → Pay & Finish, one click.
  await page.locator('[data-heatmap-id="cta:pay-finish"]').click();
  await page.waitForURL(/step=pay/, { timeout: 10000 });
  await expect(
    page.locator('[data-heatmap-id="radio:pay-card"]'),
    "one click must land on the pay step"
  ).toBeVisible({ timeout: 10000 });

  // Pay & Finish → thank-you page (success path, not a drop-off).
  await page.locator('[data-heatmap-id="cta:pay"]').click();
  await page.waitForURL(/thankyou/, { timeout: 10000 });
});

// ─── Test 28 — an invalid mandatory field blocks the advance ──────────────────

test("Test 28 — an invalid mandatory field blocks advance and shows the error", async ({ page }) => {
  await navigateToCheckout(page);

  // Click the CTA with empty mandatory fields.
  await page.locator('[data-heatmap-id="cta:choose-delivery"]').click();

  // Stays on personal-info — the delivery step must not render.
  await expect(
    page.locator('[data-heatmap-id="radio:delivery-novaposhta"]'),
    "an invalid field must keep the visitor on personal-info"
  ).toHaveCount(0);
  await expect(page).toHaveURL(/step=personal-info/);

  // A validation error is shown.
  await expect(
    page.locator("[data-field-error]").first(),
    "a validation error must be visible"
  ).toBeVisible({ timeout: 5000 });
});
