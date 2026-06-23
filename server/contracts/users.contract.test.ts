import { describe, expect, test } from 'bun:test'

import { createTestApp, jsonRequest, postJson, sessionCookie, setDbForTesting } from './helpers'

describe('users contract', () => {
    test('GET /api/users keeps the successful list response shape', async () => {
      const app = createTestApp()
      const users = [
        {
          id: 'user-1',
          username: 'admin',
          fullName: 'Admin User',
          unit: null,
          role: 'SUPER_ADMIN',
          status: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ]
      const calls: unknown[] = []
  
      setDbForTesting({
        user: {
          findMany: async (args: unknown) => {
            calls.push(args)
            return users
          },
        },
      })
  
      const response = await app.handle(jsonRequest('/api/users', {
        headers: { cookie: await sessionCookie('SUPER_ADMIN') },
      }))
  
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(users)
      expect(calls).toEqual([
        {
          omit: { password: true },
          orderBy: { createdAt: 'desc' },
        },
      ])
    })
})
