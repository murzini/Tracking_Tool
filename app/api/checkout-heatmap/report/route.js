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

// Edge runtime: 30s wall-clock limit (vs 10s serverless on Hobby).
// CPU time during Claude I/O wait doesn't count toward the 50ms CPU budget.
export const runtime = "edge";

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
 * Auth-gated. Aggregates session data, streams Claude generation to keep the
 * Edge connection alive, and returns a structured 4-section report as JSON.
 *
 * Uses Edge runtime + Claude streaming so the 30s wall-clock budget covers
 * the full Claude call on Vercel Hobby without requiring a Pro plan upgrade.
 *
 * Response: { ok: true, report: { intro, executiveSummary, stepAnalysis, conclusions } }
 * Error:    { ok: false, error: string } — always HTTP 200 when streaming is active.
 */
export async function POST(request) {
  const token = extractBearerToken(request);
  if (!isAuthorizedToken(token)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const encoder = new TextEncoder();

  // Return a streaming Response. Keep-alive spaces are sent per Claude token so
  // Vercel doesn't drop the idle connection. JSON.parse ignores leading whitespace,
  // so the client's existing response.json() call works without modification.
  const body = new ReadableStream({
    async start(controller) {
      try {
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

        // --- 4. Call Claude with streaming ---
        const { system, userMessage } = buildReportPrompt({ aggregatedData, config });
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

        // Sonnet for cost + speed; switch to claude-opus-4-7 post-integration with Autohero
        const claudeStream = client.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 4096,
          system,
          messages: [{ role: "user", content: userMessage }],
        });

        let rawText = "";
        for await (const event of claudeStream) {
          if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
            rawText += event.delta.text;
            // Keep-alive: one space per token — JSON.parse ignores leading whitespace
            controller.enqueue(encoder.encode(" "));
          }
        }

        // --- 5. Parse and validate response ---
        const cleanedText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
        const report = parseReportResponse(cleanedText);
        const stepsWithData = Object.keys(aggregatedData.stepAnalysis);

        controller.enqueue(
          encoder.encode(JSON.stringify({ ok: true, report, aggregatedData, stepsWithData }))
        );
        controller.close();
      } catch (e) {
        controller.enqueue(
          encoder.encode(JSON.stringify({ ok: false, error: e.message ?? "Internal server error" }))
        );
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "application/json" },
  });
}
