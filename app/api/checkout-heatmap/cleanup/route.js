import { NextResponse } from "next/server";
import { cleanupCheckoutHeatmapSessions } from "../../../../lib/prototype/checkoutHeatmapStore.server";

export const runtime = "nodejs";

export async function POST(request) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    // empty body is fine — fall through to defaults
  }

  let before;
  if (body.before) {
    before = body.before;
  } else {
    const ttlDays = typeof body.ttlDays === "number" ? body.ttlDays : 30;
    before = new Date(Date.now() - ttlDays * 24 * 60 * 60 * 1000).toISOString();
  }

  const deleted = await cleanupCheckoutHeatmapSessions(before);
  return NextResponse.json({ ok: true, deleted, before });
}
