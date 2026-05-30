// Edge-runtime-safe twin of dashboardAuth.js. The Node version imports
// `crypto`/`Buffer`, which don't exist on the Edge runtime, so the Edge report
// generation route (app/api/checkout-heatmap/report/generate) uses this instead.
// Behaviour is identical: constant-time comparison of the bearer token against
// DASHBOARD_TOKEN, implemented here with Web APIs only (TextEncoder).

const encoder = new TextEncoder();

// Constant-time equality. Compares over the longer length and folds the length
// difference into the result, so timing reveals neither the match nor which
// string is longer.
function constantTimeEqual(a, b) {
  const ab = encoder.encode(a);
  const bb = encoder.encode(b);
  const len = Math.max(ab.length, bb.length);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < len; i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

export function isAuthorizedToken(token) {
  const expected = process.env.DASHBOARD_TOKEN;
  if (!expected || typeof token !== "string" || !token) return false;
  return constantTimeEqual(expected, token);
}

// Extract a Bearer token from the Authorization header. Pure Web API — safe to
// share verbatim with the Node version.
export function extractBearerToken(request) {
  const auth = request.headers.get("authorization") ?? "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}
