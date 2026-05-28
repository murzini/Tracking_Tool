// Pure matching logic for session resume refs. Extracted from checkoutHeatmapResume.js
// so the decision rules can be tested without a localStorage dependency.

export function isResumableRef(ref, { step, sku, windowMs, now = Date.now() } = {}) {
  if (!ref || !ref.id) return false;
  if (ref.step !== step) return false;
  if ((ref.sku ?? null) !== (sku ?? null)) return false;
  const lastSeen = Number(ref.lastSeen);
  if (!Number.isFinite(lastSeen)) return false;
  if (now - lastSeen > windowMs) return false;
  return true;
}
