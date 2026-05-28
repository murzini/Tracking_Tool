import { describe, it, expect } from 'vitest'
import { buildReportPrompt } from '../../lib/prototype/reportPromptBuilder.js'

const TYPICAL_DATA = {
  totalSessions: 250,
  sessionsByExitReason: { idle: 120, 'left-browser': 80, 'nav-click': 30, back: 20 },
  returnedAndCompleted: 15,
  perStepTotals: [
    { step: 'personal-info', total: 250, completed: 100, abandoned: 150 },
    { step: 'delivery', total: 100, completed: 80, abandoned: 20 },
    { step: 'pay', total: 80, completed: 60, abandoned: 20 },
  ],
  lastActionsBeforeDropOff: [{ eventType: 'field-focus', count: 45 }, { eventType: 'validation-error', count: 30 }],
  stepAnalysis: {
    'personal-info': { totalSessions: 250, zeroClickDropOffs: 20, activeIdleSplit: { totalActiveMs: 50000, totalIdleMs: 200000 } },
    'delivery': { totalSessions: 100, zeroClickDropOffs: 5 },
    'pay': { totalSessions: 80, zeroClickDropOffs: 3 },
  },
}

describe('buildReportPrompt', () => {
  it('includes all four sections as instructions in the system prompt', () => {
    const { system } = buildReportPrompt({ aggregatedData: TYPICAL_DATA })
    expect(system).toMatch(/intro/i)
    expect(system).toMatch(/executiveSummary/)
    expect(system).toMatch(/stepAnalysis/)
    expect(system).toMatch(/conclusions/)
  })

  it('includes aggregated data in the user message', () => {
    const { userMessage } = buildReportPrompt({ aggregatedData: TYPICAL_DATA })
    expect(userMessage).toContain('totalSessions')
    expect(userMessage).toContain('250')
  })

  it('includes Data config context — steps enabled', () => {
    const config = { steps: { 'personal-info': true, delivery: true, pay: false } }
    const { userMessage } = buildReportPrompt({ aggregatedData: TYPICAL_DATA, config })
    expect(userMessage).toContain('personal-info')
    expect(userMessage).toContain('delivery')
  })

  it('includes Data config context — capture timeframe', () => {
    const config = { captureWindow: { from: '2026-01-01', to: '2026-05-28' } }
    const { userMessage } = buildReportPrompt({ aggregatedData: TYPICAL_DATA, config })
    expect(userMessage).toContain('2026-01-01')
    expect(userMessage).toContain('2026-05-28')
  })

  it('instructs Claude to return structured JSON in a specific schema', () => {
    const { system } = buildReportPrompt({ aggregatedData: TYPICAL_DATA })
    expect(system).toMatch(/json/i)
    expect(system).toContain('schema')
  })

  it('is well-formed with section delimiters and clear structure', () => {
    const { system, userMessage } = buildReportPrompt({ aggregatedData: TYPICAL_DATA })
    expect(system.length).toBeGreaterThan(100)
    expect(userMessage.length).toBeGreaterThan(50)
    // User message has labelled sections
    expect(userMessage).toContain('CONFIGURATION')
    expect(userMessage).toContain('AGGREGATED DATA')
  })

  it('handles empty aggregation data gracefully — does not crash', () => {
    expect(() => buildReportPrompt({ aggregatedData: {} })).not.toThrow()
    expect(() => buildReportPrompt({ aggregatedData: null })).not.toThrow()
    expect(() => buildReportPrompt({})).not.toThrow()
  })

  it('token count stays within bounds for typical input (~5k tokens sanity check)', () => {
    const { system, userMessage } = buildReportPrompt({ aggregatedData: TYPICAL_DATA })
    // 5k tokens ≈ 20k characters; typical prompt must stay well under this
    expect(system.length + userMessage.length).toBeLessThan(20000)
  })
})
