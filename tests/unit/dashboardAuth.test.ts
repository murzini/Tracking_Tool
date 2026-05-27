import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { isAuthorizedToken, extractBearerToken } from '../../lib/prototype/dashboardAuth.js'

const ENV_KEY = 'DASHBOARD_TOKEN'

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

// Minimal request stub used by extractBearerToken tests.
function makeRequest(authHeader: string | null) {
  return { headers: { get: (name: string) => (name === 'authorization' ? authHeader : null) } }
}

describe('isAuthorizedToken', () => {
  it('returns false when DASHBOARD_TOKEN env var is not set', () => {
    expect(isAuthorizedToken('any-token')).toBe(false)
  })

  it('returns false for an empty string token', () => {
    process.env[ENV_KEY] = 'secret'
    expect(isAuthorizedToken('')).toBe(false)
  })

  it('returns false when token length differs from expected', () => {
    process.env[ENV_KEY] = 'secret'
    expect(isAuthorizedToken('short')).toBe(false)
    expect(isAuthorizedToken('a-much-longer-token-than-expected')).toBe(false)
  })

  it('returns true for exact match', () => {
    process.env[ENV_KEY] = 'm6-dev-token'
    expect(isAuthorizedToken('m6-dev-token')).toBe(true)
  })
})

describe('extractBearerToken', () => {
  it('parses a valid Bearer header and returns the token', () => {
    expect(extractBearerToken(makeRequest('Bearer my-token'))).toBe('my-token')
  })

  it('returns null when Authorization header is absent', () => {
    expect(extractBearerToken(makeRequest(null))).toBeNull()
  })

  it('returns null for a non-Bearer scheme', () => {
    expect(extractBearerToken(makeRequest('Basic dXNlcjpwYXNz'))).toBeNull()
  })

  it('returns null when Bearer has no token', () => {
    expect(extractBearerToken(makeRequest('Bearer '))).toBeNull()
  })
})
