// Pure exit-reason resolution logic. Extracted from checkoutHeatmapClient.js
// so the priority rules can be tested without the useEffect closure.

const NAV_CLICK_WINDOW_MS = 800;

export function resolveExitReason({ sawBack = false, lastNavClickAt = null, now = Date.now(), unload = false } = {}) {
  if (sawBack) return "back";
  if (lastNavClickAt !== null && now - lastNavClickAt <= NAV_CLICK_WINDOW_MS) return "nav-click";
  return unload ? "left-browser" : null;
}
