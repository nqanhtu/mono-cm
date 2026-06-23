import { afterEach } from 'bun:test'

import { createApp } from '@/index'
import { encrypt } from '@/lib/auth-jwt'
import { resetDbForTesting, setDbForTesting } from '@/lib/db'
import { resetPostgresBackupRunnerForTesting } from '@/lib/services/database-backup'
import { resetPostgresRestoreRunnerForTesting } from '@/lib/services/database-restore'

afterEach(() => {
  resetDbForTesting()
  resetPostgresBackupRunnerForTesting()
  resetPostgresRestoreRunnerForTesting()
})

export { setDbForTesting }

export function createTestApp() {
  return createApp({ logger: false })
}

export function jsonRequest(path: string, init?: RequestInit) {
  return new Request(`http://localhost${path}`, init)
}

export function postJson(path: string, body: unknown, init?: RequestInit) {
  return jsonRequest(path, {
    ...init,
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...init?.headers,
    },
    body: JSON.stringify(body),
  })
}

export function putJson(path: string, body: unknown, init?: RequestInit) {
  return jsonRequest(path, {
    ...init,
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      ...init?.headers,
    },
    body: JSON.stringify(body),
  })
}

export async function sessionCookie(role = 'ADMIN', id = 'test-user-id') {
  const session = await encrypt({
    id,
    username: 'contract-test',
    fullName: 'Contract Test',
    role,
  })

  return `session=${session}`
}
