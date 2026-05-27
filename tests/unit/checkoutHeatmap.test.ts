import { describe, it, expect } from 'vitest'
import {
  resolveCheckoutHeatmapStep,
  getCheckoutHeatmapInactivityMs,
  classifyCheckoutHeatmapView,
  scaleCheckoutHeatmapRadius,
  isCheckoutHeatmapDropOffCandidate,
  computeCheckoutHeatmapStepTiming,
  normalizeCheckoutHeatmapSession,
  finalizeCheckoutHeatmapSession,
  aggregateCheckoutHeatmapClicks,
} from '../../lib/prototype/checkoutHeatmap.js'

// Fixed base timestamp used across timing tests to keep assertions deterministic.
const BASE_MS = 1_700_000_000_000

// ---------------------------------------------------------------------------
// resolveCheckoutHeatmapStep
// ---------------------------------------------------------------------------
describe('resolveCheckoutHeatmapStep', () => {
  it('returns known step unchanged', () => {
    expect(resolveCheckoutHeatmapStep('personal-info')).toBe('personal-info')
    expect(resolveCheckoutHeatmapStep('delivery')).toBe('delivery')
    expect(resolveCheckoutHeatmapStep('pay')).toBe('pay')
  })

  it('unknown step returns default', () => {
    expect(resolveCheckoutHeatmapStep('')).toBe('personal-info')
    expect(resolveCheckoutHeatmapStep(undefined)).toBe('personal-info')
    expect(resolveCheckoutHeatmapStep('bogus')).toBe('personal-info')
    expect(resolveCheckoutHeatmapStep(null)).toBe('personal-info')
  })
})

// ---------------------------------------------------------------------------
// getCheckoutHeatmapInactivityMs
// ---------------------------------------------------------------------------
describe('getCheckoutHeatmapInactivityMs', () => {
  it('automation flag returns 2000', () => {
    expect(getCheckoutHeatmapInactivityMs({ automation: true })).toBe(2000)
  })

  it('defaults to 30000', () => {
    expect(getCheckoutHeatmapInactivityMs()).toBe(30000)
    expect(getCheckoutHeatmapInactivityMs({ automation: false })).toBe(30000)
  })

  it('overrideMs wins over automation flag', () => {
    expect(getCheckoutHeatmapInactivityMs({ automation: true, overrideMs: 5000 })).toBe(5000)
  })

  it('non-positive overrideMs is ignored', () => {
    expect(getCheckoutHeatmapInactivityMs({ overrideMs: 0 })).toBe(30000)
    expect(getCheckoutHeatmapInactivityMs({ overrideMs: -1 })).toBe(30000)
    expect(getCheckoutHeatmapInactivityMs({ overrideMs: NaN })).toBe(30000)
  })
})

// ---------------------------------------------------------------------------
// classifyCheckoutHeatmapView
// ---------------------------------------------------------------------------
describe('classifyCheckoutHeatmapView', () => {
  it('wide viewport is desktop', () => {
    expect(classifyCheckoutHeatmapView(1280)).toBe('desktop_view')
    expect(classifyCheckoutHeatmapView(1024)).toBe('desktop_view') // exact breakpoint
  })

  it('narrow viewport is mobile', () => {
    expect(classifyCheckoutHeatmapView(430)).toBe('mobile_view')
    expect(classifyCheckoutHeatmapView(0)).toBe('mobile_view')
    expect(classifyCheckoutHeatmapView(undefined)).toBe('mobile_view')
  })
})

// ---------------------------------------------------------------------------
// scaleCheckoutHeatmapRadius
// ---------------------------------------------------------------------------
describe('scaleCheckoutHeatmapRadius', () => {
  it('single click returns min radius', () => {
    expect(scaleCheckoutHeatmapRadius(1, 1)).toBe(6)
  })

  it('hottest element gets max radius', () => {
    expect(scaleCheckoutHeatmapRadius(10, 10)).toBe(24)
  })

  it('proportional scaling between min and max', () => {
    const result = scaleCheckoutHeatmapRadius(5, 10)
    expect(result).toBeGreaterThanOrEqual(6)
    expect(result).toBeLessThanOrEqual(24)
    expect(result).toBe(12) // 24 * (5/10) = 12, within bounds
  })

  it('result is clamped to minRadiusPx when proportional result is below min', () => {
    expect(scaleCheckoutHeatmapRadius(1, 1000)).toBe(6) // 24 * 0.001 = 0.024 → clamped to 6
  })
})

// ---------------------------------------------------------------------------
// isCheckoutHeatmapDropOffCandidate
// ---------------------------------------------------------------------------
describe('isCheckoutHeatmapDropOffCandidate', () => {
  it('null session returns false', () => {
    expect(isCheckoutHeatmapDropOffCandidate(null)).toBe(false)
  })

  it('active session is not a candidate', () => {
    const now = BASE_MS
    const session = {
      lastInteractionAt: new Date(now - 1000).toISOString(),
      inactivityMs: 30000,
    }
    expect(isCheckoutHeatmapDropOffCandidate(session, { now })).toBe(false)
  })

  it('idle session qualifies', () => {
    const now = BASE_MS
    const session = {
      lastInteractionAt: new Date(now - 31000).toISOString(),
      inactivityMs: 30000,
    }
    expect(isCheckoutHeatmapDropOffCandidate(session, { now })).toBe(true)
  })

  it('override inactivityMs is respected', () => {
    const now = BASE_MS
    const session = {
      lastInteractionAt: new Date(now - 3000).toISOString(),
      inactivityMs: 30000,
    }
    // 3000 ms elapsed; with override threshold of 2000 ms → qualifies
    expect(isCheckoutHeatmapDropOffCandidate(session, { now, inactivityMs: 2000 })).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// computeCheckoutHeatmapStepTiming
// ---------------------------------------------------------------------------
describe('computeCheckoutHeatmapStepTiming', () => {
  it('no events – all time is idle', () => {
    const result = computeCheckoutHeatmapStepTiming([], {
      startedMs: BASE_MS,
      durationMs: 10000,
      threshold: 30000,
    })
    expect(result).toEqual({ activeMs: 0, idleMs: 10000 })
  })

  it('activeMs + idleMs equals durationMs', () => {
    const events = [
      { timestamp: new Date(BASE_MS + 1000).toISOString() },
      { timestamp: new Date(BASE_MS + 3000).toISOString() },
      { timestamp: new Date(BASE_MS + 8000).toISOString() },
    ]
    const result = computeCheckoutHeatmapStepTiming(events, {
      startedMs: BASE_MS,
      durationMs: 20000,
      threshold: 5000,
    })
    expect(result.activeMs + result.idleMs).toBe(20000)
  })

  it('gap longer than threshold contributes only threshold to active time', () => {
    const events = [{ timestamp: new Date(BASE_MS + 40000).toISOString() }]
    const result = computeCheckoutHeatmapStepTiming(events, {
      startedMs: BASE_MS,
      durationMs: 60000,
      threshold: 5000,
    })
    expect(result.activeMs).toBe(5000)
    expect(result.idleMs).toBe(55000)
  })

  it('zero duration returns zeros', () => {
    const result = computeCheckoutHeatmapStepTiming([], {
      startedMs: BASE_MS,
      durationMs: 0,
      threshold: 5000,
    })
    expect(result).toEqual({ activeMs: 0, idleMs: 0 })
  })
})

// ---------------------------------------------------------------------------
// normalizeCheckoutHeatmapSession
// ---------------------------------------------------------------------------
describe('normalizeCheckoutHeatmapSession', () => {
  it('unknown step is corrected to default', () => {
    const result = normalizeCheckoutHeatmapSession({ step: 'bad-step' })
    expect(result.step).toBe('personal-info')
  })

  it('legacy clicks array is promoted to events', () => {
    const result = normalizeCheckoutHeatmapSession({
      clicks: [{ id: 'c1', type: 'click', x: 10, y: 20, timestamp: new Date(BASE_MS).toISOString() }],
    })
    expect(result.events).toHaveLength(1)
    expect(result.events[0].type).toBe('click')
  })

  it('unknown exitReason is cleared to null', () => {
    const result = normalizeCheckoutHeatmapSession({ exitReason: 'teleported' })
    expect(result.exitReason).toBeNull()
  })

  it('missing samplingRate defaults to 1', () => {
    const result = normalizeCheckoutHeatmapSession({})
    expect(result.samplingRate).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// finalizeCheckoutHeatmapSession
// ---------------------------------------------------------------------------
describe('finalizeCheckoutHeatmapSession', () => {
  it('no outcome defaults to abandoned', () => {
    const session = { startedAt: new Date(BASE_MS).toISOString(), events: [] }
    const result = finalizeCheckoutHeatmapSession(session, { finalizedAt: BASE_MS + 1000 })
    expect(result.outcome).toBe('abandoned')
  })

  it('completed session clears exitReason', () => {
    const session = {
      startedAt: new Date(BASE_MS).toISOString(),
      exitReason: 'left-browser',
      events: [],
    }
    const result = finalizeCheckoutHeatmapSession(session, {
      finalizedAt: BASE_MS + 1000,
      outcome: 'completed',
    })
    expect(result.exitReason).toBeNull()
  })

  it('abandoned with no exitReason defaults to idle', () => {
    const session = { startedAt: new Date(BASE_MS).toISOString(), events: [] }
    const result = finalizeCheckoutHeatmapSession(session, {
      finalizedAt: BASE_MS + 1000,
      outcome: 'abandoned',
    })
    expect(result.exitReason).toBe('idle')
  })

  it('durationMs equals finalizedAt minus startedAt', () => {
    const session = { startedAt: new Date(BASE_MS).toISOString(), events: [] }
    const result = finalizeCheckoutHeatmapSession(session, { finalizedAt: BASE_MS + 5000 })
    expect(result.durationMs).toBe(5000)
  })

  it('clickCount counts only click and tap events', () => {
    const session = {
      startedAt: new Date(BASE_MS).toISOString(),
      events: [
        { id: 'c1', type: 'click', x: 0, y: 0, timestamp: new Date(BASE_MS + 100).toISOString() },
        { id: 'c2', type: 'click', x: 1, y: 1, timestamp: new Date(BASE_MS + 200).toISOString() },
        { id: 's1', type: 'scroll', depth: 50, scrollY: 100, timestamp: new Date(BASE_MS + 300).toISOString() },
        { id: 'm1', type: 'mouse-move', x: 5, y: 5, timestamp: new Date(BASE_MS + 400).toISOString() },
      ],
    }
    const result = finalizeCheckoutHeatmapSession(session, { finalizedAt: BASE_MS + 1000 })
    expect(result.clickCount).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// aggregateCheckoutHeatmapClicks
// ---------------------------------------------------------------------------
describe('aggregateCheckoutHeatmapClicks', () => {
  const ts = new Date(BASE_MS).toISOString()

  it('view filter excludes wrong-view sessions', () => {
    const sessions = [
      { view: 'desktop_view', step: 'personal-info', events: [{ id: 'd1', type: 'click', x: 100, y: 200, timestamp: ts }] },
      { view: 'mobile_view', step: 'personal-info', events: [{ id: 'm1', type: 'click', x: 50, y: 100, timestamp: ts }] },
    ]
    const result = aggregateCheckoutHeatmapClicks(sessions, { view: 'desktop_view' })
    expect(result).toHaveLength(1)
    expect(result[0].x).toBe(100)
  })

  it('step filter excludes wrong-step sessions', () => {
    const sessions = [
      { view: 'desktop_view', step: 'personal-info', events: [{ id: 'c1', type: 'click', x: 10, y: 20, timestamp: ts }] },
      { view: 'desktop_view', step: 'delivery', events: [{ id: 'c2', type: 'click', x: 30, y: 40, timestamp: ts }] },
    ]
    const result = aggregateCheckoutHeatmapClicks(sessions, { step: 'personal-info' })
    expect(result).toHaveLength(1)
    expect(result[0].x).toBe(10)
  })

  it('same-position clicks from different sessions merge into one bucket', () => {
    const sessions = [
      { view: 'desktop_view', events: [{ id: 'c1', type: 'click', x: 100, y: 200, timestamp: ts }] },
      { view: 'desktop_view', events: [{ id: 'c2', type: 'click', x: 100, y: 200, timestamp: ts }] },
    ]
    const result = aggregateCheckoutHeatmapClicks(sessions)
    expect(result).toHaveLength(1)
    expect(result[0].count).toBe(2)
  })

  it('hottest bucket gets max radius', () => {
    const sessions = Array.from({ length: 10 }, (_, i) => ({
      view: 'desktop_view',
      events: [{ id: `c${i}`, type: 'click', x: 100, y: 200, timestamp: ts }],
    }))
    const result = aggregateCheckoutHeatmapClicks(sessions)
    expect(result[0].count).toBe(10)
    expect(result[0].radius).toBe(24)
  })

  it('non-click events are not aggregated', () => {
    const sessions = [
      {
        view: 'desktop_view',
        events: [
          { id: 's1', type: 'scroll', depth: 50, scrollY: 100, timestamp: ts },
          { id: 'm1', type: 'mouse-move', x: 50, y: 50, timestamp: ts },
        ],
      },
    ]
    const result = aggregateCheckoutHeatmapClicks(sessions)
    expect(result).toHaveLength(0)
  })
})
