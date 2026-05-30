import { NextResponse } from "next/server";
import { extractBearerToken, isAuthorizedToken } from "../../../../../lib/prototype/dashboardAuth.edge";
import { getHeatmapConfig } from "../../../../../lib/prototype/heatmapConfigStore.server";
import { buildReportPrompt } from "../../../../../lib/prototype/reportPromptBuilder";
import { parseReportResponse } from "../../../../../lib/prototype/reportResponseParser";

// Step 2 of 2 of the report pipeline: the Claude narrative only.
// Runs on the Edge runtime + streaming. The work here is almost entirely I/O
// wait on Claude (20-40s+), and that idle time does NOT count against the Edge
// CPU budget — only against the wall clock, which streaming keeps alive. The
// CPU-bound aggregation already happened in the sibling /report route (Node),
// so this request spends its whole budget on Claude and never shares it with DB
// work. That separation is what keeps the pipeline under Vercel Hobby limits.
//
// Claude is called via raw fetch (not the @anthropic-ai/sdk) because the SDK
// pulls Node-only modules (child_process, crypto) into the Edge bundle and fails
// to build. fetch + manual SSE parsing is fully Edge-native.
export const runtime = "edge";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
// Sonnet for cost + speed; switch to claude-opus-4-7 post-integration with Autohero
const MODEL = "claude-sonnet-4-6";

/**
 * POST /api/checkout-heatmap/report/generate
 * Auth-gated. Body: { aggregatedData } (produced by POST /report).
 * Optional ?source=<real|sim|demo> selects the config schema.
 *
 * Streams keep-alive whitespace while Claude generates, then sends the final
 * JSON payload as the last chunk. JSON.parse ignores leading whitespace, so the
 * client reads the whole body with a single response.json() call.
 *
 * Response: { ok: true, report } | { ok: false, error } — HTTP 200 once streaming.
 */
export async function POST(request) {
  const token = extractBearerToken(request);
  if (!isAuthorizedToken(token)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let aggregatedData;
  try {
    ({ aggregatedData } = await request.json());
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  if (!aggregatedData || typeof aggregatedData !== "object") {
    return NextResponse.json({ ok: false, error: "Missing aggregatedData" }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const body = new ReadableStream({
    async start(controller) {
      // Emit a keep-alive byte immediately, before any async work, so the first
      // byte goes out near-instantly and Vercel never drops the connection while
      // config + prompt + Claude's time-to-first-token elapse.
      controller.enqueue(encoder.encode(" "));

      try {
        const config = await getHeatmapConfig();
        const { system, userMessage } = buildReportPrompt({ aggregatedData, config });

        const upstream = await fetch(ANTHROPIC_URL, {
          method: "POST",
          headers: {
            "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: MODEL,
            max_tokens: 4096,
            system,
            messages: [{ role: "user", content: userMessage }],
            stream: true,
          }),
        });

        if (!upstream.ok || !upstream.body) {
          const detail = await upstream.text().catch(() => "");
          throw new Error(`Claude API error ${upstream.status}: ${detail.slice(0, 200)}`);
        }

        // Parse the Anthropic SSE stream, accumulating text deltas. A keep-alive
        // space is forwarded to our client per delta so the connection stays warm.
        const reader = upstream.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let rawText = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? ""; // keep the trailing partial line
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            if (!data || data === "[DONE]") continue;
            try {
              const evt = JSON.parse(data);
              if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
                rawText += evt.delta.text;
                controller.enqueue(encoder.encode(" "));
              } else if (evt.type === "error") {
                throw new Error(evt.error?.message ?? "Claude stream error");
              }
            } catch (err) {
              // Re-throw genuine stream errors; ignore unparseable keep-alive lines.
              if (err instanceof Error && err.message.startsWith("Claude")) throw err;
            }
          }
        }

        // Strip markdown code fences Claude sometimes wraps around JSON
        const cleanedText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
        const report = parseReportResponse(cleanedText);

        controller.enqueue(encoder.encode(JSON.stringify({ ok: true, report })));
        controller.close();
      } catch (e) {
        controller.enqueue(
          encoder.encode(JSON.stringify({ ok: false, error: e.message ?? "Report generation failed" }))
        );
        controller.close();
      }
    },
  });

  return new Response(body, { headers: { "Content-Type": "application/json" } });
}
