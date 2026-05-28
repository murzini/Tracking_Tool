import { describe, it, expect } from 'vitest'
import { parseReportResponse, ReportParseError } from '../../lib/prototype/reportResponseParser.js'

const VALID_REPORT = {
  intro: { text: 'This report covers three checkout steps during a two-week capture window.' },
  executiveSummary: { text: 'Drop-off rate is 62%.', topRecommendation: 'Simplify the Personal Information form.' },
  stepAnalysis: [
    {
      step: 'personal-info',
      clicksAnalysis: 'Most clicks on the CTA and name field.',
      scrollAnalysis: 'Scroll depth drops sharply below the fold.',
      movesAnalysis: 'High hesitation near the date field.',
      engagement: 'Average time-to-first-interaction: 3s.',
      friction: 'Name and birthdate fields have the highest abandonment.',
      dropOffPatterns: 'Most sessions drop off after a validation error.',
      completorsVsDropOffs: 'Completors spend 40% more active time.',
    },
  ],
  conclusions: {
    hypotheses: [
      { hypothesis: 'Removing the birthdate field reduces drop-off.', priority: 'high', draftDesign: 'Remove birthdate from PI form.' },
      { hypothesis: 'Inline field hints reduce validation errors.', priority: 'medium', draftDesign: null },
    ],
  },
}

function json(obj: unknown) { return JSON.stringify(obj) }

describe('parseReportResponse', () => {
  it('valid response with all 4 sections returns a parsed report object', () => {
    const result = parseReportResponse(json(VALID_REPORT))
    expect(result.intro).toBeDefined()
    expect(result.executiveSummary).toBeDefined()
    expect(Array.isArray(result.stepAnalysis)).toBe(true)
    expect(result.conclusions).toBeDefined()
  })

  it('response missing one section returns partial report with _partial flag and _missingSections', () => {
    const partial = { ...VALID_REPORT }
    const { stepAnalysis: _removed, ...withoutStepAnalysis } = partial
    const result = parseReportResponse(json(withoutStepAnalysis))
    expect(result._partial).toBe(true)
    expect(result._missingSections).toContain('stepAnalysis')
  })

  it('malformed JSON throws a typed ReportParseError with details', () => {
    expect(() => parseReportResponse('not json {')).toThrow(ReportParseError)
    try {
      parseReportResponse('{bad json}')
    } catch (e) {
      expect(e).toBeInstanceOf(ReportParseError)
      expect((e as ReportParseError).details).toBeDefined()
    }
  })

  it('JSON valid but schema mismatched — stepAnalysis as string throws ReportParseError', () => {
    const bad = { ...VALID_REPORT, stepAnalysis: 'not an array' }
    expect(() => parseReportResponse(json(bad))).toThrow(ReportParseError)
  })

  it('JSON valid but schema mismatched — intro as array throws ReportParseError', () => {
    const bad = { ...VALID_REPORT, intro: ['wrong type'] }
    expect(() => parseReportResponse(json(bad))).toThrow(ReportParseError)
  })

  it('extra fields in response are ignored gracefully', () => {
    const withExtra = { ...VALID_REPORT, extraField: 'ignored', anotherExtra: 42 }
    expect(() => parseReportResponse(json(withExtra))).not.toThrow()
  })

  it('empty response throws a typed ReportParseError', () => {
    expect(() => parseReportResponse('')).toThrow(ReportParseError)
    expect(() => parseReportResponse('   ')).toThrow(ReportParseError)
    expect(() => parseReportResponse(null as unknown as string)).toThrow(ReportParseError)
  })

  it('valid hypotheses array parses correctly with priority levels', () => {
    const result = parseReportResponse(json(VALID_REPORT))
    const { hypotheses } = result.conclusions
    expect(hypotheses).toHaveLength(2)
    expect(hypotheses[0].priority).toBe('high')
    expect(hypotheses[1].priority).toBe('medium')
    expect(hypotheses[0].hypothesis).toBe('Removing the birthdate field reduces drop-off.')
  })

  it('hypothesis with no draftDesign is handled — normalised to null', () => {
    const withNullDesign = {
      ...VALID_REPORT,
      conclusions: {
        hypotheses: [{ hypothesis: 'Test.', priority: 'low' }],
      },
    }
    const result = parseReportResponse(json(withNullDesign))
    expect(result.conclusions.hypotheses[0].draftDesign).toBeNull()
  })
})
