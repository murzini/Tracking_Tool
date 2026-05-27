import { timingSafeEqual } from "crypto";

// M6 Part 2: Validates a dashboard access token against DASHBOARD_TOKEN env var.
// Uses a constant-time comparison to resist timing-based enumeration.
// Called from every auth-gated API route (config POST/DELETE, etc.).
export function isAuthorizedToken(token) {
  const expected = process.env.DASHBOARD_TOKEN;
  if (!expected || typeof token !== "string" || !token) return false;
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(token, "utf8");
    if (a.length !== b.length) {
      timingSafeEqual(a, a); // dummy run to keep timing consistent
      return false;
    }
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// Extract a Bearer token from the Authorization header.
export function extractBearerToken(request) {
  const auth = request.headers.get("authorization") ?? "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}
