import { afterEach, describe, expect, test } from 'bun:test'

import { parseCookies, setSessionCookie } from '@/lib/cookies'
import type { AppSet } from '@/lib/http'

const originalNodeEnv = process.env.NODE_ENV

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv
  delete process.env.SESSION_COOKIE_SAMESITE
})

describe('parseCookies', () => {
  test('returns cookie values by name', () => {
    const cookies = parseCookies('session=abc123; theme=dark')

    expect(cookies.get('session')).toBe('abc123')
    expect(cookies.get('theme')).toBe('dark')
  })

  test('handles missing cookie header', () => {
    expect(parseCookies(null).size).toBe(0)
  })
})

describe('setSessionCookie', () => {
  test('sets cross-site compatible session cookie in production', () => {
    process.env.NODE_ENV = 'production'
    const set = { headers: {} } as AppSet

    setSessionCookie(set, 'token')

    expect(set.headers['Set-Cookie']).toContain('SameSite=None')
    expect(set.headers['Set-Cookie']).toContain('Secure')
  })

  test('keeps lax session cookie outside production', () => {
    process.env.NODE_ENV = 'development'
    const set = { headers: {} } as AppSet

    setSessionCookie(set, 'token')

    expect(set.headers['Set-Cookie']).toContain('SameSite=Lax')
    expect(set.headers['Set-Cookie']).not.toContain('Secure')
  })

  test('forces secure cookie when SameSite is configured as none', () => {
    process.env.NODE_ENV = 'development'
    process.env.SESSION_COOKIE_SAMESITE = 'None'
    const set = { headers: {} } as AppSet

    setSessionCookie(set, 'token')

    expect(set.headers['Set-Cookie']).toContain('SameSite=None')
    expect(set.headers['Set-Cookie']).toContain('Secure')
  })
})
