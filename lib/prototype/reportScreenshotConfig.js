// Viewport for screenshot capture — 1280px guarantees desktop_view (breakpoint 1024px)
export const SCREENSHOT_VIEWPORT = { width: 1280, height: 900 };

// The 3 checkout steps captured for each report
export const SCREENSHOT_STEPS = ['personal-info', 'delivery', 'pay'];

// The 3 heatmap overlay types captured per step
export const SCREENSHOT_TYPES = ['clicks', 'moves', 'scrolls'];

// Default product SKU used for the heatmap URL path
export const SCREENSHOT_SKU = '001';

/**
 * Builds the full heatmap URL for a single screenshot.
 *   baseUrl  — origin, e.g. 'http://localhost:3000'
 *   step     — 'personal-info' | 'delivery' | 'pay'
 *   type     — 'clicks' | 'moves' | 'scrolls'
 *   view     — 'desktop_view' (default) | 'mobile_view'
 *   source   — 'real' (default) | 'sim'
 *   sku      — product slug in the heatmap path (default SCREENSHOT_SKU)
 */
export function buildHeatmapUrl({
  baseUrl,
  step,
  type = 'clicks',
  view = 'desktop_view',
  source = 'real',
  sku = SCREENSHOT_SKU,
}) {
  const params = new URLSearchParams({ step, view, type, source });
  return `${baseUrl}/checkout/${sku}/heatmap?${params.toString()}`;
}

/**
 * Returns the full list of screenshot request configs for one report run.
 * Produces 9 items: 3 steps × 3 types, each with the correct URL and viewport.
 * Output shape: { step, type, url, viewport: { width, height } }[]
 */
export function buildScreenshotRequests({
  baseUrl,
  source = 'real',
  sku = SCREENSHOT_SKU,
} = {}) {
  const requests = [];
  for (const step of SCREENSHOT_STEPS) {
    for (const type of SCREENSHOT_TYPES) {
      requests.push({
        step,
        type,
        url: buildHeatmapUrl({ baseUrl, step, type, source, sku }),
        viewport: { ...SCREENSHOT_VIEWPORT },
      });
    }
  }
  return requests;
}
