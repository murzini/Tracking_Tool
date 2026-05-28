import { describe, it, expect } from 'vitest'
import {
  getTotalSessionCount,
  getSessionsByExitReason,
  getReturnedAndCompletedCount,
  getPerStepEntryExitTotals,
  getLastActionsBeforeDropOff,
  getTimeToFirstInteraction,
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
} from '../../lib/prototype/reportAggregationTransforms.js'

const BASE_TS = '2026-05-28T10:00:00.000Z'
const T = (offsetMs: number) => new Date(new Date(BASE_TS).getTime() + offsetMs).toISOString()

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: 's1', step: 'personal-info', view: 'desktop_view', outcome: 'abandoned',
    exit_reason: 'idle', step_active_ms: 10000, step_idle_ms: 20000, duration_ms: 30000,
    visitor_id: 'v1', started_at: BASE_TS, finalized_at: T(30000), click_count: 1,
    ...overrides,
  }
}

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: 'e1', session_id: 's1', type: 'click', timestamp: T(5000),
    detail: { anchor: { id: 'text:name', type: 'text', dx: 0, dy: 0 }, x: 100, y: 200 },
    ...overrides,
  }
}

// --- getTotalSessionCount ---

describe('getTotalSessionCount', () => {
  it('empty array → 0', () => {
    expect(getTotalSessionCount([])).toBe(0)
  })
  it('single session → 1', () => {
    expect(getTotalSessionCount([session()])).toBe(1)
  })
  it('multiple sessions → correct count', () => {
    expect(getTotalSessionCount([session(), session({ id: 's2' }), session({ id: 's3' })])).toBe(3)
  })
})

// --- getSessionsByExitReason ---

describe('getSessionsByExitReason', () => {
  it('empty → all zeros', () => {
    expect(getSessionsByExitReason([])).toEqual({ idle: 0, 'left-browser': 0, 'nav-click': 0, back: 0, none: 0 })
  })
  it('counts each reason correctly', () => {
    const sessions = [
      session({ exit_reason: 'idle' }),
      session({ exit_reason: 'left-browser' }),
      session({ exit_reason: 'nav-click' }),
      session({ exit_reason: 'back' }),
      session({ exit_reason: null }),
    ]
    expect(getSessionsByExitReason(sessions)).toEqual({ idle: 1, 'left-browser': 1, 'nav-click': 1, back: 1, none: 1 })
  })
  it('null exit_reason → none bucket', () => {
    expect(getSessionsByExitReason([session({ exit_reason: null })])).toMatchObject({ none: 1 })
  })
  it('undefined exit_reason → none bucket', () => {
    const s = session()
    delete (s as any).exit_reason
    expect(getSessionsByExitReason([s])).toMatchObject({ none: 1 })
  })
  it('multiple idle sessions accumulate', () => {
    expect(getSessionsByExitReason([session({ exit_reason: 'idle' }), session({ exit_reason: 'idle' })])).toMatchObject({ idle: 2 })
  })
})

// --- getReturnedAndCompletedCount ---

describe('getReturnedAndCompletedCount', () => {
  it('empty → 0', () => {
    expect(getReturnedAndCompletedCount([])).toBe(0)
  })
  it('visitor abandoned then completed → 1', () => {
    const sessions = [
      session({ id: 's1', visitor_id: 'v1', outcome: 'abandoned' }),
      session({ id: 's2', visitor_id: 'v1', outcome: 'completed' }),
    ]
    expect(getReturnedAndCompletedCount(sessions)).toBe(1)
  })
  it('visitor only abandoned → 0', () => {
    expect(getReturnedAndCompletedCount([session({ visitor_id: 'v1', outcome: 'abandoned' })])).toBe(0)
  })
  it('visitor only completed → 0', () => {
    expect(getReturnedAndCompletedCount([session({ visitor_id: 'v1', outcome: 'completed' })])).toBe(0)
  })
  it('null visitor_id ignored', () => {
    const sessions = [
      session({ id: 's1', visitor_id: null, outcome: 'abandoned' }),
      session({ id: 's2', visitor_id: null, outcome: 'completed' }),
    ]
    expect(getReturnedAndCompletedCount(sessions)).toBe(0)
  })
  it('two qualifying visitors → 2', () => {
    const sessions = [
      session({ id: 's1', visitor_id: 'v1', outcome: 'abandoned' }),
      session({ id: 's2', visitor_id: 'v1', outcome: 'completed' }),
      session({ id: 's3', visitor_id: 'v2', outcome: 'abandoned' }),
      session({ id: 's4', visitor_id: 'v2', outcome: 'completed' }),
    ]
    expect(getReturnedAndCompletedCount(sessions)).toBe(2)
  })
})

// --- getPerStepEntryExitTotals ---

describe('getPerStepEntryExitTotals', () => {
  it('empty → empty array', () => {
    expect(getPerStepEntryExitTotals([])).toEqual([])
  })
  it('single step counts correctly', () => {
    const sessions = [
      session({ step: 'personal-info', outcome: 'abandoned' }),
      session({ id: 's2', step: 'personal-info', outcome: 'completed' }),
    ]
    const result = getPerStepEntryExitTotals(sessions)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ step: 'personal-info', total: 2, completed: 1, abandoned: 1 })
  })
  it('multiple steps separated', () => {
    const sessions = [
      session({ step: 'personal-info', outcome: 'abandoned' }),
      session({ id: 's2', step: 'payment', outcome: 'completed' }),
    ]
    const result = getPerStepEntryExitTotals(sessions)
    expect(result).toHaveLength(2)
    const stepMap = Object.fromEntries(result.map((r: any) => [r.step, r]))
    expect(stepMap['personal-info'].abandoned).toBe(1)
    expect(stepMap['payment'].completed).toBe(1)
  })
})

// --- getLastActionsBeforeDropOff ---

describe('getLastActionsBeforeDropOff', () => {
  it('no abandoned sessions → empty', () => {
    const sessions = [session({ outcome: 'completed' })]
    expect(getLastActionsBeforeDropOff(sessions, [])).toEqual([])
  })
  it('counts event types from abandoned sessions, sorted by count descending', () => {
    const sessions = [session({ id: 's1', outcome: 'abandoned' })]
    const events = [
      event({ session_id: 's1', type: 'click', timestamp: T(1000) }),
      event({ id: 'e2', session_id: 's1', type: 'field-focus', timestamp: T(2000) }),
      event({ id: 'e3', session_id: 's1', type: 'field-focus', timestamp: T(3000) }),
    ]
    const result = getLastActionsBeforeDropOff(sessions, events)
    expect(result[0].eventType).toBe('field-focus')
    expect(result[0].count).toBe(2)
    expect(result[1].eventType).toBe('click')
    expect(result[1].count).toBe(1)
  })
  it('ignores events from non-abandoned sessions', () => {
    const sessions = [session({ id: 's1', outcome: 'abandoned' }), session({ id: 's2', outcome: 'completed' })]
    const events = [
      event({ session_id: 's2', type: 'click' }),
    ]
    expect(getLastActionsBeforeDropOff(sessions, events)).toEqual([])
  })
  it('respects n limit', () => {
    const sessions = [session({ id: 's1', outcome: 'abandoned' })]
    const events = Array.from({ length: 10 }, (_, i) =>
      event({ id: `e${i}`, session_id: 's1', type: `type${i}`, timestamp: T(i * 1000) })
    )
    const result = getLastActionsBeforeDropOff(sessions, events, 3)
    expect(result.reduce((sum: number, r: any) => sum + r.count, 0)).toBeLessThanOrEqual(3)
  })
})

// --- getTimeToFirstInteraction ---

describe('getTimeToFirstInteraction', () => {
  it('no events → null', () => {
    expect(getTimeToFirstInteraction(session(), [])).toBeNull()
  })
  it('returns ms from session start to first event', () => {
    const s = session({ started_at: BASE_TS })
    const events = [event({ session_id: 's1', timestamp: T(5000) })]
    expect(getTimeToFirstInteraction(s, events)).toBe(5000)
  })
  it('picks earliest event', () => {
    const s = session({ started_at: BASE_TS })
    const events = [
      event({ id: 'e1', session_id: 's1', timestamp: T(10000) }),
      event({ id: 'e2', session_id: 's1', timestamp: T(3000) }),
    ]
    expect(getTimeToFirstInteraction(s, events)).toBe(3000)
  })
  it('ignores events from other sessions', () => {
    const s = session({ id: 's1', started_at: BASE_TS })
    const events = [event({ session_id: 's2', timestamp: T(5000) })]
    expect(getTimeToFirstInteraction(s, events)).toBeNull()
  })
})

// --- getActiveIdleTimeSplit ---

describe('getActiveIdleTimeSplit', () => {
  it('empty → zeros', () => {
    expect(getActiveIdleTimeSplit([])).toEqual({ totalActiveMs: 0, totalIdleMs: 0 })
  })
  it('sums active and idle across sessions', () => {
    const sessions = [
      session({ step_active_ms: 5000, step_idle_ms: 10000 }),
      session({ id: 's2', step_active_ms: 3000, step_idle_ms: 7000 }),
    ]
    expect(getActiveIdleTimeSplit(sessions)).toEqual({ totalActiveMs: 8000, totalIdleMs: 17000 })
  })
  it('null values treated as 0', () => {
    const s = session({ step_active_ms: null, step_idle_ms: null })
    expect(getActiveIdleTimeSplit([s])).toEqual({ totalActiveMs: 0, totalIdleMs: 0 })
  })
})

// --- getElementVisibilityDurations ---

describe('getElementVisibilityDurations', () => {
  it('no element-hidden events → empty', () => {
    expect(getElementVisibilityDurations([event({ type: 'click' })])).toEqual([])
  })
  it('sums visibleMs per anchor', () => {
    const events = [
      event({ type: 'element-hidden', detail: { anchor: { id: 'tooltip:foo', type: 'tooltip-content' }, visibleMs: 2000 } }),
      event({ id: 'e2', type: 'element-hidden', detail: { anchor: { id: 'tooltip:foo', type: 'tooltip-content' }, visibleMs: 3000 } }),
    ]
    const result = getElementVisibilityDurations(events)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ anchor: 'tooltip:foo', totalVisibleMs: 5000 })
  })
  it('sorted by totalVisibleMs descending', () => {
    const events = [
      event({ type: 'element-hidden', detail: { anchor: { id: 'a', type: 'tooltip-content' }, visibleMs: 100 } }),
      event({ id: 'e2', type: 'element-hidden', detail: { anchor: { id: 'b', type: 'tooltip-content' }, visibleMs: 500 } }),
    ]
    const result = getElementVisibilityDurations(events)
    expect(result[0].anchor).toBe('b')
  })
  it('missing anchor → skipped', () => {
    const events = [event({ type: 'element-hidden', detail: { visibleMs: 1000 } })]
    expect(getElementVisibilityDurations(events)).toEqual([])
  })
})

// --- getHesitationHotspots ---

describe('getHesitationHotspots', () => {
  it('no mouse-move events → empty', () => {
    expect(getHesitationHotspots([])).toEqual([])
  })
  it('move without click in same bucket → hotspot', () => {
    const events = [
      event({ type: 'mouse-move', detail: { x: 10, y: 10 } }),
      event({ id: 'e2', type: 'mouse-move', detail: { x: 20, y: 20 } }),
    ]
    const result = getHesitationHotspots(events)
    expect(result).toHaveLength(1)
    expect(result[0].dwellCount).toBe(2)
  })
  it('move bucket with click in same bucket → excluded', () => {
    const events = [
      event({ type: 'mouse-move', detail: { x: 10, y: 10 } }),
      event({ id: 'e2', type: 'click', detail: { anchor: { id: 'a', type: 'button' }, x: 10, y: 10 } }),
    ]
    expect(getHesitationHotspots(events)).toEqual([])
  })
  it('respects custom gridSize', () => {
    const events = [
      event({ type: 'mouse-move', detail: { x: 5, y: 5 } }),
      event({ id: 'e2', type: 'mouse-move', detail: { x: 15, y: 15 } }),
    ]
    const result = getHesitationHotspots(events, 100)
    expect(result).toHaveLength(1)
    expect(result[0].dwellCount).toBe(2)
  })
})

// --- getFieldAbandonmentRates ---

describe('getFieldAbandonmentRates', () => {
  it('no field events → empty', () => {
    expect(getFieldAbandonmentRates([session()], [])).toEqual([])
  })
  it('focus without change → 100% abandon rate', () => {
    const sessions = [session({ id: 's1' })]
    const events = [event({ session_id: 's1', type: 'field-focus', detail: { anchor: { id: 'text:email', type: 'text' } } })]
    const result = getFieldAbandonmentRates(sessions, events)
    expect(result).toHaveLength(1)
    expect(result[0].abandonRate).toBe(1)
    expect(result[0].anchor).toBe('text:email')
  })
  it('focus with change → 0% abandon rate', () => {
    const sessions = [session({ id: 's1' })]
    const events = [
      event({ id: 'e1', session_id: 's1', type: 'field-focus', detail: { anchor: { id: 'text:name', type: 'text' } } }),
      event({ id: 'e2', session_id: 's1', type: 'field-change', detail: { anchor: { id: 'text:name', type: 'text' } } }),
    ]
    const result = getFieldAbandonmentRates(sessions, events)
    expect(result[0].abandonRate).toBe(0)
  })
  it('events from other sessions ignored', () => {
    const sessions = [session({ id: 's1' })]
    const events = [event({ session_id: 's99', type: 'field-focus', detail: { anchor: { id: 'text:name', type: 'text' } } })]
    expect(getFieldAbandonmentRates(sessions, events)).toEqual([])
  })
})

// --- getValidationErrorSequences ---

describe('getValidationErrorSequences', () => {
  it('no abandoned sessions → empty', () => {
    const sessions = [session({ outcome: 'completed' })]
    const events = [event({ type: 'validation-error', detail: { anchor: 'text:name' } })]
    expect(getValidationErrorSequences(sessions, events)).toEqual([])
  })
  it('returns errors in reverse-chronological order', () => {
    const sessions = [session({ id: 's1', outcome: 'abandoned' })]
    const events = [
      event({ id: 'e1', session_id: 's1', type: 'validation-error', timestamp: T(1000), detail: { anchor: 'text:email' } }),
      event({ id: 'e2', session_id: 's1', type: 'validation-error', timestamp: T(3000), detail: { anchor: 'text:name' } }),
    ]
    const result = getValidationErrorSequences(sessions, events)
    expect(result[0].errors[0]).toBe('text:name')
    expect(result[0].errors[1]).toBe('text:email')
  })
  it('respects n limit', () => {
    const sessions = [session({ id: 's1', outcome: 'abandoned' })]
    const events = Array.from({ length: 10 }, (_, i) =>
      event({ id: `e${i}`, session_id: 's1', type: 'validation-error', timestamp: T(i * 1000), detail: { anchor: `field${i}` } })
    )
    const result = getValidationErrorSequences(sessions, events, 3)
    expect(result[0].errors.length).toBe(3)
  })
})

// --- getRageClickSessions ---

describe('getRageClickSessions', () => {
  it('no clicks → empty', () => {
    expect(getRageClickSessions([])).toEqual([])
  })
  it('3 clicks in 2s on same anchor → rage click', () => {
    const events = [
      event({ id: 'e1', session_id: 's1', type: 'click', timestamp: T(0), detail: { anchor: { id: 'btn:submit', type: 'button' } } }),
      event({ id: 'e2', session_id: 's1', type: 'click', timestamp: T(500), detail: { anchor: { id: 'btn:submit', type: 'button' } } }),
      event({ id: 'e3', session_id: 's1', type: 'click', timestamp: T(1000), detail: { anchor: { id: 'btn:submit', type: 'button' } } }),
    ]
    const result = getRageClickSessions(events)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ anchor: 'btn:submit', sessionId: 's1' })
  })
  it('3 clicks spread over >2s → no rage click', () => {
    const events = [
      event({ id: 'e1', session_id: 's1', type: 'click', timestamp: T(0), detail: { anchor: { id: 'btn:submit', type: 'button' } } }),
      event({ id: 'e2', session_id: 's1', type: 'click', timestamp: T(1500), detail: { anchor: { id: 'btn:submit', type: 'button' } } }),
      event({ id: 'e3', session_id: 's1', type: 'click', timestamp: T(3000), detail: { anchor: { id: 'btn:submit', type: 'button' } } }),
    ]
    expect(getRageClickSessions(events)).toEqual([])
  })
  it('2 clicks → not enough for rage click', () => {
    const events = [
      event({ id: 'e1', type: 'click', timestamp: T(0), detail: { anchor: { id: 'btn:x', type: 'button' } } }),
      event({ id: 'e2', type: 'click', timestamp: T(500), detail: { anchor: { id: 'btn:x', type: 'button' } } }),
    ]
    expect(getRageClickSessions(events)).toEqual([])
  })
  it('no anchorId → skipped', () => {
    const events = [
      event({ id: 'e1', type: 'click', timestamp: T(0), detail: { x: 10, y: 10 } }),
      event({ id: 'e2', type: 'click', timestamp: T(100), detail: { x: 10, y: 10 } }),
      event({ id: 'e3', type: 'click', timestamp: T(200), detail: { x: 10, y: 10 } }),
    ]
    expect(getRageClickSessions(events)).toEqual([])
  })
})

// --- getDeadClicks ---

describe('getDeadClicks', () => {
  it('no clicks → empty', () => {
    expect(getDeadClicks([])).toEqual([])
  })
  it('click on display-type anchor → dead click', () => {
    const events = [event({ type: 'click', detail: { anchor: { id: 'display:price', type: 'display' } } })]
    const result = getDeadClicks(events)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ anchor: 'display:price', count: 1 })
  })
  it('click on interactive anchor → not dead click', () => {
    const events = [event({ type: 'click', detail: { anchor: { id: 'btn:submit', type: 'button' } } })]
    expect(getDeadClicks(events)).toEqual([])
  })
  it('sorted by count descending', () => {
    const events = [
      event({ id: 'e1', type: 'click', detail: { anchor: { id: 'display:a', type: 'display' } } }),
      event({ id: 'e2', type: 'click', detail: { anchor: { id: 'display:b', type: 'display' } } }),
      event({ id: 'e3', type: 'click', detail: { anchor: { id: 'display:b', type: 'display' } } }),
    ]
    const result = getDeadClicks(events)
    expect(result[0].anchor).toBe('display:b')
    expect(result[0].count).toBe(2)
  })
})

// --- getDropOffTriggers ---

describe('getDropOffTriggers', () => {
  it('no abandoned sessions → empty', () => {
    expect(getDropOffTriggers([session({ outcome: 'completed' })], [])).toEqual([])
  })
  it('last event per abandoned session counted', () => {
    const sessions = [session({ id: 's1', outcome: 'abandoned' })]
    const events = [
      event({ id: 'e1', session_id: 's1', type: 'click', timestamp: T(1000) }),
      event({ id: 'e2', session_id: 's1', type: 'field-focus', timestamp: T(5000) }),
    ]
    const result = getDropOffTriggers(sessions, events)
    expect(result[0]).toEqual({ eventType: 'field-focus', count: 1 })
  })
  it('ignores events from non-abandoned sessions', () => {
    const sessions = [session({ id: 's1', outcome: 'abandoned' }), session({ id: 's2', outcome: 'completed' })]
    const events = [event({ session_id: 's2', type: 'click', timestamp: T(100) })]
    expect(getDropOffTriggers(sessions, events)).toEqual([])
  })
})

// --- getZeroClickDropOffCount ---

describe('getZeroClickDropOffCount', () => {
  it('empty → 0', () => {
    expect(getZeroClickDropOffCount([], [])).toBe(0)
  })
  it('abandoned with no clicks → counted', () => {
    const sessions = [session({ id: 's1', outcome: 'abandoned' })]
    expect(getZeroClickDropOffCount(sessions, [])).toBe(1)
  })
  it('abandoned with clicks → not counted', () => {
    const sessions = [session({ id: 's1', outcome: 'abandoned' })]
    const events = [event({ session_id: 's1', type: 'click' })]
    expect(getZeroClickDropOffCount(sessions, events)).toBe(0)
  })
  it('tap also counts as interaction', () => {
    const sessions = [session({ id: 's1', outcome: 'abandoned' })]
    const events = [event({ session_id: 's1', type: 'tap' })]
    expect(getZeroClickDropOffCount(sessions, events)).toBe(0)
  })
  it('completed sessions excluded from count', () => {
    const sessions = [session({ id: 's1', outcome: 'completed' })]
    expect(getZeroClickDropOffCount(sessions, [])).toBe(0)
  })
})

// --- getSessionResumeCount ---

describe('getSessionResumeCount', () => {
  it('empty sessions → 0', () => {
    expect(getSessionResumeCount([], [])).toBe(0)
  })
  it('gap >= threshold → resume counted', () => {
    const sessions = [session({ id: 's1' })]
    const events = [
      event({ id: 'e1', session_id: 's1', timestamp: T(0) }),
      event({ id: 'e2', session_id: 's1', timestamp: T(15000) }),
    ]
    expect(getSessionResumeCount(sessions, events, 10000)).toBe(1)
  })
  it('gap < threshold → not counted', () => {
    const sessions = [session({ id: 's1' })]
    const events = [
      event({ id: 'e1', session_id: 's1', timestamp: T(0) }),
      event({ id: 'e2', session_id: 's1', timestamp: T(5000) }),
    ]
    expect(getSessionResumeCount(sessions, events, 10000)).toBe(0)
  })
  it('single event → no resume', () => {
    const sessions = [session({ id: 's1' })]
    const events = [event({ session_id: 's1', timestamp: T(0) })]
    expect(getSessionResumeCount(sessions, events)).toBe(0)
  })
  it('session counted once even with multiple gaps', () => {
    const sessions = [session({ id: 's1' })]
    const events = [
      event({ id: 'e1', session_id: 's1', timestamp: T(0) }),
      event({ id: 'e2', session_id: 's1', timestamp: T(20000) }),
      event({ id: 'e3', session_id: 's1', timestamp: T(40000) }),
    ]
    expect(getSessionResumeCount(sessions, events, 10000)).toBe(1)
  })
})

// --- getReturningVisitorsStats ---

describe('getReturningVisitorsStats', () => {
  it('empty → 0 count, 0 dropOffRate', () => {
    expect(getReturningVisitorsStats([])).toEqual({ count: 0, dropOffRate: 0 })
  })
  it('no repeat visitors → 0 count', () => {
    const sessions = [session({ visitor_id: 'v1' }), session({ id: 's2', visitor_id: 'v2' })]
    expect(getReturningVisitorsStats(sessions).count).toBe(0)
  })
  it('repeat visitor counted once', () => {
    const sessions = [
      session({ id: 's1', visitor_id: 'v1', outcome: 'abandoned' }),
      session({ id: 's2', visitor_id: 'v1', outcome: 'completed' }),
    ]
    expect(getReturningVisitorsStats(sessions).count).toBe(1)
  })
  it('drop off rate is fraction of abandoned among returning sessions', () => {
    const sessions = [
      session({ id: 's1', visitor_id: 'v1', outcome: 'abandoned' }),
      session({ id: 's2', visitor_id: 'v1', outcome: 'completed' }),
    ]
    expect(getReturningVisitorsStats(sessions).dropOffRate).toBe(0.5)
  })
  it('null visitor_id sessions excluded', () => {
    const sessions = [
      session({ id: 's1', visitor_id: null, outcome: 'abandoned' }),
      session({ id: 's2', visitor_id: null, outcome: 'completed' }),
    ]
    expect(getReturningVisitorsStats(sessions).count).toBe(0)
  })
})

// --- getCompletorsVsDropOffComparison ---

describe('getCompletorsVsDropOffComparison', () => {
  it('empty → both groups have count 0 and 0 averages', () => {
    const result = getCompletorsVsDropOffComparison([])
    expect(result.completors.count).toBe(0)
    expect(result.dropOffs.count).toBe(0)
    expect(result.completors.avgDurationMs).toBe(0)
  })
  it('separates completors and dropOffs correctly', () => {
    const sessions = [
      session({ id: 's1', outcome: 'completed', duration_ms: 40000, step_active_ms: 20000, step_idle_ms: 20000 }),
      session({ id: 's2', outcome: 'abandoned', duration_ms: 10000, step_active_ms: 5000, step_idle_ms: 5000 }),
    ]
    const result = getCompletorsVsDropOffComparison(sessions)
    expect(result.completors.count).toBe(1)
    expect(result.completors.avgDurationMs).toBe(40000)
    expect(result.dropOffs.count).toBe(1)
    expect(result.dropOffs.avgDurationMs).toBe(10000)
  })
  it('averages computed correctly for multiple sessions', () => {
    const sessions = [
      session({ id: 's1', outcome: 'completed', duration_ms: 30000 }),
      session({ id: 's2', outcome: 'completed', duration_ms: 50000 }),
    ]
    const result = getCompletorsVsDropOffComparison(sessions)
    expect(result.completors.avgDurationMs).toBe(40000)
  })
})

// --- getDesktopVsMobileComparison ---

describe('getDesktopVsMobileComparison', () => {
  it('empty → both have count 0 and 0 abandonRate', () => {
    const result = getDesktopVsMobileComparison([])
    expect(result.desktop.count).toBe(0)
    expect(result.mobile.count).toBe(0)
  })
  it('separates by view correctly', () => {
    const sessions = [
      session({ id: 's1', view: 'desktop_view', outcome: 'completed' }),
      session({ id: 's2', view: 'mobile_view', outcome: 'abandoned' }),
    ]
    const result = getDesktopVsMobileComparison(sessions)
    expect(result.desktop.count).toBe(1)
    expect(result.desktop.completedCount).toBe(1)
    expect(result.mobile.count).toBe(1)
    expect(result.mobile.abandonedCount).toBe(1)
  })
  it('abandon rate calculated per group', () => {
    const sessions = [
      session({ id: 's1', view: 'mobile_view', outcome: 'abandoned' }),
      session({ id: 's2', view: 'mobile_view', outcome: 'completed' }),
    ]
    const result = getDesktopVsMobileComparison(sessions)
    expect(result.mobile.abandonRate).toBe(0.5)
    expect(result.desktop.abandonRate).toBe(0)
  })
})
