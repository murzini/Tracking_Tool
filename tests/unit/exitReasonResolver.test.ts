import { describe, it, expect } from 'vitest'
import { resolveExitReason } from '../../lib/prototype/exitReasonResolver.js'

const BASE_MS = 1_700_000_000_000

// ---------------------------------------------------------------------------
// resolveExitReason
// ---------------------------------------------------------------------------
describe('resolveExitReason', () => {
  it('sawBack returns "back"', () => {
    expect(resolveExitReason({ sawBack: true, now: BASE_MS })).toBe('back')
  })

  it('sawBack takes priority over a recent navClick', () => {
    expect(resolveExitReason({ sawBack: true, lastNavClickAt: BASE_MS - 100, now: BASE_MS })).toBe('back')
  })

  it('navClick within 800ms window returns "nav-click"', () => {
    expect(resolveExitReason({ lastNavClickAt: BASE_MS - 500, now: BASE_MS })).toBe('nav-click')
  })

  it('navClick at exactly 800ms is still "nav-click" (boundary inclusive)', () => {
    expect(resolveExitReason({ lastNavClickAt: BASE_MS - 800, now: BASE_MS })).toBe('nav-click')
  })

  it('navClick at 801ms is past the window — falls through', () => {
    expect(resolveExitReason({ lastNavClickAt: BASE_MS - 801, now: BASE_MS, unload: false })).toBeNull()
  })

  it('lastNavClickAt null skips nav-click path', () => {
    expect(resolveExitReason({ lastNavClickAt: null, now: BASE_MS, unload: false })).toBeNull()
  })

  it('unload true with no signals returns "left-browser"', () => {
    expect(resolveExitReason({ unload: true, now: BASE_MS })).toBe('left-browser')
  })

  it('no signals and no unload returns null', () => {
    expect(resolveExitReason({ now: BASE_MS })).toBeNull()
  })

  it('expired navClick + unload true returns "left-browser"', () => {
    expect(resolveExitReason({ lastNavClickAt: BASE_MS - 5000, now: BASE_MS, unload: true })).toBe('left-browser')
  })
})
