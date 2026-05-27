import { NextResponse } from "next/server";
import {
  getHeatmapConfig,
  saveHeatmapConfig,
  deleteHeatmapConfig,
} from "@/lib/prototype/heatmapConfigStore.server";
import { isAuthorizedToken, extractBearerToken } from "@/lib/prototype/dashboardAuth";

// GET is public — the capture client fetches it on every visit.
export async function GET() {
  const config = await getHeatmapConfig();
  return NextResponse.json({ config });
}

// POST is auth-gated — dashboard Save writes the config.
export async function POST(request) {
  const token = extractBearerToken(request);
  if (!isAuthorizedToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const config = await saveHeatmapConfig(body.config ?? body);
  return NextResponse.json({ ok: true, config });
}

// DELETE is auth-gated — removes the config row so GET returns defaults.
export async function DELETE(request) {
  const token = extractBearerToken(request);
  if (!isAuthorizedToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await deleteHeatmapConfig();
  return NextResponse.json({ ok: true });
}
