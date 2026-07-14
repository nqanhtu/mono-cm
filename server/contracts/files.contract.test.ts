import { describe, expect, test } from 'bun:test'

import { USER_SELECT } from '@/api-routes/_shared'
import { createTestApp, jsonRequest, postJson, sessionCookie, setDbForTesting } from './helpers'

describe('files contract', () => {
    test('GET /api/files keeps the successful paginated response shape', async () => {
      const app = createTestApp()
      const files = [
        {
          id: 'file-1',
          code: 'HS-001',
          title: 'Hồ sơ 001',
          type: 'Dân sự',
          status: 'IN_STOCK',
          box: null,
        },
      ]
      const findManyCalls: unknown[] = []
      const countCalls: unknown[] = []
  
      setDbForTesting({
        file: {
          findMany: async (args: unknown) => {
            findManyCalls.push(args)
            return files
          },
          count: async (args: unknown) => {
            countCalls.push(args)
            return 1
          },
        },
      })
  
      const response = await app.handle(jsonRequest('/api/files?limit=5&offset=10', {
        headers: { cookie: await sessionCookie('ADMIN') },
      }))
  
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ files, total: 1 })
      expect(findManyCalls).toHaveLength(1)
      expect(findManyCalls[0]).toMatchObject({
        take: 5,
        skip: 10,
        orderBy: { createdAt: 'desc' },
        include: { box: true },
      })
      expect(countCalls).toHaveLength(1)
    })

    test('GET /api/files/:id keeps the successful detail response shape', async () => {
      const app = createTestApp()
      const file = {
        id: 'file-1',
        code: 'HS-001',
        title: 'Hồ sơ 001',
        type: 'Dân sự',
        status: 'IN_STOCK',
        box: { id: 'box-1', code: 'BOX-1', agency: null },
        borrowItems: [],
        documents: [],
        fileIndex: null,
      }
      const calls: unknown[] = []
  
      setDbForTesting({
        file: {
          findUnique: async (args: unknown) => {
            calls.push(args)
            return file
          },
        },
      })
  
      const response = await app.handle(jsonRequest('/api/files/file-1', {
        headers: { cookie: await sessionCookie('VIEWER') },
      }))
  
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(file)
      expect(calls).toEqual([
        {
          where: { id: 'file-1' },
          include: {
            box: { include: { agency: true } },
            borrowItems: { where: { status: 'BORROWING' }, include: { borrowSlip: true } },
            documents: {
              orderBy: { order: 'asc' },
              include: {
                createdBy: { select: USER_SELECT },
                updatedBy: { select: USER_SELECT },
              },
            },
            fileIndex: true,
            createdBy: { select: USER_SELECT },
            updatedBy: { select: USER_SELECT },
          },
        },
      ])
    })

    test('GET /api/files/:id keeps the not found API error shape', async () => {
      const app = createTestApp()
  
      setDbForTesting({
        file: {
          findUnique: async () => null,
        },
      })
  
      const response = await app.handle(jsonRequest('/api/files/missing-file', {
        headers: { cookie: await sessionCookie('VIEWER') },
      }))
  
      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({
        success: false,
        message: 'Không tìm thấy hồ sơ',
      })
    })

    test('POST /api/files allows COORDINATOR users to create profiles', async () => {
      const app = createTestApp()
      const createCalls: unknown[] = []
      const file = {
        id: 'file-1',
        code: 'HS-001',
        title: 'Hồ sơ mới',
        status: 'IN_STOCK',
        isLocked: false,
        createdById: 'test-user-id',
        updatedById: 'test-user-id',
      }

      setDbForTesting({
        file: {
          findUnique: async () => null,
          create: async (args: unknown) => {
            createCalls.push(args)
            return file
          },
        },
        auditLog: {
          create: async () => ({ id: 'audit-1' }),
        },
      })

      const response = await app.handle(postJson('/api/files', {
        code: 'HS-001',
        title: 'Hồ sơ mới',
        type: 'Dân sự',
      }, {
        headers: { cookie: await sessionCookie('COORDINATOR') },
      }))

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ success: true, file })
      expect(createCalls).toEqual([
        {
          data: {
            code: 'HS-001',
            title: 'Hồ sơ mới',
            type: 'Dân sự',
            isLocked: false,
            status: 'IN_STOCK',
            createdById: 'test-user-id',
            updatedById: 'test-user-id',
          },
        },
      ])
    })

    test('POST /api/files returns a clear error when the file code already exists', async () => {
      const app = createTestApp()

      setDbForTesting({
        file: {
          findUnique: async () => ({ id: 'existing-file' }),
        },
      })

      const response = await app.handle(postJson('/api/files', {
        code: '02/HS/DH',
        title: 'Hồ sơ trùng mã',
        type: 'Hình sự',
      }, {
        headers: { cookie: await sessionCookie('COORDINATOR') },
      }))

      expect(response.status).toBe(409)
      expect(await response.json()).toEqual({
        success: false,
        message: 'Mã hồ sơ "02/HS/DH" đã tồn tại trong hệ thống.',
      })
    })

    test('POST /api/files returns a clear error when the selected storage box is invalid', async () => {
      const app = createTestApp()

      setDbForTesting({
        file: {
          findUnique: async () => null,
        },
        storageBox: {
          findUnique: async () => null,
        },
      })

      const response = await app.handle(postJson('/api/files', {
        code: 'HS-NEW',
        title: 'Hồ sơ mới',
        type: 'Hình sự',
        boxId: '01-01-01-01-01 (Kệ: 01)',
      }, {
        headers: { cookie: await sessionCookie('COORDINATOR') },
      }))

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({
        success: false,
        message: 'Hộp lưu trữ đã chọn không hợp lệ. Vui lòng chọn lại từ danh sách.',
      })
    })

    test('GET /api/files/stats keeps the stats response shape', async () => {
      const app = createTestApp()
      const fileCountCalls: unknown[] = []
      const borrowSlipCountCalls: unknown[] = []
  
      setDbForTesting({
        file: {
          count: async (args?: unknown) => {
            fileCountCalls.push(args)
            return fileCountCalls.length === 1 ? 42 : 7
          },
          groupBy: async (args: unknown) => {
            expect(args).toEqual({ by: ['type'], _count: true })
            return [
              { type: 'Dân sự', _count: 5 },
              { type: 'Hình sự', _count: 2 },
            ]
          },
        },
        borrowSlip: {
          count: async (args: unknown) => {
            borrowSlipCountCalls.push(args)
            return 3
          },
        },
      })
  
      const response = await app.handle(jsonRequest('/api/files/stats', {
        headers: { cookie: await sessionCookie('VIEWER') },
      }))
  
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        total: 42,
        borrowed: 7,
        overdue: 3,
        byType: [
          { type: 'Dân sự', _count: 5 },
          { type: 'Hình sự', _count: 2 },
        ],
      })
      expect(fileCountCalls).toEqual([
        undefined,
        { where: { status: 'BORROWED' } },
      ])
      expect(borrowSlipCountCalls).toHaveLength(1)
    })

    test('POST /api/files/:id/qr-token returns a signed QR access URL', async () => {
      const app = createTestApp()

      setDbForTesting({
        file: {
          findUnique: async () => ({ id: 'file-1', code: 'HS-001' }),
        },
      })

      const response = await app.handle(postJson('/api/files/file-1/qr-token', {}, {
        headers: { cookie: await sessionCookie('ADMIN') },
      }))

      expect(response.status).toBe(200)
      const body = await response.json() as { success: boolean; token: string; url: string }
      expect(body.success).toBe(true)
      expect(body.token).toBeString()
      expect(body.url).toStartWith('/qr/files/')
      expect(body.url).not.toContain('file-1')
    })

    test('GET /api/qr/files/:token rejects tampered QR tokens', async () => {
      const app = createTestApp()

      const response = await app.handle(jsonRequest('/api/qr/files/not-a-token', {
        headers: { cookie: await sessionCookie('VIEWER') },
      }))

      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({
        success: false,
        message: 'QR không hợp lệ hoặc đã hết hạn',
      })
    })

    test('PUT /api/files/:id - fails when file is locked and user is COORDINATOR', async () => {
      const app = createTestApp()

      setDbForTesting({
        file: {
          findUnique: async () => ({
            id: 'file-1',
            code: 'HS-001',
            isLocked: true,
          }),
        },
      })

      const response = await app.handle(jsonRequest('/api/files/file-1', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          cookie: await sessionCookie('COORDINATOR'),
        },
        body: JSON.stringify({ title: 'Updated Title' }),
      }))

      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({
        success: false,
        message: 'Hồ sơ đã bị khóa, không thể chỉnh sửa',
      })
    })

    test('PUT /api/files/:id - succeeds when file is locked and user is SUPER_ADMIN', async () => {
      const app = createTestApp()

      setDbForTesting({
        file: {
          findUnique: async () => ({
            id: 'file-1',
            code: 'HS-001',
            title: 'Hồ sơ cũ',
            isLocked: true,
          }),
          update: async () => ({
            id: 'file-1',
            code: 'HS-001',
            title: 'Hồ sơ mới',
          }),
        },
        auditLog: {
          create: async () => ({ id: 'audit-1' }),
        },
      })

      const response = await app.handle(jsonRequest('/api/files/file-1', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          cookie: await sessionCookie('SUPER_ADMIN'),
        },
        body: JSON.stringify({ title: 'Hồ sơ mới' }),
      }))

      expect(response.status).toBe(200)
      const body = await response.json() as any
      expect(body.success).toBe(true)
      expect(body.file.title).toBe('Hồ sơ mới')
    })

    test('PUT /api/files/:id allows COORDINATOR users to edit their own profiles', async () => {
      const app = createTestApp()
      const updateCalls: unknown[] = []

      setDbForTesting({
        file: {
          findUnique: async () => ({
            id: 'file-1',
            code: 'HS-001',
            title: 'Hồ sơ cũ',
            createdById: 'test-user-id',
            isLocked: false,
          }),
          update: async (args: unknown) => {
            updateCalls.push(args)
            return {
              id: 'file-1',
              code: 'HS-001',
              title: 'Hồ sơ mới',
              createdById: 'test-user-id',
            }
          },
        },
        auditLog: {
          create: async () => ({ id: 'audit-1' }),
        },
      })

      const response = await app.handle(jsonRequest('/api/files/file-1', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          cookie: await sessionCookie('COORDINATOR'),
        },
        body: JSON.stringify({ title: 'Hồ sơ mới' }),
      }))

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        success: true,
        file: {
          id: 'file-1',
          code: 'HS-001',
          title: 'Hồ sơ mới',
          createdById: 'test-user-id',
        },
      })
      expect(updateCalls).toEqual([
        {
          where: { id: 'file-1' },
          data: {
            title: 'Hồ sơ mới',
            updatedById: 'test-user-id',
          },
        },
      ])
    })

    test('PUT /api/files/:id rejects COORDINATOR users editing profiles they do not own', async () => {
      const app = createTestApp()

      setDbForTesting({
        file: {
          findUnique: async () => ({
            id: 'file-1',
            code: 'HS-001',
            createdById: 'another-user-id',
            isLocked: false,
          }),
        },
      })

      const response = await app.handle(jsonRequest('/api/files/file-1', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          cookie: await sessionCookie('COORDINATOR'),
        },
        body: JSON.stringify({ title: 'Hồ sơ mới' }),
      }))

      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({
        success: false,
        message: 'Không có quyền chỉnh sửa hồ sơ này',
      })
    })

    test('DELETE /api/files/:id - fails when file is locked and user is COORDINATOR', async () => {
      const app = createTestApp()

      setDbForTesting({
        file: {
          findUnique: async () => ({
            id: 'file-1',
            code: 'HS-001',
            isLocked: true,
            borrowItems: [],
          }),
        },
      })

      const response = await app.handle(jsonRequest('/api/files/file-1', {
        method: 'DELETE',
        headers: { cookie: await sessionCookie('COORDINATOR') },
      }))

      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({
        success: false,
        message: 'Chỉ duy nhất SUPER_ADMIN mới được phép xóa hồ sơ chính',
      })
    })

    test('DELETE /api/files/:id - succeeds when file is locked and user is SUPER_ADMIN', async () => {
      const app = createTestApp()

      setDbForTesting({
        file: {
          findUnique: async () => ({
            id: 'file-1',
            code: 'HS-001',
            isLocked: true,
            borrowItems: [],
          }),
          update: async () => ({
            id: 'file-1',
            code: 'HS-001',
            status: 'ARCHIVED',
          }),
        },
        auditLog: {
          create: async () => ({ id: 'audit-1' }),
        },
      })

      const response = await app.handle(jsonRequest('/api/files/file-1', {
        method: 'DELETE',
        headers: { cookie: await sessionCookie('SUPER_ADMIN') },
      }))

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        success: true,
        message: 'Đã lưu trữ hồ sơ',
      })
    })

    test('GET /api/files/autocomplete-suggestions keeps the autocomplete suggestions response shape', async () => {
      const app = createTestApp()
      const types = [{ type: 'Hình sự' }]
      const retentions = [{ retention: '10 năm' }]
      const docPreservations = [{ preservationTime: 'Vĩnh viễn' }]
      const filesForTitles = [{ title: 'Vụ án trộm cắp tài sản' }]

      setDbForTesting({
        file: {
          findMany: async (args: any) => {
            if (args.distinct && args.distinct.includes('type')) return types
            if (args.distinct && args.distinct.includes('retention')) return retentions
            if (args.distinct && args.distinct.includes('title')) return filesForTitles
            return []
          }
        },
        document: {
          findMany: async (args: any) => {
            if (args.distinct && args.distinct.includes('preservationTime')) return docPreservations
            if (args.distinct && args.distinct.includes('title')) return [{ title: 'Quyết định đưa vụ án ra xét xử' }]
            return []
          }
        }
      })

      const response = await app.handle(jsonRequest('/api/files/autocomplete-suggestions', {
        headers: { cookie: await sessionCookie('VIEWER') },
      }))

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        types: [
          'Hình sự',
          'Dân sự',
          'Hành chính',
          'Kinh doanh thương mại',
          'Lao động',
          'Hôn nhân gia đình',
          'Hình sự phúc thẩm',
          'Dân sự phúc thẩm',
          'Hôn nhân phúc thẩm'
        ],
        retentions: ['10 năm', '15 năm', '20 năm', '70 năm', 'Vĩnh viễn'],
        titles: ['Vụ án trộm cắp tài sản'],
        documentTitles: ['Quyết định đưa vụ án ra xét xử']
      })
    })
})
