import { describe, it, expect } from 'vitest'
import {
  SCREENSHOT_STEPS,
  SCREENSHOT_TYPES,
  SCREENSHOT_VIEWPORT,
  SCREENSHOT_SKU,
  buildHeatmapUrl,
  buildScreenshotRequests,
} from '../../lib/prototype/reportScreenshotConfig.js'

const BASE = 'http://localhost:3000'

describe('SCREENSHOT_STEPS', () => {
  it('contains exactly personal-info, delivery, pay', () => {
    expect(SCREENSHOT_STEPS).toEqual(['personal-info', 'delivery', 'pay'])
  })
})

describe('SCREENSHOT_TYPES', () => {
  it('contains exactly clicks, moves, scrolls', () => {
    expect(SCREENSHOT_TYPES).toEqual(['clicks', 'moves', 'scrolls'])
  })
})

describe('SCREENSHOT_VIEWPORT', () => {
  it('width is at least 1280 (above desktop breakpoint 1024)', () => {
    expect(SCREENSHOT_VIEWPORT.width).toBeGreaterThanOrEqual(1280)
  })
  it('height is positive', () => {
    expect(SCREENSHOT_VIEWPORT.height).toBeGreaterThan(0)
  })
})

describe('SCREENSHOT_SKU', () => {
  it('is a non-empty string', () => {
    expect(typeof SCREENSHOT_SKU).toBe('string')
    expect(SCREENSHOT_SKU.length).toBeGreaterThan(0)
  })
})

describe('buildHeatmapUrl', () => {
  it('returns a URL starting with baseUrl/checkout/<sku>/heatmap', () => {
    const url = buildHeatmapUrl({ baseUrl: BASE, step: 'personal-info', type: 'clicks' })
    expect(url.startsWith(`${BASE}/checkout/${SCREENSHOT_SKU}/heatmap?`)).toBe(true)
  })

  it('includes step param for personal-info', () => {
    const url = buildHeatmapUrl({ baseUrl: BASE, step: 'personal-info', type: 'clicks' })
    expect(url).toContain('step=personal-info')
  })

  it('includes step param for delivery', () => {
    const url = buildHeatmapUrl({ baseUrl: BASE, step: 'delivery', type: 'moves' })
    expect(url).toContain('step=delivery')
  })

  it('includes step param for pay', () => {
    const url = buildHeatmapUrl({ baseUrl: BASE, step: 'pay', type: 'scrolls' })
    expect(url).toContain('step=pay')
  })

  it('includes type=clicks', () => {
    const url = buildHeatmapUrl({ baseUrl: BASE, step: 'personal-info', type: 'clicks' })
    expect(url).toContain('type=clicks')
  })

  it('includes type=moves', () => {
    const url = buildHeatmapUrl({ baseUrl: BASE, step: 'delivery', type: 'moves' })
    expect(url).toContain('type=moves')
  })

  it('includes type=scrolls', () => {
    const url = buildHeatmapUrl({ baseUrl: BASE, step: 'pay', type: 'scrolls' })
    expect(url).toContain('type=scrolls')
  })

  it('defaults view to desktop_view', () => {
    const url = buildHeatmapUrl({ baseUrl: BASE, step: 'personal-info', type: 'clicks' })
    expect(url).toContain('view=desktop_view')
  })

  it('accepts a custom view', () => {
    const url = buildHeatmapUrl({ baseUrl: BASE, step: 'personal-info', type: 'clicks', view: 'mobile_view' })
    expect(url).toContain('view=mobile_view')
  })

  it('defaults source to real', () => {
    const url = buildHeatmapUrl({ baseUrl: BASE, step: 'personal-info', type: 'clicks' })
    expect(url).toContain('source=real')
  })

  it('includes source=sim when specified', () => {
    const url = buildHeatmapUrl({ baseUrl: BASE, step: 'personal-info', type: 'clicks', source: 'sim' })
    expect(url).toContain('source=sim')
  })

  it('uses default SKU in the path', () => {
    const url = buildHeatmapUrl({ baseUrl: BASE, step: 'personal-info', type: 'clicks' })
    expect(url).toContain(`/checkout/${SCREENSHOT_SKU}/heatmap`)
  })

  it('uses a custom sku in the path', () => {
    const url = buildHeatmapUrl({ baseUrl: BASE, step: 'personal-info', type: 'clicks', sku: '007' })
    expect(url).toContain('/checkout/007/heatmap')
  })
})

describe('buildScreenshotRequests', () => {
  it('returns 9 requests (3 steps × 3 types)', () => {
    expect(buildScreenshotRequests({ baseUrl: BASE })).toHaveLength(9)
  })

  it('covers every step at least once', () => {
    const reqs = buildScreenshotRequests({ baseUrl: BASE })
    for (const step of SCREENSHOT_STEPS) {
      expect(reqs.some(r => r.step === step)).toBe(true)
    }
  })

  it('covers every type at least once', () => {
    const reqs = buildScreenshotRequests({ baseUrl: BASE })
    for (const type of SCREENSHOT_TYPES) {
      expect(reqs.some(r => r.type === type)).toBe(true)
    }
  })

  it('each request has step, type, url, and viewport', () => {
    const reqs = buildScreenshotRequests({ baseUrl: BASE })
    for (const r of reqs) {
      expect(r).toHaveProperty('step')
      expect(r).toHaveProperty('type')
      expect(r).toHaveProperty('url')
      expect(r).toHaveProperty('viewport')
    }
  })

  it('each request URL contains its own step and type', () => {
    const reqs = buildScreenshotRequests({ baseUrl: BASE })
    for (const r of reqs) {
      expect(r.url).toContain(`step=${r.step}`)
      expect(r.url).toContain(`type=${r.type}`)
    }
  })

  it('viewport dimensions match SCREENSHOT_VIEWPORT', () => {
    const reqs = buildScreenshotRequests({ baseUrl: BASE })
    for (const r of reqs) {
      expect(r.viewport.width).toBe(SCREENSHOT_VIEWPORT.width)
      expect(r.viewport.height).toBe(SCREENSHOT_VIEWPORT.height)
    }
  })

  it('viewport is a copy — mutating it does not change SCREENSHOT_VIEWPORT', () => {
    const reqs = buildScreenshotRequests({ baseUrl: BASE })
    const original = SCREENSHOT_VIEWPORT.width
    reqs[0].viewport.width = 9999
    expect(SCREENSHOT_VIEWPORT.width).toBe(original)
  })

  it('all URLs are unique (no duplicates)', () => {
    const reqs = buildScreenshotRequests({ baseUrl: BASE })
    const urls = reqs.map(r => r.url)
    expect(new Set(urls).size).toBe(urls.length)
  })

  it('source=sim appears in all URLs when specified', () => {
    const reqs = buildScreenshotRequests({ baseUrl: BASE, source: 'sim' })
    for (const r of reqs) {
      expect(r.url).toContain('source=sim')
    }
  })

  it('custom sku appears in all URLs', () => {
    const reqs = buildScreenshotRequests({ baseUrl: BASE, sku: '042' })
    for (const r of reqs) {
      expect(r.url).toContain('/checkout/042/heatmap')
    }
  })
})
