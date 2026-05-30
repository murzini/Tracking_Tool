import { describe, it, expect } from 'vitest'
import {
  isReportGateMet,
  getGateNoteText,
  MIN_SESSIONS_OPTIONS,
  DEFAULT_MIN_SESSIONS,
} from '../../lib/prototype/reportGateLogic.js'

describe('isReportGateMet', () => {
  it('count equals min → gate met', () => {
    expect(isReportGateMet(100, 100)).toBe(true)
  })

  it('count exceeds min → gate met', () => {
    expect(isReportGateMet(150, 100)).toBe(true)
  })

  it('count below min → not met', () => {
    expect(isReportGateMet(99, 100)).toBe(false)
  })

  it('count 0 → not met', () => {
    expect(isReportGateMet(0, 100)).toBe(false)
  })

  it('null sessionCount → not met', () => {
    expect(isReportGateMet(null, 100)).toBe(false)
  })

  it('undefined sessionCount → not met', () => {
    expect(isReportGateMet(undefined, 100)).toBe(false)
  })

  it('null minSessions → not met', () => {
    expect(isReportGateMet(100, null)).toBe(false)
  })

  it('undefined minSessions → not met', () => {
    expect(isReportGateMet(100, undefined)).toBe(false)
  })

  it('count equals higher threshold → gate met', () => {
    expect(isReportGateMet(500, 500)).toBe(true)
  })

  it('count one below higher threshold → not met', () => {
    expect(isReportGateMet(499, 500)).toBe(false)
  })

  it('count equals max option (1000) → gate met', () => {
    expect(isReportGateMet(1000, 1000)).toBe(true)
  })

  it('count exceeds max option → gate met', () => {
    expect(isReportGateMet(9999, 1000)).toBe(true)
  })
})

describe('getGateNoteText', () => {
  it('returns correct text when gate not met', () => {
    expect(getGateNoteText(50, 100)).toBe(
      'Report requires at least 100 sessions. Currently accumulated: 50.'
    )
  })

  it('returns correct text when gate exactly met', () => {
    expect(getGateNoteText(100, 100)).toBe(
      'Report requires at least 100 sessions. Currently accumulated: 100.'
    )
  })

  it('returns correct text when gate exceeded', () => {
    expect(getGateNoteText(250, 200)).toBe(
      'Report requires at least 200 sessions. Currently accumulated: 250.'
    )
  })

  it('null sessionCount treated as 0', () => {
    expect(getGateNoteText(null, 100)).toBe(
      'Report requires at least 100 sessions. Currently accumulated: 0.'
    )
  })

  it('undefined sessionCount treated as 0', () => {
    expect(getGateNoteText(undefined, 100)).toBe(
      'Report requires at least 100 sessions. Currently accumulated: 0.'
    )
  })

  it('zero sessions shows zero', () => {
    expect(getGateNoteText(0, 500)).toBe(
      'Report requires at least 500 sessions. Currently accumulated: 0.'
    )
  })

  it('largest option (1000) formatted correctly', () => {
    expect(getGateNoteText(0, 1000)).toBe(
      'Report requires at least 1000 sessions. Currently accumulated: 0.'
    )
  })
})

describe('MIN_SESSIONS_OPTIONS', () => {
  it('contains exactly [20, 100, 200, 500, 1000]', () => {
    expect(MIN_SESSIONS_OPTIONS).toEqual([20, 100, 200, 500, 1000])
  })
})

describe('DEFAULT_MIN_SESSIONS', () => {
  it('is 100', () => {
    expect(DEFAULT_MIN_SESSIONS).toBe(100)
  })

  it('is included in MIN_SESSIONS_OPTIONS', () => {
    expect(MIN_SESSIONS_OPTIONS).toContain(DEFAULT_MIN_SESSIONS)
  })
})
