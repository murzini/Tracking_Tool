import { NextResponse } from "next/server";
import { ingestCheckoutHeatmapBatch } from "../../../../lib/prototype/checkoutHeatmapStore.server";
import { getHeatmapConfig } from "../../../../lib/prototype/heatmapConfigStore.server";

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

  // Step gate: drop the entire session if this step is disabled.
  if (config.steps?.[session.step] === false) {
    return NextResponse.json({ ok: true, gated: true });
  }

  // Sampling rate gate: drop if the config mandates 0% capture.
  if (typeof config.samplingRate === "number" && config.samplingRate <= 0) {
    return NextResponse.json({ ok: true, gated: true });
  }

  // Capture window gate: drop if the current time is outside the configured window.
  // The dashboard writes local-day strings ("YYYY-MM-DD"); a bare date parses as
  // midnight UTC, so the `to` day must be taken through its END (23:59:59.999) and
  // both bounds parsed as LOCAL time (append a time component) — otherwise a `to`
  // of "today" gates out the whole day's capture.
  const now = Date.now();
  if (config.captureWindow?.from) {
    const from = new Date(`${config.captureWindow.from}T00:00:00`).getTime();
    if (Number.isFinite(from) && now < from) return NextResponse.json({ ok: true, gated: true });
  }
  if (config.captureWindow?.to) {
    const to = new Date(`${config.captureWindow.to}T23:59:59.999`).getTime();
    if (Number.isFinite(to) && now > to) return NextResponse.json({ ok: true, gated: true });
  }

  // Event-type gate: strip events whose type is explicitly disabled in config.
  if (config.eventTypes && typeof config.eventTypes === "object") {
    events = events.filter((e) => config.eventTypes[e?.type] !== false);
  }

  const savedSession = await ingestCheckoutHeatmapBatch({ session, events });

  return NextResponse.json({
    ok: true,
    session: savedSession,
  });
}
