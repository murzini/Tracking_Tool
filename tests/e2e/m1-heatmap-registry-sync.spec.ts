import { test, expect, Page } from "@playwright/test";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "../..");

// ─── helpers ────────────────────────────────────────────────────────────────

type RegistryEntry = { id: string; attrValue: string; steps: string[] };

// Each registry entry is one line; active entries have "removedAt: null".
// Parses the id, the data-heatmap-id selector value, and the steps the anchor
// renders on, for the auto-maintained scanner snapshot in checkoutHeatmapRegistry.js.
function extractActiveRegistryEntries(): RegistryEntry[] {
  const source = fs.readFileSync(
    path.join(ROOT, "lib/prototype/checkoutHeatmapRegistry.js"),
    "utf-8"
  );
  const result: RegistryEntry[] = [];
  for (const line of source.split("\n")) {
    if (!line.includes("removedAt: null")) continue;
    const idMatch = line.match(/id:\s*"([^"]+)"/);
    const attrMatch = line.match(/\[data-heatmap-id="([^"]+)"\]/);
    const stepsMatch = line.match(/steps:\s*\[([^\]]*)\]/);
    if (idMatch && attrMatch && stepsMatch) {
      const steps = stepsMatch[1]
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
      result.push({ id: idMatch[1], attrValue: attrMatch[1], steps });
    }
  }
  return result;
}

// A sentinel rendered uniquely on each step confirms the heatmap rendered the
// requested step before the DOM is scanned.
const STEP_SENTINELS: Record<string, string> = {
  "personal-info": "cta:choose-delivery",
  delivery: "radio:delivery-novaposhta",
  pay: "radio:pay-card",
};

async function readRenderedHeatmapIds(page: Page, step: string): Promise<string[]> {
  await page.goto(`/checkout/001/heatmap?step=${step}`);
  await page.waitForLoadState("networkidle");
  await page
    .locator(`[data-heatmap-id="${STEP_SENTINELS[step]}"]`)
    .waitFor({ state: "attached", timeout: 20000 });

  return page.evaluate(() =>
    [...new Set(
      Array.from(document.querySelectorAll("[data-heatmap-id]"))
        .map((el) => el.getAttribute("data-heatmap-id"))
        .filter((v): v is string => v !== null)
    )]
  );
}

// ─── Test 11 ─────────────────────────────────────────────────────────────────

// Structural integrity check, not a behavioral flow test. It navigates directly
// to each step's heatmap (an admin view, not a visitor path) and reads all
// rendered data-heatmap-id attributes to verify the registry↔DOM parity holds
// per step. The heatmap page renders CheckoutFlow fully expanded (accordions
// open, tooltip visible, validation shown, pay panels forced open), so every
// tracked element for the step is present in the DOM.

test("Test 11 — registry sync between rendered DOM and CHECKOUT_ELEMENT_REGISTRY across all steps", async ({ page }) => {
  const activeEntries = extractActiveRegistryEntries();
  expect(activeEntries.length, "registry must parse at least one active entry").toBeGreaterThan(0);

  for (const step of ["personal-info", "delivery", "pay"]) {
    const expectedForStep = activeEntries.filter((e) => e.steps.includes(step));
    const expectedAttrValues = new Set(expectedForStep.map((e) => e.attrValue));

    const domIds = await readRenderedHeatmapIds(page, step);
    const domIdSet = new Set(domIds);

    // Direction 1: every rendered data-heatmap-id must have an active registry
    // entry that lists this step.
    const missingFromRegistry = domIds.filter((id) => !expectedAttrValues.has(id));
    expect(
      missingFromRegistry,
      `[${step}] rendered data-heatmap-id attributes with no active registry entry for this step:\n${missingFromRegistry.join("\n")}`
    ).toHaveLength(0);

    // Direction 2: every active registry entry for this step must be rendered.
    const missingFromDom = expectedForStep.filter((e) => !domIdSet.has(e.attrValue));
    expect(
      missingFromDom.map((e) => `${e.id} ([data-heatmap-id="${e.attrValue}"])`),
      `[${step}] active registry entries for this step not rendered in the heatmap DOM:\n${missingFromDom.map((e) => e.id).join("\n")}`
    ).toHaveLength(0);
  }
});
