import { NextResponse } from "next/server";
import { extractBearerToken, isAuthorizedToken } from "../../../../lib/prototype/dashboardAuth";
import { resolveHeatmapSchema } from "../../../../lib/prototype/db";
import {
  bulkInsertCheckoutHeatmapSessions,
  clearCheckoutHeatmapSessions,
  countCheckoutHeatmapSessions,
} from "../../../../lib/prototype/checkoutHeatmapStore.server";
import { generateSimulatedSessions } from "../../../../lib/prototype/checkoutHeatmapSimulator";

export const runtime = "nodejs";

const simSchema = () => resolveHeatmapSchema("sim");

export async function GET() {
  const count = await countCheckoutHeatmapSessions({ schema: simSchema() });
  return NextResponse.json({ ok: true, count });
}

export async function POST(request) {
  const token = extractBearerToken(request);
  if (!isAuthorizedToken(token)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const sessions = generateSimulatedSessions();
  await bulkInsertCheckoutHeatmapSessions(sessions, { schema: simSchema() });
  return NextResponse.json({ ok: true, count: sessions.length });
}

export async function DELETE(request) {
  const token = extractBearerToken(request);
  if (!isAuthorizedToken(token)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  await clearCheckoutHeatmapSessions({ schema: simSchema() });
  return NextResponse.json({ ok: true });
}
