import { describe, it, expect } from 'vitest'
import { isResumableRef } from '../../lib/prototype/resumeRefMatch.js'

const BASE_MS = 1_700_000_000_000
const WINDOW_MS = 30_000

function makeRef(overrides = {}) {
  return { id: 'sess_abc', step: 'personal-info', sku: '001', lastSeen: BASE_MS, ...overrides }
}

// ---------------------------------------------------------------------------
// isResumableRef
// ---------------------------------------------------------------------------
describe('isResumableRef', () => {
  it('null ref returns false', () => {
    expect(isResumableRef(null, { step: 'personal-info', sku: '001', windowMs: WINDOW_MS, now: BASE_MS })).toBe(false)
  })

  it('ref with no id returns false', () => {
    const ref = { step: 'personal-info', sku: '001', lastSeen: BASE_MS }
    expect(isResumableRef(ref, { step: 'personal-info', sku: '001', windowMs: WINDOW_MS, now: BASE_MS })).toBe(false)
  })

  it('step mismatch returns false', () => {
    const ref = makeRef({ step: 'delivery' })
    expect(isResumableRef(ref, { step: 'personal-info', sku: '001', windowMs: WINDOW_MS, now: BASE_MS })).toBe(false)
  })

  it('sku string mismatch returns false', () => {
    const ref = makeRef({ sku: '002' })
    expect(isResumableRef(ref, { step: 'personal-info', sku: '001', windowMs: WINDOW_MS, now: BASE_MS })).toBe(false)
  })

  it('both skus null is a match', () => {
    const ref = makeRef({ sku: null })
    expect(isResumableRef(ref, { step: 'personal-info', sku: null, windowMs: WINDOW_MS, now: BASE_MS })).toBe(true)
  })

  it('ref.sku undefined treated as null matches null arg', () => {
    const ref = makeRef({ sku: undefined })
    expect(isResumableRef(ref, { step: 'personal-info', sku: null, windowMs: WINDOW_MS, now: BASE_MS })).toBe(true)
  })

  it('lastSeen NaN returns false', () => {
    const ref = makeRef({ lastSeen: NaN })
    expect(isResumableRef(ref, { step: 'personal-info', sku: '001', windowMs: WINDOW_MS, now: BASE_MS })).toBe(false)
  })

  it('expired ref (elapsed > windowMs) returns false', () => {
    const ref = makeRef({ lastSeen: BASE_MS - WINDOW_MS - 1 })
    expect(isResumableRef(ref, { step: 'personal-info', sku: '001', windowMs: WINDOW_MS, now: BASE_MS })).toBe(false)
  })

  it('ref at exact boundary (elapsed === windowMs) is still valid', () => {
    const ref = makeRef({ lastSeen: BASE_MS - WINDOW_MS })
    expect(isResumableRef(ref, { step: 'personal-info', sku: '001', windowMs: WINDOW_MS, now: BASE_MS })).toBe(true)
  })

  it('ref well within window returns true', () => {
    const ref = makeRef({ lastSeen: BASE_MS - 5_000 })
    expect(isResumableRef(ref, { step: 'personal-info', sku: '001', windowMs: WINDOW_MS, now: BASE_MS })).toBe(true)
  })
})
