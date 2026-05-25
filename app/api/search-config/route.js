import { NextResponse } from "next/server";
import { fetchCoachConfig, getSearchConfigFallback } from "../../../lib/prototype/cmsConfig";

export async function GET() {
  const coach = await fetchCoachConfig("search");
  if (coach?.data) {
    return NextResponse.json({
      ...coach.data,
      source: "coach",
      upstream: coach.source,
    });
  }

  return NextResponse.json({
    ok: true,
    source: "local-fallback",
    config: getSearchConfigFallback(),
  });
}
