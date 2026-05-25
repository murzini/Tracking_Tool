import { NextResponse } from "next/server";
import {
  appendCheckoutHeatmapSession,
  clearCheckoutHeatmapSessions,
  readCheckoutHeatmapSessions,
} from "../../../lib/prototype/checkoutHeatmapStore.server";

export const runtime = "nodejs";

export async function GET() {
  const sessions = await readCheckoutHeatmapSessions();
  return NextResponse.json({
    ok: true,
    sessions,
  });
}

export async function POST(request) {
  let body = null;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const session = body?.session || body;
  if (!session || typeof session !== "object") {
    return NextResponse.json({ ok: false, error: "Missing heatmap session." }, { status: 400 });
  }

  const savedSession = await appendCheckoutHeatmapSession(session);
  return NextResponse.json({
    ok: true,
    session: savedSession,
  });
}

export async function DELETE() {
  await clearCheckoutHeatmapSessions();
  return NextResponse.json({
    ok: true,
    sessions: [],
  });
}
