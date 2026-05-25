import { NextResponse } from "next/server";
import { queryCheckoutHeatmapSessions } from "../../../../lib/prototype/checkoutHeatmapStore.server";

export const runtime = "nodejs";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const step = searchParams.get("step") || null;
  const view = searchParams.get("view") || null;
  const from = searchParams.get("from") || null;
  const to = searchParams.get("to") || null;

  const sessions = await queryCheckoutHeatmapSessions({ step, view, from, to });
  return NextResponse.json({ ok: true, sessions });
}
