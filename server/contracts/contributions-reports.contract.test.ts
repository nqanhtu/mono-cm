import { describe, expect, test } from 'bun:test'
import { createTestApp, jsonRequest, sessionCookie, setDbForTesting } from './helpers'

describe('contributions reports contract', () => {
    test('GET /api/reports/contributions - regular user cannot query another user', async () => {
      const app = createTestApp()

      setDbForTesting({
        user: {
          findUnique: async () => ({ id: 'my-user-uuid', fullName: 'My User', username: 'my-user' }),
        },
        file: {
          findMany: async () => [],
        },
        document: {
          findMany: async () => [],
        },
      })

      const response = await app.handle(jsonRequest('/api/reports/contributions?userId=some-other-user-uuid', {
        headers: { cookie: await sessionCookie('VIEWER', 'my-user-uuid') },
      }))
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.userId).toBe('my-user-uuid') // should override target userId to self
    })

    test('GET /api/reports/contributions - admin can query another user and data merges correctly', async () => {
      const app = createTestApp()
      const mockFiles = [
        { createdAt: new Date('2026-06-20T10:00:00Z') },
        { createdAt: new Date('2026-06-20T11:00:00Z') },
        { createdAt: new Date('2026-06-21T12:00:00Z') },
      ]
      const mockDocs = [
        { createdAt: new Date('2026-06-21T14:00:00Z') },
        { createdAt: new Date('2026-06-21T14:01:00Z') },
        { createdAt: new Date('2026-06-21T14:02:00Z') },
        { createdAt: new Date('2026-06-21T14:03:00Z') },
        { createdAt: new Date('2026-06-21T14:04:00Z') },
      ]

      setDbForTesting({
        file: {
          findMany: async () => mockFiles,
        },
        document: {
          findMany: async () => mockDocs,
        },
        user: {
          findUnique: async () => ({ id: 'target-user', fullName: 'Target User' }),
        }
      })

      const response = await app.handle(jsonRequest('/api/reports/contributions?userId=target-user&from=2026-06-20&to=2026-06-21', {
        headers: { cookie: await sessionCookie('ADMIN') },
      }))

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.userId).toBe('target-user')
      expect(body.contributions).toHaveLength(2)
      expect(body.contributions[0]).toEqual({ date: '2026-06-20', files: 2, documents: 0, total: 2 })
      expect(body.contributions[1]).toEqual({ date: '2026-06-21', files: 1, documents: 5, total: 6 })
    })
})
