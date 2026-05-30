import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { extractBearerToken, isAuthorizedToken } from "../../../../lib/prototype/dashboardAuth";
import { readCheckoutHeatmapSessions } from "../../../../lib/prototype/checkoutHeatmapStore.server";
import { resolveHeatmapSchema } from "../../../../lib/prototype/db";
import { getHeatmapConfig } from "../../../../lib/prototype/heatmapConfigStore.server";
import { buildReportPrompt } from "../../../../lib/prototype/reportPromptBuilder";
import { parseReportResponse } from "../../../../lib/prototype/reportResponseParser";
import {
  getTotalSessionCount,
  getSessionsByExitReason,
  getReturnedAndCompletedCount,
  getPerStepEntryExitTotals,
  getLastActionsBeforeDropOff,
  getActiveIdleTimeSplit,
  getElementVisibilityDurations,
  getHesitationHotspots,
  getFieldAbandonmentRates,
  getValidationErrorSequences,
  getRageClickSessions,
  getDeadClicks,
  getDropOffTriggers,
  getZeroClickDropOffCount,
  getSessionResumeCount,
  getReturningVisitorsStats,
  getCompletorsVsDropOffComparison,
  getDesktopVsMobileComparison,
} from "../../../../lib/prototype/reportAggregationTransforms";

export const runtime = "nodejs";
// Claude Sonnet + SQL aggregation; screenshots are fetched client-side (separate route)
export const maxDuration = 60;

// Convert normalized camelCase sessions back to the snake_case DB row shape
// that the aggregation transform functions expect.
function toDbRow(s) {
  return {
    id: s.id,
    step: s.step,
    view: s.view,
    outcome: s.outcome,
    exit_reason: s.exitReason ?? null,
    visitor_id: s.visitorId ?? null,
    started_at: s.startedAt,
    finalized_at: s.finalizedAt,
    duration_ms: s.durationMs ?? null,
    step_active_ms: s.stepActiveMs ?? null,
    step_idle_ms: s.stepIdleMs ?? null,
    sampling_rate: s.samplingRate ?? 1,
  };
}

function toDbEvent(event, sessionId) {
  const { id, type, timestamp, ...detail } = event;
  return { id, session_id: sessionId, type, timestamp, detail };
}

/**
 * POST /api/checkout-heatmap/report
 * Auth-gated. Aggregates session data, captures heatmap screenshots,
 * calls Claude Opus 4.7, and returns a structured 4-section report.
 *
 * Response: { ok: true, report: { intro, executiveSummary, stepAnalysis, conclusions } }
 */
export async function POST(request) {
  const token = extractBearerToken(request);
  if (!isAuthorizedToken(token)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // --- 1. Config ---
  const config = await getHeatmapConfig();

  // --- 2. Read sessions + build DB-row format for transforms ---
  const { searchParams } = new URL(request.url);
  const schema = resolveHeatmapSchema(searchParams.get("source") ?? undefined);
  const sessions = await readCheckoutHeatmapSessions({ schema });
  const dbSessions = sessions.map(toDbRow);
  const dbEvents = sessions.flatMap(s =>
    (s.events || []).map(e => toDbEvent(e, s.id))
  );

  // --- 3. Run aggregation transforms ---
  const aggregatedData = {
    totalSessions: getTotalSessionCount(dbSessions),
    sessionsByExitReason: getSessionsByExitReason(dbSessions),
    returnedAndCompleted: getReturnedAndCompletedCount(dbSessions),
    perStepTotals: getPerStepEntryExitTotals(dbSessions),
    lastActionsBeforeDropOff: getLastActionsBeforeDropOff(dbSessions, dbEvents),
    stepAnalysis: {},
  };

  for (const step of ["personal-info", "delivery", "pay"]) {
    const stepSessions = dbSessions.filter(s => s.step === step);
    if (stepSessions.length === 0) continue;
    const stepEvents = dbEvents.filter(e =>
      stepSessions.some(s => s.id === e.session_id)
    );
    aggregatedData.stepAnalysis[step] = {
      totalSessions: stepSessions.length,
      activeIdleSplit: getActiveIdleTimeSplit(stepSessions),
      elementVisibility: getElementVisibilityDurations(stepEvents).slice(0, 15),
      hesitationHotspots: getHesitationHotspots(stepEvents).slice(0, 10),
      fieldAbandonmentRates: getFieldAbandonmentRates(stepSessions, stepEvents).slice(0, 15),
      validationErrorSequences: getValidationErrorSequences(stepSessions, stepEvents).slice(0, 10),
      rageClicks: getRageClickSessions(stepEvents).slice(0, 10),
      deadClicks: getDeadClicks(stepEvents).slice(0, 10),
      dropOffTriggers: getDropOffTriggers(stepSessions, stepEvents),
      zeroClickDropOffs: getZeroClickDropOffCount(stepSessions, stepEvents),
      sessionResumes: getSessionResumeCount(stepSessions, stepEvents),
      returningVisitors: getReturningVisitorsStats(stepSessions),
      completorsVsDropOff: getCompletorsVsDropOffComparison(stepSessions),
      desktopVsMobile: getDesktopVsMobileComparison(stepSessions),
    };
  }

  // --- 4. Call Claude (screenshots moved to client for async loading) ---
  const { system, userMessage } = buildReportPrompt({ aggregatedData, config });
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Sonnet for cost + speed; switch to claude-opus-4-7 post-integration with Autohero
  let message;
  try {
    message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: userMessage }],
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Claude API call failed" }, { status: 500 });
  }
  const rawText = message.content[0]?.text ?? "";

  // --- 5. Parse and validate response ---
  // Strip markdown code fences Claude sometimes wraps around JSON
  const cleanedText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  let report;
  try {
    report = parseReportResponse(cleanedText);
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message ?? "Failed to parse report response" }, { status: 500 });
  }

  const stepsWithData = Object.keys(aggregatedData.stepAnalysis);

  return NextResponse.json({ ok: true, report, aggregatedData, stepsWithData });
}
