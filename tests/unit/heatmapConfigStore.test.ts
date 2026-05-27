import { describe, it, expect } from 'vitest'
import { getDefaultHeatmapConfig } from '../../lib/prototype/heatmapConfigStore.server.js'

describe('getDefaultHeatmapConfig', () => {
  it('all steps are enabled by default', () => {
    const config = getDefaultHeatmapConfig()
    expect(config.steps['personal-info']).toBe(true)
    expect(config.steps['delivery']).toBe(true)
    expect(config.steps['pay']).toBe(true)
  })

  it('all event types are enabled by default', () => {
    const config = getDefaultHeatmapConfig()
    const required = ['click', 'mouse-move', 'scroll', 'field-focus', 'field-blur', 'field-change', 'validation-error', 'element-visible', 'element-hidden']
    for (const type of required) {
      expect(config.eventTypes[type], `eventTypes.${type}`).toBe(true)
    }
  })

  it('samplingRate defaults to 1', () => {
    const config = getDefaultHeatmapConfig()
    expect(config.samplingRate).toBe(1)
  })

  it('captureWindow defaults to null boundaries', () => {
    const config = getDefaultHeatmapConfig()
    expect(config.captureWindow.from).toBeNull()
    expect(config.captureWindow.to).toBeNull()
  })

  it('returns a fresh object each call — mutations do not bleed across callers', () => {
    const config1 = getDefaultHeatmapConfig()
    const config2 = getDefaultHeatmapConfig()
    config1.steps['personal-info'] = false
    expect(config2.steps['personal-info']).toBe(true)
  })
})
