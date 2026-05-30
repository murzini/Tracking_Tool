import { NextResponse } from "next/server";
import { chromium } from "playwright-core";
import chromiumBinary from "@sparticuz/chromium";
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
 *   source  — 'real' (default) | 'sim' | 'demo'
 *   sku     — product SKU for the heatmap path (default '001')
 *   steps   — string[] subset of ['personal-info','delivery','pay'] (scope-driven)
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

  const { source = "real", sku, steps } = body;
  const baseUrl = new URL(request.url).origin;
  const requests = buildScreenshotRequests({
    baseUrl,
    source,
    ...(sku ? { sku } : {}),
    ...(steps ? { steps } : {}),
  });

  // On Vercel use the serverless sparticuz binary; locally use installed Playwright chromium.
  const isVercel = !!process.env.VERCEL;
  const executablePath = isVercel ? await chromiumBinary.executablePath() : undefined;

  const browser = await chromium.launch({
    args: isVercel ? chromiumBinary.args : [],
    executablePath,
    headless: true,
  });

  async function capture(req) {
    const page = await browser.newPage();
    try {
      await page.setViewportSize(req.viewport);
      // networkidle waits for the sessions API call inside the heatmap page to complete
      await page.goto(req.url, { waitUntil: "networkidle", timeout: 20000 });
      // Confirm React has rendered the stats bar (present even when 0 sessions)
      await page.waitForSelector("[data-heatmap-session-count]", { timeout: 10000 });
      await page.waitForSelector("[data-heatmap-checkout-ready]", { timeout: 10000 });
      const buffer = await page.screenshot();
      return { step: req.step, type: req.type, screenshotBase64: buffer.toString("base64") };
    } finally {
      await page.close();
    }
  }

  let screenshots = [];
  try {
    // Capture all pages concurrently in one browser (~10–15s, was 45–90s sequential).
    const results = await Promise.allSettled(requests.map(capture));
    screenshots = results
      .filter((r) => r.status === "fulfilled")
      .map((r) => r.value);
  } finally {
    await browser.close();
  }

  return NextResponse.json({ ok: true, screenshots });
}
