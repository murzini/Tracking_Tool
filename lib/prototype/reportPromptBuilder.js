// Pure function: aggregated report data + config → Claude API prompt parameters
// Returns { system, userMessage } — the route constructs the full message array with images.

const OUTPUT_SCHEMA = `{
  "intro": { "text": "<string: intro and methodology paragraph>" },
  "executiveSummary": {
    "text": "<string: narrative summary>",
    "topRecommendation": "<string: single most impactful recommendation>"
  },
  "stepAnalysis": [
    {
      "step": "<personal-info|delivery|pay>",
      "clicksAnalysis": "<string: what the clicks heatmap reveals>",
      "scrollAnalysis": "<string: what the scroll heatmap reveals>",
      "movesAnalysis": "<string: what the mouse-moves heatmap reveals>",
      "engagement": "<string: time-to-first-interaction, active/idle split, visibility, hesitation hotspots>",
      "friction": "<string: field abandonment, validation errors, rage clicks, dead clicks>",
      "dropOffPatterns": "<string: last events before drop-off, zero-click sessions, drop-off triggers>",
      "completorsVsDropOffs": "<string: how completors differ from drop-offs, desktop vs mobile breakdown>"
    }
  ],
  "conclusions": {
    "hypotheses": [
      {
        "hypothesis": "<string: testable hypothesis for improving conversion>",
        "priority": "<high|medium|low>",
        "draftDesign": "<string or null: text description of the UI/UX change to test>"
      }
    ]
  }
}`;

export function buildReportPrompt({ aggregatedData = {}, config = {} } = {}) {
  const stepsEnabled = config.steps
    ? Object.entries(config.steps).filter(([, v]) => v).map(([k]) => k)
    : ['personal-info', 'delivery', 'pay'];

  const captureFrom = config.captureWindow?.from ?? 'all time';
  const captureTo = config.captureWindow?.to ?? 'now';

  const system = `You are a senior UX analyst generating a checkout drop-off analysis report.
Analyze the provided visitor behavior data and heatmap screenshots, then produce a structured JSON report.
Respond with ONLY valid JSON — no markdown, no code fences, no explanation outside the JSON.

Required output schema:
${OUTPUT_SCHEMA}

Rules:
- All top-level fields (intro, executiveSummary, stepAnalysis, conclusions) are required.
- stepAnalysis must contain one entry per step in the data; include all sub-fields for each step.
- hypotheses must have 1–5 items ordered by priority (high first).
- priority must be exactly "high", "medium", or "low".
- draftDesign may be null if no specific UI change is suggested.
- Base all analysis on the provided data. Do not invent metrics not present in the data.`;

  const dataJson = JSON.stringify(aggregatedData ?? {}, null, 2);

  const userMessage = `Generate a checkout drop-off analysis report.

CONFIGURATION:
- Steps covered: ${stepsEnabled.join(', ')}
- Capture timeframe: ${captureFrom} → ${captureTo}

AGGREGATED DATA:
${dataJson}

Heatmap screenshots of actual visitor data (9 images: 3 steps × 3 types) are included as images in this message.
Use the screenshots to ground your heatmap analysis sections (clicksAnalysis, scrollAnalysis, movesAnalysis).

Return a single valid JSON object matching the schema. No markdown, no code fences.`;

  return { system, userMessage };
}
