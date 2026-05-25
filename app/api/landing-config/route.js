import { NextResponse } from "next/server";
import { fetchCoachConfig, getLandingConfigFallback } from "../../../lib/prototype/cmsConfig";

export async function GET() {
  const coach = await fetchCoachConfig("landing");
  if (coach?.data?.ok && coach?.data?.config) {
    return NextResponse.json({
      ...coach.data,
      source: "coach",
      upstream: coach.source,
    });
  }

  return NextResponse.json({
    ok: true,
    source: "local-fallback",
    config: getLandingConfigFallback(),
  });
}
