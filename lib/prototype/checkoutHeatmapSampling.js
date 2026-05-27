"use client";

// M4 Part 2: visitor-level sampling gate. A per-visit decision is persisted in a
// cookie; if a visit is not sampled, capture is fully off (no session, no events).
// The internal rate defaults to 100% for the POC (decided 2026-05-22) and lives in
// code/env config — the dashboard control is M6. A query-param override is provided
// for tests and manual checks. The effective `samplingRate` (internal here; the
// external host rate is M8) is stored per session for report-time count scaling.

export const HEATMAP_SAMPLING_COOKIE = "m1.heatmap.sampled";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
const SAMPLE_RATE_PARAM = "heatmapSampleRate";

function clamp01(value) {
  if (!Number.isFinite(value)) return null;
  return Math.min(1, Math.max(0, value));
}

// Resolve the internal sampling rate: query-param override → runtime config → env → default 100%.
// M6 Part 3: configRate (from GET /api/checkout-heatmap/config) sits between the
// query-param test override and the env fallback so admins can adjust capture rate
// through the dashboard without a deploy.
export function resolveSamplingRate(search, configRate) {
  if (typeof search === "string" && search) {
    // Note: an absent param returns null and Number(null) === 0, so guard before
    // coercing — otherwise every visit without the param would read as 0%.
    const raw = new URLSearchParams(search).get(SAMPLE_RATE_PARAM);
    if (raw !== null && raw !== "") {
      const override = clamp01(Number(raw));
      if (override !== null) return override;
    }
  }
  if (Number.isFinite(configRate)) {
    const clamped = clamp01(configRate);
    if (clamped !== null) return clamped;
  }
  const envRaw = process.env.NEXT_PUBLIC_HEATMAP_SAMPLING_RATE;
  if (envRaw != null && envRaw !== "") {
    const env = clamp01(Number(envRaw));
    if (env !== null) return env;
  }
  return 1;
}

function readCookie(name) {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name, value) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${value}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
}

// Per-visit decision, persisted in a cookie so a given visitor stays in/out of the
// sample across reloads. Deterministic at the extremes (0% always off, 100% always
// on) so the gate is testable; probabilistic in between.
export function resolveSamplingDecision(search, configRate) {
  const rate = resolveSamplingRate(search, configRate);

  if (rate <= 0) {
    writeCookie(HEATMAP_SAMPLING_COOKIE, "0");
    return { sampled: false, rate: 0 };
  }
  if (rate >= 1) {
    writeCookie(HEATMAP_SAMPLING_COOKIE, "1");
    return { sampled: true, rate: 1 };
  }

  const existing = readCookie(HEATMAP_SAMPLING_COOKIE);
  if (existing === "1") return { sampled: true, rate };
  if (existing === "0") return { sampled: false, rate };

  const sampled = Math.random() < rate;
  writeCookie(HEATMAP_SAMPLING_COOKIE, sampled ? "1" : "0");
  return { sampled, rate };
}
