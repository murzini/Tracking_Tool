import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { resolveSamplingRate } from '../../lib/prototype/checkoutHeatmapSampling.js'

const ENV_KEY = 'NEXT_PUBLIC_HEATMAP_SAMPLING_RATE'

let savedEnv: string | undefined

beforeEach(() => {
  savedEnv = process.env[ENV_KEY]
  delete process.env[ENV_KEY]
})

afterEach(() => {
  if (savedEnv !== undefined) {
    process.env[ENV_KEY] = savedEnv
  } else {
    delete process.env[ENV_KEY]
  }
})

describe('resolveSamplingRate', () => {
  it('defaults to 1 when no param, no configRate, no env var', () => {
    expect(resolveSamplingRate('', undefined)).toBe(1)
  })

  it('query-param override wins over configRate and env var', () => {
    process.env[ENV_KEY] = '0.9'
    expect(resolveSamplingRate('?heatmapSampleRate=0.5', 0.8)).toBe(0.5)
  })

  it('configRate is used when no query-param override', () => {
    process.env[ENV_KEY] = '0.9'
    expect(resolveSamplingRate('', 0.75)).toBe(0.75)
  })

  it('env var is used when no param and no configRate', () => {
    process.env[ENV_KEY] = '0.1'
    expect(resolveSamplingRate('', undefined)).toBe(0.1)
  })

  it('param value above 1 is clamped to 1', () => {
    expect(resolveSamplingRate('?heatmapSampleRate=2', undefined)).toBe(1)
  })

  it('param value below 0 is clamped to 0', () => {
    expect(resolveSamplingRate('?heatmapSampleRate=-1', undefined)).toBe(0)
  })

  it('absent param does not read as 0 — configRate wins', () => {
    expect(resolveSamplingRate('?otherParam=foo', 0.5)).toBe(0.5)
  })
})
