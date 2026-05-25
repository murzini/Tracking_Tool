import { NextResponse } from "next/server";
import { sweepCheckoutHeatmapSessions } from "../../../../lib/prototype/checkoutHeatmapStore.server";

export const runtime = "nodejs";

// M4 Part 5: lazy/derived finalize. There is no always-on runtime (local dev;
// Vercel deferred to M8), so a closed tab's drop-off cannot be finalized by a
// timer. This endpoint sweeps sessions whose grace window (X) has elapsed with
// no completion and marks them `abandoned`. Tests and manual checks call it to
// force the derived state; in production it would run opportunistically on read.
export async function POST(request) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    // empty body is fine — sweep with the current time
  }

  const now = typeof body.now === "number" ? body.now : Date.now();
  const force = body.force === true;
  const finalized = await sweepCheckoutHeatmapSessions({ now, force });
  return NextResponse.json({ ok: true, finalized });
}
