import { describe, expect, test } from 'bun:test'
import * as XLSX from 'xlsx'

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

    test('GET /api/files?hasBox=false queries files with boxId null', async () => {
      const app = createTestApp()
      const findManyCalls: unknown[] = []
      const countCalls: unknown[] = []

      setDbForTesting({
        file: {
          findMany: async (args: unknown) => {
            findManyCalls.push(args)
            return []
          },
          count: async (args: unknown) => {
            countCalls.push(args)
            return 0
          },
        },
      })

      const response = await app.handle(jsonRequest('/api/files?hasBox=false', {
        headers: { cookie: await sessionCookie('ADMIN') },
      }))

      expect(response.status).toBe(200)
      expect(findManyCalls).toHaveLength(1)
      expect(findManyCalls[0]).toMatchObject({
        where: {
          AND: expect.arrayContaining([{ boxId: null }]),
        },
      })
    })

    test('GET /api/files?hasBox=true queries files with boxId not null', async () => {
      const app = createTestApp()
      const findManyCalls: unknown[] = []

      setDbForTesting({
        file: {
          findMany: async (args: unknown) => {
            findManyCalls.push(args)
            return []
          },
          count: async () => 0,
        },
      })

      const response = await app.handle(jsonRequest('/api/files?hasBox=true', {
        headers: { cookie: await sessionCookie('ADMIN') },
      }))

      expect(response.status).toBe(200)
      expect(findManyCalls).toHaveLength(1)
      expect(findManyCalls[0]).toMatchObject({
        where: {
          AND: expect.arrayContaining([{ boxId: { not: null } }]),
        },
      })
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
        { where: { NOT: { status: 'ARCHIVED' } } },
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

    test('PUT /api/files/:id - fails when updated code duplicates another existing file', async () => {
      const app = createTestApp()

      setDbForTesting({
        file: {
          findUnique: async () => ({
            id: 'file-1',
            code: 'HS-001',
            createdById: 'test-user-id',
            isLocked: false,
          }),
          findFirst: async () => ({
            id: 'file-2',
            code: 'HS-002',
          }),
        },
      })

      const response = await app.handle(jsonRequest('/api/files/file-1', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          cookie: await sessionCookie('ADMIN'),
        },
        body: JSON.stringify({
          code: 'HS-002',
        }),
      }))

      expect(response.status).toBe(409)
      expect(await response.json()).toEqual({
        success: false,
        message: 'Mã hồ sơ "HS-002" đã tồn tại trong hệ thống.',
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

    test('DELETE /api/files/:id - succeeds when file is locked and user is SUPER_ADMIN, and frees up the original code', async () => {
      const app = createTestApp()
      const updateCalls: unknown[] = []

      setDbForTesting({
        file: {
          findUnique: async () => ({
            id: 'file-1',
            code: 'HS-001',
            status: 'IN_STOCK',
            isLocked: true,
            borrowItems: [],
          }),
          update: async (args: unknown) => {
            updateCalls.push(args)
            return { id: 'file-1', code: 'HS-001#ARCHIVED-file-1', status: 'ARCHIVED' }
          },
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
      expect(updateCalls).toEqual([
        {
          where: { id: 'file-1' },
          data: { code: 'HS-001#ARCHIVED-file-1', status: 'ARCHIVED', isLocked: true },
        },
      ])
    })

    test('DELETE /api/files/:id - fails when file is already archived', async () => {
      const app = createTestApp()

      setDbForTesting({
        file: {
          findUnique: async () => ({
            id: 'file-1',
            code: 'HS-001#ARCHIVED-file-1',
            status: 'ARCHIVED',
            isLocked: true,
            borrowItems: [],
          }),
        },
      })

      const response = await app.handle(jsonRequest('/api/files/file-1', {
        method: 'DELETE',
        headers: { cookie: await sessionCookie('SUPER_ADMIN') },
      }))

      expect(response.status).toBe(409)
      expect(await response.json()).toEqual({
        success: false,
        message: 'Hồ sơ đã được lưu trữ trước đó.',
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

    test('POST /api/files/batch-assign-box succeeds with SUPER_ADMIN and updates boxId and retention', async () => {
      const app = createTestApp()
      const box = {
        id: 'box-1',
        code: 'BOX-001',
        retention: 'Vĩnh viễn',
      }
      let updateManyArgs: unknown = null
      let auditLogArgs: unknown = null

      setDbForTesting({
        storageBox: {
          findUnique: async (args: { where: { id: string } }) => {
            if (args.where.id === 'box-1') return box
            return null
          },
        },
        file: {
          updateMany: async (args: unknown) => {
            updateManyArgs = args
            return { count: 2 }
          },
        },
        auditLog: {
          create: async (args: unknown) => {
            auditLogArgs = args
            return { id: 'audit-1' }
          },
        },
      })

      const response = await app.handle(postJson('/api/files/batch-assign-box', {
        fileIds: ['file-1', 'file-2'],
        boxId: 'box-1',
      }, {
        headers: { cookie: await sessionCookie('SUPER_ADMIN') },
      }))

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toEqual({
        success: true,
        message: 'Đã chuyển thành công 2 hồ sơ vào hộp BOX-001',
        count: 2,
      })
      expect(updateManyArgs).toMatchObject({
        where: { id: { in: ['file-1', 'file-2'] } },
        data: {
          boxId: 'box-1',
          retention: 'Vĩnh viễn',
        },
      })
      expect(auditLogArgs).toMatchObject({
        data: {
          action: 'UPDATE',
          target: 'File',
          targetId: 'batch_assign_box',
        },
      })
    })

    test('POST /api/files/batch-assign-box rejects non-admin users with 403', async () => {
      const app = createTestApp()
      const response = await app.handle(postJson('/api/files/batch-assign-box', {
        fileIds: ['file-1'],
        boxId: 'box-1',
      }, {
        headers: { cookie: await sessionCookie('VIEWER') },
      }))
      expect(response.status).toBe(403)
    })

    test('POST /api/files/batch-assign-box returns 400 when fileIds is empty or missing', async () => {
      const app = createTestApp()
      const response = await app.handle(postJson('/api/files/batch-assign-box', {
        fileIds: [],
        boxId: 'box-1',
      }, {
        headers: { cookie: await sessionCookie('ADMIN') },
      }))
      expect(response.status).toBe(400)
    })

    test('POST /api/files/batch-assign-box returns 404 when boxId does not exist', async () => {
      const app = createTestApp()
      setDbForTesting({
        storageBox: {
          findUnique: async () => null,
        },
      })
      const response = await app.handle(postJson('/api/files/batch-assign-box', {
        fileIds: ['file-1'],
        boxId: 'box-nonexistent',
      }, {
        headers: { cookie: await sessionCookie('ADMIN') },
      }))
      expect(response.status).toBe(404)
    })

    test('GET /api/files/export rejects VIEWER with 403', async () => {
      const app = createTestApp()
      const response = await app.handle(jsonRequest('/api/files/export', {
        headers: { cookie: await sessionCookie('VIEWER') },
      }))
      expect(response.status).toBe(403)
    })

    test('GET /api/files/export rejects COORDINATOR with 403', async () => {
      const app = createTestApp()
      const response = await app.handle(jsonRequest('/api/files/export', {
        headers: { cookie: await sessionCookie('COORDINATOR') },
      }))
      expect(response.status).toBe(403)
    })

    test('GET /api/files/export returns an xlsx workbook for ADMIN, sorted by Hộp số then Mã hồ sơ regardless of query sort, with STT and joined multi-value cells', async () => {
      const app = createTestApp()
      const files = [
        {
          id: 'file-2', code: 'HS-002', title: 'Hồ sơ 2', type: 'Dân sự', year: 2021, pageCount: 15,
          plaintiffs: ['Nguyễn Văn A'], defendants: ['Trần Văn B'], civilDefendants: [],
          box: { boxNumber: '02' },
        },
        {
          id: 'file-1', code: 'HS-001', title: 'Hồ sơ 1', type: 'Hình sự', year: 2020, pageCount: 10,
          plaintiffs: ['Lê Thị C', 'Phạm Thị D'], defendants: [], civilDefendants: ['Hoàng Văn E'],
          box: { boxNumber: '01' },
        },
        {
          id: 'file-3', code: 'HS-003', title: 'Hồ sơ 3', type: 'Dân sự', year: 2022, pageCount: 5,
          plaintiffs: [], defendants: [], civilDefendants: [],
          box: null,
        },
      ]
      const findManyCalls: unknown[] = []
      const auditLogCalls: unknown[] = []

      setDbForTesting({
        file: {
          findMany: async (args: unknown) => {
            findManyCalls.push(args)
            return files
          },
        },
        agencyHistory: {
          findFirst: async () => ({ name: 'Toà án nhân dân khu vực 3 Tây Ninh' }),
        },
        auditLog: {
          create: async (args: unknown) => {
            auditLogCalls.push(args)
            return { id: 'audit-1' }
          },
        },
      })

      const response = await app.handle(jsonRequest('/api/files/export?sortField=title&sortOrder=asc', {
        headers: { cookie: await sessionCookie('ADMIN') },
      }))

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('spreadsheetml.sheet')
      expect(response.headers.get('content-disposition')).toMatch(/attachment; filename="muc-luc-ho-so_toa-an-nhan-dan-khu-vuc-3-tay-ninh_\d{8}_\d{4}\.xlsx"/)

      expect(findManyCalls).toHaveLength(1)
      expect(findManyCalls[0]).not.toHaveProperty('take')
      expect(findManyCalls[0]).not.toHaveProperty('skip')
      expect(findManyCalls[0]).not.toHaveProperty('orderBy')
      expect(findManyCalls[0]).toMatchObject({
        select: {
          code: true,
          title: true,
          type: true,
          year: true,
          pageCount: true,
          plaintiffs: true,
          defendants: true,
          civilDefendants: true,
          box: { select: { boxNumber: true } },
        },
      })

      expect(auditLogCalls).toHaveLength(1)
      expect(auditLogCalls[0]).toMatchObject({
        data: {
          action: 'EXPORT',
          target: 'File',
          targetId: 'file_index',
        },
      })

      const buffer = await response.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(sheet)

      expect(rows).toEqual([
        {
          'STT': 1,
          'Hộp số': '',
          'Mã hồ sơ': 'HS-003',
          'Nguyên đơn/Bị hại': '',
          'Bị cáo/Bị đơn': '',
          'Tiêu đề': 'Hồ sơ 3',
          'Loại án': 'Dân sự',
          'Năm': 2022,
          'Số tờ': 5,
        },
        {
          'STT': 2,
          'Hộp số': '01',
          'Mã hồ sơ': 'HS-001',
          'Nguyên đơn/Bị hại': 'Lê Thị C, Phạm Thị D',
          'Bị cáo/Bị đơn': 'Hoàng Văn E',
          'Tiêu đề': 'Hồ sơ 1',
          'Loại án': 'Hình sự',
          'Năm': 2020,
          'Số tờ': 10,
        },
        {
          'STT': 3,
          'Hộp số': '02',
          'Mã hồ sơ': 'HS-002',
          'Nguyên đơn/Bị hại': 'Nguyễn Văn A',
          'Bị cáo/Bị đơn': 'Trần Văn B',
          'Tiêu đề': 'Hồ sơ 2',
          'Loại án': 'Dân sự',
          'Năm': 2021,
          'Số tờ': 15,
        },
      ])
    })

    test('GET /api/files/export applies the current filters (type) to the Prisma where clause', async () => {
      const app = createTestApp()
      const findManyCalls: unknown[] = []

      setDbForTesting({
        file: {
          findMany: async (args: unknown) => {
            findManyCalls.push(args)
            return []
          },
        },
        agencyHistory: {
          findFirst: async () => null,
        },
        auditLog: {
          create: async () => ({ id: 'audit-1' }),
        },
      })

      const response = await app.handle(jsonRequest('/api/files/export?type=Dân+sự', {
        headers: { cookie: await sessionCookie('SUPER_ADMIN') },
      }))

      expect(response.status).toBe(200)
      expect(findManyCalls[0]).toMatchObject({
        where: {
          AND: expect.arrayContaining([{ type: { equals: 'Dân sự' } }]),
        },
      })
    })

    test('GET /api/files/export returns a valid workbook with only the header row when no file matches', async () => {
      const app = createTestApp()

      setDbForTesting({
        file: {
          findMany: async () => [],
        },
        agencyHistory: {
          findFirst: async () => null,
        },
        auditLog: {
          create: async () => ({ id: 'audit-1' }),
        },
      })

      const response = await app.handle(jsonRequest('/api/files/export', {
        headers: { cookie: await sessionCookie('ADMIN') },
      }))

      expect(response.status).toBe(200)
      expect(response.headers.get('content-disposition')).toMatch(/attachment; filename="muc-luc-ho-so_\d{8}_\d{4}\.xlsx"/)
      const buffer = await response.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 })

      expect(rawRows).toEqual([
        ['STT', 'Hộp số', 'Mã hồ sơ', 'Nguyên đơn/Bị hại', 'Bị cáo/Bị đơn', 'Tiêu đề', 'Loại án', 'Năm', 'Số tờ'],
      ])
    })
})
