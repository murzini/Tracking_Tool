import { NextResponse } from "next/server";
import { extractBearerToken, isAuthorizedToken } from "../../../../lib/prototype/dashboardAuth.edge";
import { buildScreenshotRequests } from "../../../../lib/prototype/reportScreenshotConfig";

export const runtime = "edge";

const SCREENSHOTONE_API_URL = "https://api.screenshotone.com/take";
const SCREENSHOT_WAIT_FOR_SELECTOR = "[data-heatmap-session-count],[data-heatmap-checkout-ready]";
const SCREENSHOT_DELAY_SECONDS = 1;
const SCREENSHOT_TIMEOUT_SECONDS = 25;
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

function trimTrailingSlash(value) {
  return value.replace(/\/$/, "");
}

function resolvePublicBaseUrl(request) {
  const explicitBaseUrl =
    process.env.SCREENSHOT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL;

  if (explicitBaseUrl) {
    return trimTrailingSlash(explicitBaseUrl);
  }

  const requestUrl = new URL(request.url);
  if (LOCAL_HOSTNAMES.has(requestUrl.hostname)) {
    if (process.env.VERCEL_URL) {
      return `https://${process.env.VERCEL_URL}`;
    }

    return "";
  }

  return requestUrl.origin;
}

function getScreenshotOneAccessKey() {
  return process.env.SCREENSHOTONE_ACCESS_KEY || process.env.SCREENSHOTONE_API_KEY || "";
}

function buildScreenshotOneUrl(req, accessKey) {
  const params = new URLSearchParams();
  params.set("access_key", accessKey);
  params.set("url", req.url);
  params.set("format", "png");
  params.set("viewport_width", String(req.viewport.width));
  params.set("viewport_height", String(req.viewport.height));
  params.set("device_scale_factor", "1");
  params.append("wait_until", "domcontentloaded");
  params.append("wait_until", "networkidle2");
  params.set("wait_for_selector", SCREENSHOT_WAIT_FOR_SELECTOR);
  params.set("wait_for_selector_algorithm", "at_least_by_count");
  params.set("error_on_selector_not_found", "true");
  params.set("delay", String(SCREENSHOT_DELAY_SECONDS));
  params.set("timeout", String(SCREENSHOT_TIMEOUT_SECONDS));
  params.set("navigation_timeout", "20");
  return `${SCREENSHOTONE_API_URL}?${params.toString()}`;
}

function arrayBufferToBase64(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

async function captureScreenshot(req, accessKey) {
  const controller = new AbortController();
  const abortHandle = setTimeout(() => controller.abort(), (SCREENSHOT_TIMEOUT_SECONDS + 5) * 1000);

  try {
    const response = await fetch(buildScreenshotOneUrl(req, accessKey), {
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ScreenshotOne ${response.status}: ${errorText.slice(0, 200)}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const errorText = await response.text();
      throw new Error(`ScreenshotOne returned JSON instead of an image: ${errorText.slice(0, 200)}`);
    }

    return {
      step: req.step,
      type: req.type,
      screenshotBase64: arrayBufferToBase64(await response.arrayBuffer()),
    };
  } finally {
    clearTimeout(abortHandle);
  }
}

/**
 * POST /api/checkout-heatmap/screenshots
 * Auth-gated. Uses ScreenshotOne to capture public heatmap pages and returns
 * the same payload shape as the former Playwright route.
 *
 * Body (all optional):
 *   source  - accepted for compatibility; screenshot capture uses demo data
 *   sku     - product SKU for the heatmap path (default '001')
 *   steps   - string[] subset of ['personal-info','delivery','pay']
 *
 * Response:
 *   { ok: true, screenshots: [{ step, type, screenshotBase64 }] }
 */
export async function POST(request) {
  const token = extractBearerToken(request);
  if (!isAuthorizedToken(token)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const accessKey = getScreenshotOneAccessKey();
  if (!accessKey) {
    return NextResponse.json(
      { ok: false, error: "SCREENSHOTONE_ACCESS_KEY is not set" },
      { status: 500 },
    );
  }

  const baseUrl = resolvePublicBaseUrl(request);
  if (!baseUrl) {
    return NextResponse.json(
      { ok: false, error: "SCREENSHOT_PUBLIC_BASE_URL is required outside Vercel" },
      { status: 500 },
    );
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    // empty or missing body - use defaults
  }

  const { sku, steps } = body;
  const requests = buildScreenshotRequests({
    baseUrl,
    source: "demo",
    ...(sku ? { sku } : {}),
    ...(steps ? { steps } : {}),
  });

  const results = await Promise.allSettled(
    requests.map((req) => captureScreenshot(req, accessKey)),
  );

  const screenshots = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      screenshots.push(result.value);
      continue;
    }

    console.error("[screenshots] capture failed", result.reason);
  }

  return NextResponse.json({ ok: true, screenshots });
}
