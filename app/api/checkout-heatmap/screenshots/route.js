import { NextResponse } from "next/server";
import { extractBearerToken, isAuthorizedToken } from "../../../../lib/prototype/dashboardAuth";
import { buildScreenshotRequests } from "../../../../lib/prototype/reportScreenshotConfig";

export const runtime = "nodejs";
// Screenshots take ~10–15s for 9 pages; Vercel Pro allows up to 60s
export const maxDuration = 60;

/**
 * POST /api/checkout-heatmap/screenshots
 * Auth-gated. Launches a headless Chromium browser, visits each heatmap URL,
 * waits for session data to load, and captures a screenshot.
 *
 * Body (all optional):
 *   source  — 'real' (default) | 'sim'
 *   sku     — product SKU for the heatmap path (default '001')
 *
 * Response:
 *   { ok: true, screenshots: [{ step, type, screenshotBase64 }] }
 */
export async function POST(request) {
  const token = extractBearerToken(request);
  if (!isAuthorizedToken(token)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    // empty or missing body — use defaults
  }

  const { source = "real", sku } = body;
  const baseUrl = new URL(request.url).origin;
  const requests = buildScreenshotRequests({ baseUrl, source, ...(sku ? { sku } : {}) });

  // Dynamic import avoids bundling issues; @playwright/test is a devDependency
  // and is only available in development / local runs, not in production Vercel deploys.
  let chromium;
  try {
    ({ chromium } = await import("@playwright/test"));
  } catch {
    return NextResponse.json(
      { ok: false, error: "Playwright not available. Run: npx playwright install chromium" },
      { status: 500 }
    );
  }

  const browser = await chromium.launch({ headless: true });
  const screenshots = [];

  try {
    for (const req of requests) {
      const page = await browser.newPage();
      await page.setViewportSize(req.viewport);
      // networkidle waits for the sessions API call inside the heatmap page to complete
      await page.goto(req.url, { waitUntil: "networkidle", timeout: 20000 });
      // Confirm React has rendered the stats bar (present even when 0 sessions)
      await page.waitForSelector("[data-heatmap-session-count]", { timeout: 10000 });
      const buffer = await page.screenshot();
      await page.close();
      screenshots.push({
        step: req.step,
        type: req.type,
        screenshotBase64: buffer.toString("base64"),
      });
    }
  } finally {
    await browser.close();
  }

  return NextResponse.json({ ok: true, screenshots });
}
