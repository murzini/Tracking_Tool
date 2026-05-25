import { NextResponse } from "next/server";
import { ingestCheckoutHeatmapBatch } from "../../../../lib/prototype/checkoutHeatmapStore.server";

export const runtime = "nodejs";

// M4 Part 2: batched ingestion endpoint. The capture client streams events here
// in batches (interval/size flush via fetch, unload flush via sendBeacon) instead
// of one finalize-only POST. Body: { session, events: [...] }. The legacy
// POST /api/checkout-heatmap write path is kept for back-compat but is no longer
// called by the client.
export async function POST(request) {
  let body = null;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const session = body?.session;
  if (!session || typeof session !== "object") {
    return NextResponse.json({ ok: false, error: "Missing heatmap session." }, { status: 400 });
  }

  const events = Array.isArray(body?.events) ? body.events : [];
  const savedSession = await ingestCheckoutHeatmapBatch({ session, events });

  return NextResponse.json({
    ok: true,
    session: savedSession,
  });
}
