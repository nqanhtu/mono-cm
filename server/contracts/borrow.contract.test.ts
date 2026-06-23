import { describe, expect, test } from 'bun:test'

import { createTestApp, jsonRequest, postJson, sessionCookie, setDbForTesting } from './helpers'

describe('borrow contract', () => {
    test('GET /api/borrow keeps the successful list response shape', async () => {
      const app = createTestApp()
      const slips = [
        {
          id: 'borrow-1',
          code: 'PM-2026-0001',
          borrowerName: 'Nguyễn Văn A',
          lender: { id: 'user-1', fullName: 'Admin User' },
          items: [{ id: 'item-1', file: { id: 'file-1', code: 'HS-001' } }],
        },
      ]
      const calls: unknown[] = []
  
      setDbForTesting({
        borrowSlip: {
          findMany: async (args: unknown) => {
            calls.push(args)
            return slips
          },
        },
      })
  
      const response = await app.handle(jsonRequest('/api/borrow', {
        headers: { cookie: await sessionCookie('ADMIN') },
      }))
  
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(slips)
      expect(calls).toEqual([
        {
          include: { lender: true, items: { include: { file: true } } },
          orderBy: { createdAt: 'desc' },
        },
      ])
    })

    test('GET /api/borrow/:id keeps the successful detail response shape', async () => {
      const app = createTestApp()
      const slip = {
        id: 'borrow-1',
        code: 'PM-2026-0001',
        borrowerName: 'Nguyễn Văn A',
        lender: { id: 'user-1', fullName: 'Admin User' },
        items: [{ id: 'item-1', file: { id: 'file-1', code: 'HS-001' } }],
      }
      const calls: unknown[] = []
  
      setDbForTesting({
        borrowSlip: {
          findUnique: async (args: unknown) => {
            calls.push(args)
            return slip
          },
        },
      })
  
      const response = await app.handle(jsonRequest('/api/borrow/borrow-1', {
        headers: { cookie: await sessionCookie('ADMIN') },
      }))
  
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(slip)
      expect(calls).toEqual([
        {
          where: { id: 'borrow-1' },
          include: { lender: true, items: { include: { file: true } } },
        },
      ])
    })

    test('GET /api/borrow/:id keeps the not found JSON error shape', async () => {
      const app = createTestApp()
  
      setDbForTesting({
        borrowSlip: {
          findUnique: async () => null,
        },
      })
  
      const response = await app.handle(jsonRequest('/api/borrow/missing-slip', {
        headers: { cookie: await sessionCookie('ADMIN') },
      }))
  
      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({ error: 'Borrow slip not found' })
    })

    test('GET /api/borrow/alerts keeps the alert response shape', async () => {
      const app = createTestApp()
      const updateManyCalls: unknown[] = []
      const findManyCalls: unknown[] = []
      const overdue = [{ id: 'overdue-1', code: 'PM-OVERDUE' }]
      const soonOverdue = [{ id: 'soon-1', code: 'PM-SOON' }]
  
      setDbForTesting({
        borrowSlip: {
          updateMany: async (args: unknown) => {
            updateManyCalls.push(args)
            return { count: 1 }
          },
          findMany: async (args: unknown) => {
            findManyCalls.push(args)
            return findManyCalls.length === 1 ? overdue : soonOverdue
          },
        },
      })
  
      const response = await app.handle(jsonRequest('/api/borrow/alerts', {
        headers: { cookie: await sessionCookie('ADMIN') },
      }))
  
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        overdueCount: 1,
        soonOverdueCount: 1,
        overdue,
        soonOverdue,
      })
      expect(updateManyCalls).toHaveLength(1)
      expect(findManyCalls).toHaveLength(2)
    })

    test('GET /api/borrow/:id/borrow-slip-event keeps the event list response shape', async () => {
      const app = createTestApp()
      const events = [
        { id: 'event-1', eventType: 'CREATED', creator: { fullName: 'Admin User', username: 'admin' } },
      ]
      const calls: unknown[] = []
  
      setDbForTesting({
        borrowSlipEvent: {
          findMany: async (args: unknown) => {
            calls.push(args)
            return events
          },
        },
      })
  
      const response = await app.handle(jsonRequest('/api/borrow/borrow-1/borrow-slip-event', {
        headers: { cookie: await sessionCookie('ADMIN') },
      }))
  
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(events)
      expect(calls).toEqual([
        {
          where: { borrowSlipId: 'borrow-1' },
          include: { creator: { select: { fullName: true, username: true } } },
          orderBy: { createdAt: 'desc' },
        },
      ])
    })

    test('POST /api/borrow/:id/borrow-slip-event without eventType keeps validation error shape', async () => {
      const app = createTestApp()
  
      const response = await app.handle(postJson('/api/borrow/borrow-1/borrow-slip-event', {}, {
        headers: { cookie: await sessionCookie('COORDINATOR') },
      }))
  
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: 'eventType is required' })
    })

    test('POST /api/borrow creates a pending request without marking files borrowed', async () => {
      const app = createTestApp()
      const transactionCalls: string[] = []
      const createCalls: unknown[] = []

      setDbForTesting({
        file: {
          findMany: async () => [{ id: 'file-1', code: 'HS-001', status: 'IN_STOCK' }],
        },
        borrowItem: {
          findFirst: async () => null,
        },
        $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({
          file: {
            updateMany: async () => {
              transactionCalls.push('file.updateMany')
              return { count: 1 }
            },
          },
          borrowSlip: {
            create: async (args: unknown) => {
              createCalls.push(args)
              return { id: 'borrow-1', code: 'PM-2026-0001' }
            },
          },
        }),
        borrowSlipEvent: {
          create: async () => ({ id: 'event-1' }),
        },
        auditLog: {
          create: async () => ({ id: 'audit-1' }),
        },
      })

      const response = await app.handle(postJson('/api/borrow', {
        borrowerName: 'Nguyễn Văn A',
        dueDate: '2026-06-01',
        fileIds: ['file-1'],
      }, {
        headers: { cookie: await sessionCookie('COORDINATOR') },
      }))

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ success: true, slipId: 'borrow-1' })
      expect(transactionCalls).toEqual([])
      expect(createCalls[0]).toMatchObject({
        data: {
          status: 'PENDING_APPROVAL',
          items: { create: [{ fileId: 'file-1', status: 'REQUESTED' }] },
        },
      })
    })

    test('POST /api/borrow rejects a file already reserved by an active request', async () => {
      const app = createTestApp()

      setDbForTesting({
        file: {
          findMany: async () => [{ id: 'file-1', code: 'HS-001', status: 'IN_STOCK' }],
        },
        borrowItem: {
          findFirst: async () => ({ id: 'item-1', file: { code: 'HS-001' } }),
        },
      })

      const response = await app.handle(postJson('/api/borrow', {
        borrowerName: 'Nguyễn Văn A',
        dueDate: '2026-06-01',
        fileIds: ['file-1'],
      }, {
        headers: { cookie: await sessionCookie('COORDINATOR') },
      }))

      expect(response.status).toBe(409)
      expect(await response.json()).toEqual({
        success: false,
        message: 'Hồ sơ HS-001 đang có yêu cầu mượn hoặc đang được mượn.',
      })
    })

    test('POST /api/borrow/:id/export rejects requests that are not approved', async () => {
      const app = createTestApp()

      setDbForTesting({
        borrowSlip: {
          findUnique: async () => ({ id: 'borrow-1', status: 'PENDING_APPROVAL', items: [] }),
        },
      })

      const response = await app.handle(postJson('/api/borrow/borrow-1/export', {}, {
        headers: { cookie: await sessionCookie('COORDINATOR') },
      }))

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({
        success: false,
        message: 'Chỉ có thể xuất hồ sơ sau khi yêu cầu đã được duyệt',
      })
    })

    test('POST /api/borrow/:id/approve updates approval metadata and writes an event', async () => {
      const app = createTestApp()
      const updateCalls: unknown[] = []
      const eventCalls: unknown[] = []

      setDbForTesting({
        borrowSlip: {
          findUnique: async () => ({ id: 'borrow-1', status: 'PENDING_APPROVAL' }),
          update: async (args: unknown) => {
            updateCalls.push(args)
            return { id: 'borrow-1', status: 'APPROVED' }
          },
        },
        borrowSlipEvent: {
          create: async (args: unknown) => {
            eventCalls.push(args)
            return { id: 'event-1' }
          },
        },
        auditLog: {
          create: async () => ({ id: 'audit-1' }),
        },
      })

      const response = await app.handle(postJson('/api/borrow/borrow-1/approve', {}, {
        headers: { cookie: await sessionCookie('ADMIN') },
      }))

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ success: true, status: 'APPROVED' })
      expect(updateCalls[0]).toMatchObject({
        where: { id: 'borrow-1' },
        data: { status: 'APPROVED', approvedById: 'test-user-id' },
      })
      expect(eventCalls[0]).toMatchObject({
        data: { borrowSlipId: 'borrow-1', eventType: 'APPROVED', creatorId: 'test-user-id' },
      })
    })
})
