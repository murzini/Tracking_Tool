// M4 Part 5 — session resume across a leave/return gap.
//
// A step visit is not a brand-new session every time. The active session id is
// persisted in localStorage with a "last seen" timestamp; if the visitor returns
// to the same step+sku within the configurable window X (30s normal / 2s
// autotest), the SAME session resumes (events keep appending to that id). After X
// it is a fresh start. localStorage (not sessionStorage) so the id survives a
// full tab close + reopen, and a left-at timestamp so the window can be judged.
//
// The window is deliberately short for the POC; production windows are >24h.

const RESUME_KEY = "m1.checkoutHeatmap.resume";

function readRef() {
  try {
    const raw = window.localStorage.getItem(RESUME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

// Return the resumable session id if a stored ref matches this step+sku and the
// visitor returned within `windowMs` of when they were last seen; else null.
export function loadResumableSessionId({ step, sku, windowMs, now = Date.now() } = {}) {
  const ref = readRef();
  if (!ref || !ref.id) return null;
  if (ref.step !== step) return null;
  if ((ref.sku ?? null) !== (sku ?? null)) return null;
  const lastSeen = Number(ref.lastSeen);
  if (!Number.isFinite(lastSeen)) return null;
  if (now - lastSeen > windowMs) return null;
  return String(ref.id);
}

// Persist (or refresh) the resume ref. Called on mount and as the session stays
// alive, so `lastSeen` tracks the last moment the visitor was here.
export function persistResumeRef({ id, step, sku, now = Date.now() } = {}) {
  if (!id) return;
  try {
    window.localStorage.setItem(RESUME_KEY, JSON.stringify({ id, step, sku: sku ?? null, lastSeen: now }));
  } catch {}
}

export function clearResumeRef() {
  try {
    window.localStorage.removeItem(RESUME_KEY);
  } catch {}
}
