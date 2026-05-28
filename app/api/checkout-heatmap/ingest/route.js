import { NextResponse } from "next/server";
import { ingestCheckoutHeatmapBatch } from "../../../../lib/prototype/checkoutHeatmapStore.server";
import { getHeatmapConfig } from "../../../../lib/prototype/heatmapConfigStore.server";
import { isStepGated, isSamplingGated, isCaptureWindowGated, filterEventsByType } from "../../../../lib/prototype/ingestConfigGates";

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

  let events = Array.isArray(body?.events) ? body.events : [];

  // M6 Part 3: server-side config gate — authoritative check applied at ingest so
  // gating is reliable regardless of client-side config-fetch timing. Client-side
  // gating still runs as a performance optimization (avoids generating events).
  const config = await getHeatmapConfig();

  if (isStepGated(config, session.step)) return NextResponse.json({ ok: true, gated: true });
  if (isSamplingGated(config)) return NextResponse.json({ ok: true, gated: true });
  if (isCaptureWindowGated(config)) return NextResponse.json({ ok: true, gated: true });
  events = filterEventsByType(config, events);

  const savedSession = await ingestCheckoutHeatmapBatch({ session, events });

  return NextResponse.json({
    ok: true,
    session: savedSession,
  });
}
