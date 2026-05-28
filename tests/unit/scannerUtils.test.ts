import { describe, it, expect } from 'vitest'
import { slugify, safeAttrSelector } from '../../lib/prototype/scannerUtils.js'

// ---------------------------------------------------------------------------
// slugify
// ---------------------------------------------------------------------------
describe('slugify', () => {
  it('empty string returns empty string', () => {
    expect(slugify('')).toBe('')
  })

  it('null returns empty string', () => {
    expect(slugify(null)).toBe('')
  })

  it('undefined returns empty string', () => {
    expect(slugify(undefined)).toBe('')
  })

  it('lowercases input', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('trims leading and trailing whitespace', () => {
    expect(slugify('  trimmed  ')).toBe('trimmed')
  })

  it('replaces non-alphanumeric sequences with a single hyphen', () => {
    expect(slugify('multiple   spaces')).toBe('multiple-spaces')
    expect(slugify('Name*#!')).toBe('name')
  })

  it('strips leading and trailing hyphens', () => {
    expect(slugify('--leading-trailing--')).toBe('leading-trailing')
  })

  it('slices output to 60 characters', () => {
    const result = slugify('a'.repeat(70))
    expect(result).toBe('a'.repeat(60))
    expect(result.length).toBe(60)
  })

  it('preserves digits', () => {
    expect(slugify('Mixed-Case 123')).toBe('mixed-case-123')
  })
})

// ---------------------------------------------------------------------------
// safeAttrSelector
// ---------------------------------------------------------------------------
describe('safeAttrSelector', () => {
  it('wraps id in a data-heatmap-id attribute selector', () => {
    expect(safeAttrSelector('text:name')).toBe('[data-heatmap-id="text:name"]')
  })

  it('escapes double quotes inside the id', () => {
    expect(safeAttrSelector('id-with-"quotes"')).toBe('[data-heatmap-id="id-with-\\"quotes\\""]')
  })

  it('handles empty string id', () => {
    expect(safeAttrSelector('')).toBe('[data-heatmap-id=""]')
  })

  it('colon in id does not need escaping', () => {
    expect(safeAttrSelector('cta:choose-delivery')).toBe('[data-heatmap-id="cta:choose-delivery"]')
  })
})
