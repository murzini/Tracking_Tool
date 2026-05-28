import { describe, it, expect } from 'vitest'
import { isCaptureWindowOpen } from '../../lib/prototype/captureWindowCheck.js'

// Fixed reference point: 2025-06-15 at noon local time
const JUNE_15_NOON = new Date('2025-06-15T12:00:00').getTime()

describe('isCaptureWindowOpen', () => {
  // null / undefined / empty window — all fail-open
  it('null captureWindow → open', () => {
    expect(isCaptureWindowOpen(null, JUNE_15_NOON)).toBe(true)
  })

  it('undefined captureWindow → open', () => {
    expect(isCaptureWindowOpen(undefined, JUNE_15_NOON)).toBe(true)
  })

  it('empty object (no from, no to) → open', () => {
    expect(isCaptureWindowOpen({}, JUNE_15_NOON)).toBe(true)
  })

  // from missing — open from epoch
  it('from missing, to is future → open', () => {
    expect(isCaptureWindowOpen({ to: '2025-12-31' }, JUNE_15_NOON)).toBe(true)
  })

  // to missing — open until far future
  it('to missing, from is past → open', () => {
    expect(isCaptureWindowOpen({ from: '2025-01-01' }, JUNE_15_NOON)).toBe(true)
  })

  // now before from → closed
  it('now before from → closed', () => {
    expect(isCaptureWindowOpen({ from: '2025-12-01' }, JUNE_15_NOON)).toBe(false)
  })

  // now after to → closed
  it('now after to → closed', () => {
    expect(isCaptureWindowOpen({ to: '2025-01-01' }, JUNE_15_NOON)).toBe(false)
  })

  // now within [from, to] → open
  it('now within [from, to] → open', () => {
    expect(isCaptureWindowOpen({ from: '2025-06-01', to: '2025-06-30' }, JUNE_15_NOON)).toBe(true)
  })

  // from = to (same day) — window is open for that day only
  it('from = to = today, now is noon → open', () => {
    expect(isCaptureWindowOpen({ from: '2025-06-15', to: '2025-06-15' }, JUNE_15_NOON)).toBe(true)
  })

  it('from = to = yesterday, now is today noon → closed', () => {
    expect(isCaptureWindowOpen({ from: '2025-06-14', to: '2025-06-14' }, JUNE_15_NOON)).toBe(false)
  })

  it('from = to = tomorrow, now is today noon → closed', () => {
    expect(isCaptureWindowOpen({ from: '2025-06-16', to: '2025-06-16' }, JUNE_15_NOON)).toBe(false)
  })

  // `to` is parsed as T23:59:59.999 (end-of-local-day), not midnight.
  // If `to` were T00:00:00 (midnight), noon of that day would be AFTER midnight → window
  // would incorrectly close. The correct impl extends `to` to end-of-day.
  it('to = today, now = noon → open (to extends to end-of-day, not midnight)', () => {
    expect(isCaptureWindowOpen({ to: '2025-06-15' }, JUNE_15_NOON)).toBe(true)
  })

  it('to = today, now = just before midnight → still open', () => {
    const beforeMidnight = new Date('2025-06-15T23:59:59.000').getTime()
    expect(isCaptureWindowOpen({ to: '2025-06-15' }, beforeMidnight)).toBe(true)
  })

  // invalid date strings — fail-open
  it('invalid from string → fail-open (window open)', () => {
    expect(isCaptureWindowOpen({ from: 'not-a-date' }, JUNE_15_NOON)).toBe(true)
  })

  it('invalid to string → fail-open (window open)', () => {
    expect(isCaptureWindowOpen({ to: 'invalid' }, JUNE_15_NOON)).toBe(true)
  })

  it('both from and to invalid → fail-open', () => {
    expect(isCaptureWindowOpen({ from: 'bad', to: 'worse' }, JUNE_15_NOON)).toBe(true)
  })
})
