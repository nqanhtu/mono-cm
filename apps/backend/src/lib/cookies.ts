import type { AppSet } from '@/lib/http'

export function parseCookies(cookieHeader?: string | null) {
  const cookies = new Map<string, string>()
  if (!cookieHeader) return cookies

  for (const item of cookieHeader.split(';')) {
    const [rawName, ...rawValue] = item.trim().split('=')
    if (!rawName) continue
    cookies.set(rawName, decodeURIComponent(rawValue.join('=')))
  }

  return cookies
}

export function getCookie(headers: Headers, name: string) {
  return parseCookies(headers.get('cookie')).get(name)
}

export function appendSetCookie(set: AppSet, value: string) {
  set.headers['Set-Cookie'] = value
}

function sessionCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production'
  const sameSite = process.env.SESSION_COOKIE_SAMESITE || (isProduction ? 'None' : 'Lax')
  const secure = isProduction || sameSite.toLowerCase() === 'none'
  return { secure, sameSite }
}

export function setSessionCookie(set: AppSet, session: string, expires = new Date(Date.now() + 8 * 60 * 60 * 1000)) {
  const { secure, sameSite } = sessionCookieOptions()
  const parts = [
    `session=${encodeURIComponent(session)}`,
    'Path=/',
    'HttpOnly',
    `SameSite=${sameSite}`,
    `Expires=${expires.toUTCString()}`,
  ]
  if (secure) parts.push('Secure')
  appendSetCookie(set, parts.join('; '))
}

export function clearSessionCookie(set: AppSet) {
  const { secure, sameSite } = sessionCookieOptions()
  const parts = [
    'session=',
    'Path=/',
    'HttpOnly',
    `SameSite=${sameSite}`,
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'Max-Age=0',
  ]
  if (secure) parts.push('Secure')
  appendSetCookie(set, parts.join('; '))
}
