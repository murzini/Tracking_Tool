// Pure function: raw Claude text response → validated, normalised report object
// Throws ReportParseError on malformed JSON, empty input, or schema type mismatches.
// Returns a partial report (with _partial: true) when top-level sections are missing.

export class ReportParseError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'ReportParseError';
    this.details = details ?? null;
  }
}

const TOP_LEVEL_KEYS = ['intro', 'executiveSummary', 'stepAnalysis', 'conclusions'];
const VALID_PRIORITIES = new Set(['high', 'medium', 'low']);

export function parseReportResponse(rawText) {
  if (!rawText || typeof rawText !== 'string' || rawText.trim() === '') {
    throw new ReportParseError('Empty response', { rawText });
  }

  let parsed;
  try {
    parsed = JSON.parse(rawText.trim());
  } catch (e) {
    throw new ReportParseError('Malformed JSON', { parseError: e.message });
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ReportParseError('Response is not a JSON object', { type: typeof parsed });
  }

  const missingSections = TOP_LEVEL_KEYS.filter(k => !(k in parsed));
  if (missingSections.length > 0) {
    return { ...parsed, _partial: true, _missingSections: missingSections };
  }

  if (typeof parsed.intro !== 'object' || parsed.intro === null || Array.isArray(parsed.intro)) {
    throw new ReportParseError('Schema mismatch: intro must be an object', { field: 'intro' });
  }
  if (typeof parsed.executiveSummary !== 'object' || parsed.executiveSummary === null || Array.isArray(parsed.executiveSummary)) {
    throw new ReportParseError('Schema mismatch: executiveSummary must be an object', { field: 'executiveSummary' });
  }
  if (!Array.isArray(parsed.stepAnalysis)) {
    throw new ReportParseError('Schema mismatch: stepAnalysis must be an array', { field: 'stepAnalysis' });
  }
  if (typeof parsed.conclusions !== 'object' || parsed.conclusions === null || Array.isArray(parsed.conclusions)) {
    throw new ReportParseError('Schema mismatch: conclusions must be an object', { field: 'conclusions' });
  }

  const hypotheses = Array.isArray(parsed.conclusions.hypotheses)
    ? parsed.conclusions.hypotheses.map(h => ({
        hypothesis: h.hypothesis ?? '',
        priority: VALID_PRIORITIES.has(h.priority) ? h.priority : 'medium',
        draftDesign: h.draftDesign ?? null,
      }))
    : [];

  return {
    intro: parsed.intro,
    executiveSummary: parsed.executiveSummary,
    stepAnalysis: parsed.stepAnalysis,
    conclusions: { ...parsed.conclusions, hypotheses },
  };
}
