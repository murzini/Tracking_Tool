import { NextResponse } from "next/server";
import { extractBearerToken, isAuthorizedToken } from "../../../../lib/prototype/dashboardAuth";
import { readCheckoutHeatmapSessions } from "../../../../lib/prototype/checkoutHeatmapStore.server";
import { resolveHeatmapSchema } from "../../../../lib/prototype/db";
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

// Step 1 of 2 of the report pipeline: data only (DB read + aggregation).
// CPU-bound work, so it runs on the Node runtime where the 10s budget is ample
// for pure compute. The slow Claude call is a separate Edge request
// (report/generate) so its I/O wait never shares this budget. This split is what
// lets the whole pipeline run on Vercel Hobby without hitting the 10s timeout.
export const runtime = "nodejs";

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
 * Auth-gated. Reads sessions and runs all aggregation transforms.
 * Returns the aggregated data the client needs for charts/tables AND feeds it
 * back into POST /api/checkout-heatmap/report/generate for the Claude narrative.
 *
 * Response: { ok: true, aggregatedData, stepsWithData }
 */
export async function POST(request) {
  const token = extractBearerToken(request);
  if (!isAuthorizedToken(token)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const schema = resolveHeatmapSchema(searchParams.get("source") ?? undefined);
    const sessions = await readCheckoutHeatmapSessions({ schema });
    const dbSessions = sessions.map(toDbRow);
    const dbEvents = sessions.flatMap(s =>
      (s.events || []).map(e => toDbEvent(e, s.id))
    );

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

    const stepsWithData = Object.keys(aggregatedData.stepAnalysis);

    return NextResponse.json({ ok: true, aggregatedData, stepsWithData });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message ?? "Internal server error" }, { status: 500 });
  }
}
