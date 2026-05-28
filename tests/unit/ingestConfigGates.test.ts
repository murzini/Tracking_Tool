import { describe, it, expect } from 'vitest'
import { isStepGated, isSamplingGated, isCaptureWindowGated, filterEventsByType } from '../../lib/prototype/ingestConfigGates.js'

// Fixed reference point: 2025-06-15 at noon local time
const JUNE_15_NOON = new Date('2025-06-15T12:00:00').getTime()

describe('isStepGated', () => {
  it('step explicitly enabled → not gated', () => {
    expect(isStepGated({ steps: { 'personal-info': true } }, 'personal-info')).toBe(false)
  })

  it('step explicitly disabled → gated', () => {
    expect(isStepGated({ steps: { 'personal-info': false } }, 'personal-info')).toBe(true)
  })

  it('step not in config → fail-open (not gated)', () => {
    expect(isStepGated({ steps: {} }, 'personal-info')).toBe(false)
  })

  it('config.steps missing → fail-open (not gated)', () => {
    expect(isStepGated({}, 'personal-info')).toBe(false)
  })

  it('null config → fail-open (not gated)', () => {
    expect(isStepGated(null, 'personal-info')).toBe(false)
  })
})

describe('isSamplingGated', () => {
  it('samplingRate 0 → gated', () => {
    expect(isSamplingGated({ samplingRate: 0 })).toBe(true)
  })

  it('samplingRate negative → gated (≤ 0)', () => {
    expect(isSamplingGated({ samplingRate: -0.1 })).toBe(true)
  })

  it('samplingRate 0.5 → not gated', () => {
    expect(isSamplingGated({ samplingRate: 0.5 })).toBe(false)
  })

  it('samplingRate 1 → not gated', () => {
    expect(isSamplingGated({ samplingRate: 1 })).toBe(false)
  })

  it('samplingRate missing → fail-open (not gated)', () => {
    expect(isSamplingGated({})).toBe(false)
  })

  it('samplingRate is string "0" → fail-open (not a number, not gated)', () => {
    expect(isSamplingGated({ samplingRate: '0' })).toBe(false)
  })
})

describe('isCaptureWindowGated', () => {
  it('no captureWindow → fail-open (not gated)', () => {
    expect(isCaptureWindowGated({}, JUNE_15_NOON)).toBe(false)
  })

  it('null config → fail-open (not gated)', () => {
    expect(isCaptureWindowGated(null, JUNE_15_NOON)).toBe(false)
  })

  it('now before from → gated', () => {
    expect(isCaptureWindowGated({ captureWindow: { from: '2025-12-01' } }, JUNE_15_NOON)).toBe(true)
  })

  it('now after to → gated', () => {
    expect(isCaptureWindowGated({ captureWindow: { to: '2025-01-01' } }, JUNE_15_NOON)).toBe(true)
  })

  it('now within [from, to] → not gated', () => {
    expect(isCaptureWindowGated({ captureWindow: { from: '2025-06-01', to: '2025-06-30' } }, JUNE_15_NOON)).toBe(false)
  })
})

describe('filterEventsByType', () => {
  it('no eventTypes in config → all events pass through', () => {
    const events = [{ type: 'click' }, { type: 'scroll' }]
    expect(filterEventsByType({}, events)).toEqual(events)
  })

  it('null eventTypes → all events pass through', () => {
    const events = [{ type: 'click' }]
    expect(filterEventsByType({ eventTypes: null }, events)).toEqual(events)
  })

  it('all types enabled → all events pass through', () => {
    const events = [{ type: 'click' }, { type: 'scroll' }]
    expect(filterEventsByType({ eventTypes: { click: true, scroll: true } }, events)).toEqual(events)
  })

  it('click disabled → click events stripped', () => {
    const events = [{ type: 'click' }, { type: 'scroll' }]
    expect(filterEventsByType({ eventTypes: { click: false, scroll: true } }, events))
      .toEqual([{ type: 'scroll' }])
  })

  it('mixed batch: click disabled, scroll enabled → only scroll passes', () => {
    const events = [{ type: 'click' }, { type: 'scroll' }, { type: 'click' }]
    expect(filterEventsByType({ eventTypes: { click: false, scroll: true } }, events))
      .toEqual([{ type: 'scroll' }])
  })

  it('unrecognized type → passes through (absent from config = not disabled)', () => {
    const events = [{ type: 'unknown-type' }]
    expect(filterEventsByType({ eventTypes: { click: false } }, events)).toEqual(events)
  })

  it('event with missing type property → passes through', () => {
    const events = [{ type: undefined }, {}]
    expect(filterEventsByType({ eventTypes: { click: false } }, events)).toEqual(events)
  })

  it('empty events array → empty array', () => {
    expect(filterEventsByType({ eventTypes: { click: false } }, [])).toEqual([])
  })
})
