import type { AppSet } from '@/lib/http'
import { decrypt } from '@/lib/auth-jwt'
import { getCookie } from '@/lib/cookies'
import { jsonError } from '@/lib/http'

export interface SessionPayload {
  id: string
  username: string
  role: string
  fullName: string
  [key: string]: unknown
}

export async function getSession(headers: Headers): Promise<SessionPayload | null> {
  const session = getCookie(headers, 'session')
  if (!session) return null

  try {
    return await decrypt(session) as SessionPayload
  } catch {
    return null
  }
}

export function unauthorized(set: AppSet) {
  return jsonError(set, 'Unauthorized', 401)
}
