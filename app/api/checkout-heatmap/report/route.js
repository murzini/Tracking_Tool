import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { extractBearerToken, isAuthorizedToken } from "../../../../lib/prototype/dashboardAuth";
import { readCheckoutHeatmapSessions } from "../../../../lib/prototype/checkoutHeatmapStore.server";
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
// Claude Opus 4.7 + 9 screenshots + SQL aggregation: budget 60s (Vercel Pro)
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
  const sessions = await readCheckoutHeatmapSessions();
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

  // --- 4. Capture heatmap screenshots ---
  const baseUrl = new URL(request.url).origin;
  let screenshots = [];
  try {
    const screenshotResp = await fetch(`${baseUrl}/api/checkout-heatmap/screenshots`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DASHBOARD_TOKEN}`,
      },
      body: JSON.stringify({}),
    });
    if (screenshotResp.ok) {
      const data = await screenshotResp.json();
      screenshots = data.screenshots ?? [];
    }
  } catch {
    // Screenshots are best-effort; the report still generates without them
  }

  // --- 5. Build prompt ---
  const { system, userMessage } = buildReportPrompt({ aggregatedData, config });

  // --- 6. Call Claude Opus 4.7 ---
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const imageBlocks = screenshots.map(s => ({
    type: "image",
    source: { type: "base64", media_type: "image/png", data: s.screenshotBase64 },
  }));

  const message = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 4096,
    system,
    messages: [
      {
        role: "user",
        content: [...imageBlocks, { type: "text", text: userMessage }],
      },
    ],
  });

  const rawText = message.content[0]?.text ?? "";

  // --- 7. Parse and validate response ---
  const report = parseReportResponse(rawText);

  return NextResponse.json({ ok: true, report });
}
