import { describe, expect, test } from 'bun:test'

import { createTestApp, jsonRequest, postJson, sessionCookie, setDbForTesting } from './helpers'

describe('audit reports contract', () => {
    test('GET /api/audit keeps the successful paginated response shape', async () => {
      const app = createTestApp()
      const logs = [{ id: 'audit-1', action: 'CREATE', user: { username: 'admin' } }]
      const findManyCalls: unknown[] = []
      const countCalls: unknown[] = []
  
      setDbForTesting({
        auditLog: {
          findMany: async (args: unknown) => {
            findManyCalls.push(args)
            return logs
          },
          count: async (args: unknown) => {
            countCalls.push(args)
            return 1
          },
        },
      })
  
      const response = await app.handle(jsonRequest('/api/audit?limit=5&offset=10&action=CREATE', {
        headers: { cookie: await sessionCookie('SUPER_ADMIN') },
      }))
  
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ logs, total: 1 })
      expect(findManyCalls).toHaveLength(1)
      expect(findManyCalls[0]).toMatchObject({
        take: 5,
        skip: 10,
        orderBy: { createdAt: 'desc' },
        include: { user: true },
      })
      expect(countCalls).toHaveLength(1)
    })

    test('GET /api/admin/access-logs rejects non super admins', async () => {
      const app = createTestApp()

      const response = await app.handle(jsonRequest('/api/admin/access-logs', {
        headers: { cookie: await sessionCookie('ADMIN') },
      }))

      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({ error: 'Unauthorized' })
    })

    test('GET /api/admin/access-logs returns paginated access logs with summary', async () => {
      const app = createTestApp()
      const logs = [{
        id: 'access-1',
        event: 'LOGIN',
        ipAddress: '203.0.113.10',
        user: { id: 'user-1', username: 'admin', fullName: 'Admin User' },
      }]
      const findManyCalls: unknown[] = []
      const countCalls: unknown[] = []
      const findFirstCalls: unknown[] = []

      setDbForTesting({
        userAccessLog: {
          findMany: async (args: unknown) => {
            findManyCalls.push(args)
            return logs
          },
          count: async (args: unknown) => {
            countCalls.push(args)
            return countCalls.length === 1 ? 8 : countCalls.length === 2 ? 5 : 3
          },
          findFirst: async (args: unknown) => {
            findFirstCalls.push(args)
            return { occurredAt: '2026-05-21T00:00:00.000Z' }
          },
        },
      })

      const response = await app.handle(jsonRequest('/api/admin/access-logs?limit=5&offset=10&event=LOGIN&q=admin', {
        headers: { cookie: await sessionCookie('SUPER_ADMIN') },
      }))

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        logs,
        total: 8,
        summary: {
          totalLogins: 5,
          totalLogouts: 3,
          activeUsers: 1,
          lastAccessAt: '2026-05-21T00:00:00.000Z',
        },
      })
      expect(findManyCalls[0]).toMatchObject({
        take: 5,
        skip: 10,
        orderBy: { occurredAt: 'desc' },
        include: { user: true },
      })
      expect(countCalls).toHaveLength(3)
      expect(findFirstCalls).toHaveLength(1)
    })

    test('GET /api/admin/access-logs supports time and device filters', async () => {
      const app = createTestApp()
      const findManyCalls: unknown[] = []

      setDbForTesting({
        userAccessLog: {
          findMany: async (args: unknown) => {
            findManyCalls.push(args)
            return findManyCalls.length === 1 ? [] : [{ userId: 'user-1' }]
          },
          count: async () => 0,
          findFirst: async () => null,
        },
      })

      const response = await app.handle(jsonRequest('/api/admin/access-logs?from=2026-05-01&to=2026-05-21&deviceType=mobile&browserName=Safari&osName=iOS', {
        headers: { cookie: await sessionCookie('SUPER_ADMIN') },
      }))

      expect(response.status).toBe(200)
      expect(findManyCalls[0]).toMatchObject({
        where: {
          AND: expect.arrayContaining([
            { occurredAt: { gte: new Date('2026-05-01') } },
            { occurredAt: { lte: new Date('2026-05-21') } },
            { deviceType: { equals: 'mobile', mode: 'insensitive' } },
            { browserName: { contains: 'Safari', mode: 'insensitive' } },
            { osName: { contains: 'iOS', mode: 'insensitive' } },
          ]),
        },
      })
    })

    test('GET /api/audit supports user, target, ip, and time filters', async () => {
      const app = createTestApp()
      const findManyCalls: unknown[] = []

      setDbForTesting({
        auditLog: {
          findMany: async (args: unknown) => {
            findManyCalls.push(args)
            return []
          },
          count: async () => 0,
        },
      })

      const response = await app.handle(jsonRequest('/api/audit?userId=user-1&target=File&ip=203.0.113&from=2026-05-01&to=2026-05-21', {
        headers: { cookie: await sessionCookie('SUPER_ADMIN') },
      }))

      expect(response.status).toBe(200)
      expect(findManyCalls[0]).toMatchObject({
        where: {
          AND: expect.arrayContaining([
            { userId: 'user-1' },
            { target: { contains: 'File', mode: 'insensitive' } },
            { ipAddress: { contains: '203.0.113', mode: 'insensitive' } },
            { createdAt: { gte: new Date('2026-05-01') } },
            { createdAt: { lte: new Date('2026-05-21') } },
          ]),
        },
      })
    })

    test('GET /api/reports/stats keeps the report stats response shape', async () => {
      const app = createTestApp()
      const recentBorrows = [{ id: 'borrow-1', items: [] }]
      let countIndex = 0
      const countResults = [10, 4, 1, 6]
  
      setDbForTesting({
        borrowSlip: {
          count: async () => countResults[countIndex++],
          findMany: async (args: unknown) => {
            expect(args).toEqual({ take: 20, orderBy: { createdAt: 'desc' }, include: { items: { include: { file: true } } } })
            return recentBorrows
          },
        },
      })
  
      const response = await app.handle(jsonRequest('/api/reports/stats', {
        headers: { cookie: await sessionCookie('VIEWER') },
      }))
  
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        totalBorrows: 10,
        activeBorrows: 4,
        overdueBorrows: 1,
        returnedRate: 60,
        recentBorrows,
      })
    })

    test('GET /api/reports/export returns a downloadable CSV report', async () => {
      const app = createTestApp()

      setDbForTesting({
        file: {
          findMany: async () => [
            { code: 'HS-001', title: 'Hồ sơ 001', type: 'Dân sự', year: 2026, status: 'IN_STOCK', box: { code: 'K1-D1' } },
          ],
        },
        auditLog: {
          create: async () => ({ id: 'audit-export' }),
        },
      })

      const response = await app.handle(jsonRequest('/api/reports/export?type=files&format=csv', {
        headers: { cookie: await sessionCookie('ADMIN') },
      }))

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('text/csv')
      expect(response.headers.get('content-disposition')).toContain('attachment; filename="files-report.csv"')
      expect(await response.text()).toContain('HS-001')
    })

    test('GET /api/reports/export - fails when rows exceed 100 and user is not SUPER_ADMIN', async () => {
      const app = createTestApp()

      const mockRows = Array.from({ length: 101 }, (_, i) => ({
        code: `HS-${i}`,
        title: `Hồ sơ ${i}`,
        type: 'Dân sự',
        year: 2026,
        status: 'IN_STOCK',
      }))

      setDbForTesting({
        file: {
          findMany: async () => mockRows,
        },
      })

      const response = await app.handle(jsonRequest('/api/reports/export?type=files&format=csv', {
        headers: { cookie: await sessionCookie('ADMIN') },
      }))

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({
        error: 'Không cho phép xuất dữ liệu hàng loạt vượt quá 100 bản ghi. Vui lòng sử dụng bộ lọc chi tiết hơn hoặc đăng nhập tài khoản SUPER_ADMIN.',
      })
    })

    test('GET /api/reports/export - succeeds when rows exceed 100 but user is SUPER_ADMIN', async () => {
      const app = createTestApp()

      const mockRows = Array.from({ length: 101 }, (_, i) => ({
        code: `HS-${i}`,
        title: `Hồ sơ ${i}`,
        type: 'Dân sự',
        year: 2026,
        status: 'IN_STOCK',
      }))

      setDbForTesting({
        file: {
          findMany: async () => mockRows,
        },
        auditLog: {
          create: async () => ({ id: 'audit-export' }),
        },
      })

      const response = await app.handle(jsonRequest('/api/reports/export?type=files&format=csv', {
        headers: { cookie: await sessionCookie('SUPER_ADMIN') },
      }))

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('text/csv')
    })
})
