"use client";

// Sampling gate. A per-SESSION decision: each session (one step visit) is sampled
// independently, because the product measures per-step conversion (entered step →
// completed step), not whole-journey funnels. The actual coin flip lives in the capture
// client (checkoutHeatmapClient.js), which decides once the runtime config rate has
// loaded; this module only resolves the effective rate. The effective `samplingRate`
// (internal here; the external host rate is M8) is stored per session for report-time
// count scaling. A query-param override is provided for tests and manual checks.
//
// M6 Part 3: the rate source is the runtime dashboard config; precedence is
// query-param override → runtime config → env → default 100%.

const SAMPLE_RATE_PARAM = "heatmapSampleRate";

function clamp01(value) {
  if (!Number.isFinite(value)) return null;
  return Math.min(1, Math.max(0, value));
}

// Resolve the effective sampling rate: query-param override → runtime config → env → default 100%.
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
