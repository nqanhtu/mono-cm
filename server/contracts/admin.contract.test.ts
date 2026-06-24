import { describe, expect, test } from 'bun:test'

import { createTestApp, jsonRequest, postJson, putJson, sessionCookie, setDbForTesting } from './helpers'
import { resetPostgresBackupRunnerForTesting, setPostgresBackupRunnerForTesting } from '@/lib/services/database-backup'
import { resetPostgresRestoreRunnerForTesting, setPostgresRestoreRunnerForTesting } from '@/lib/services/database-restore'

describe('admin contract', () => {
    test('GET /api/admin/agency keeps the successful list response shape', async () => {
      const app = createTestApp()
      const agencies = [{ id: 'agency-1', name: 'TAND', startDate: '2026-01-01T00:00:00.000Z', endDate: null }]
      const calls: unknown[] = []
  
      setDbForTesting({
        agencyHistory: {
          findMany: async (args: unknown) => {
            calls.push(args)
            return agencies
          },
        },
      })
  
      const response = await app.handle(jsonRequest('/api/admin/agency', {
        headers: { cookie: await sessionCookie('ADMIN') },
      }))
  
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(agencies)
      expect(calls).toEqual([{ orderBy: { startDate: 'desc' } }])
    })

    test('GET /api/admin/boxes keeps the successful list response shape', async () => {
      const app = createTestApp()
      const boxes = [{ id: 'box-1', code: 'BOX-1', agency: null, _count: { files: 0 } }]
      const calls: unknown[] = []
  
      setDbForTesting({
        storageBox: {
          findMany: async (args: unknown) => {
            calls.push(args)
            return boxes
          },
        },
      })
  
      const response = await app.handle(jsonRequest('/api/admin/boxes?search=BOX&year=2026', {
        headers: { cookie: await sessionCookie('VIEWER') },
      }))
  
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(boxes)
      expect(calls).toHaveLength(1)
      expect(calls[0]).toMatchObject({
        where: { year: 2026 },
        include: { agency: true, _count: { select: { files: true } } },
        orderBy: { createdAt: 'desc' },
      })
    })

    test('GET /api/admin/boxes supports exact warehouse, line, and shelf filters', async () => {
      const app = createTestApp()
      const calls: unknown[] = []

      setDbForTesting({
        storageBox: {
          findMany: async (args: unknown) => {
            calls.push(args)
            return []
          },
        },
      })

      const response = await app.handle(jsonRequest('/api/admin/boxes?warehouse=Kho%20A&line=D%C3%A3y%201&shelf=K%E1%BB%87%201', {
        headers: { cookie: await sessionCookie('VIEWER') },
      }))

      expect(response.status).toBe(200)
      expect(calls[0]).toMatchObject({
        where: {
          warehouse: 'Kho A',
          line: 'Dãy 1',
          shelf: 'Kệ 1',
        },
      })
    })

    test('GET /api/admin/storage-layout returns the saved layout data', async () => {
      const app = createTestApp()
      const layoutData = {
        version: 1,
        warehouses: [
          {
            id: 'Kho A',
            name: 'Kho A',
            x: 40,
            y: 40,
            w: 320,
            h: 220,
            widthInMeters: null,
            heightInMeters: null,
            shelves: [],
          },
        ],
      }
      const calls: unknown[] = []

      setDbForTesting({
        storageLayout: {
          findUnique: async (args: unknown) => {
            calls.push(args)
            return { id: 'default', data: layoutData }
          },
        },
      })

      const response = await app.handle(jsonRequest('/api/admin/storage-layout', {
        headers: { cookie: await sessionCookie('VIEWER') },
      }))

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(layoutData)
      expect(calls).toEqual([{ where: { id: 'default' } }])
    })

    test('GET /api/admin/storage-layout returns null when no layout has been saved', async () => {
      const app = createTestApp()

      setDbForTesting({
        storageLayout: {
          findUnique: async () => null,
        },
      })

      const response = await app.handle(jsonRequest('/api/admin/storage-layout', {
        headers: { cookie: await sessionCookie('VIEWER') },
      }))

      expect(response.status).toBe(200)
      expect(await response.json()).toBeNull()
    })

    test('PUT /api/admin/storage-layout saves validated layout data', async () => {
      const app = createTestApp()
      const upsertCalls: unknown[] = []
      const auditCreateCalls: unknown[] = []
      const layoutData = {
        version: 1,
        warehouses: [
          {
            id: 'Kho A',
            name: 'Kho A',
            x: 40,
            y: 40,
            w: 320,
            h: 220,
            widthInMeters: null,
            heightInMeters: null,
            capacity: null,
            shelves: [
              { id: 'Dãy 1::Kệ 1', name: 'Kệ 1', row: 'Dãy 1', x: 60, y: 70, w: 120, h: 48, capacity: null },
            ],
          },
        ],
      }

      setDbForTesting({
        storageLayout: {
          upsert: async (args: unknown) => {
            upsertCalls.push(args)
            return { id: 'default', data: layoutData }
          },
        },
        auditLog: {
          create: async (args: unknown) => {
            auditCreateCalls.push(args)
            return { id: 'audit-1' }
          },
        },
      })

      const response = await app.handle(putJson('/api/admin/storage-layout', layoutData, {
        headers: { cookie: await sessionCookie('SUPER_ADMIN') },
      }))

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(layoutData)
      expect(upsertCalls[0]).toEqual({
        where: { id: 'default' },
        update: { data: layoutData },
        create: { id: 'default', data: layoutData },
      })
      expect(auditCreateCalls[0]).toMatchObject({
        data: {
          action: 'UPDATE',
          target: 'StorageLayout',
          targetId: 'default',
          userId: 'test-user-id',
        },
      })
    })

    test('PUT /api/admin/storage-layout rejects requests without a session', async () => {
      const app = createTestApp()

      const response = await app.handle(putJson('/api/admin/storage-layout', { version: 1, warehouses: [] }))

      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({ error: 'Unauthorized' })
    })

    test('PUT /api/admin/storage-layout rejects non super admin users', async () => {
      const app = createTestApp()

      const response = await app.handle(putJson('/api/admin/storage-layout', { version: 1, warehouses: [] }, {
        headers: { cookie: await sessionCookie('ADMIN') },
      }))

      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({ error: 'Forbidden' })
    })

    test('PUT /api/admin/storage-layout rejects malformed layout data', async () => {
      const app = createTestApp()

      const response = await app.handle(putJson('/api/admin/storage-layout', {
        version: 1,
        warehouses: [{ id: 'Kho A', name: 'Kho A', x: 0, y: 0, w: 0, h: 200, shelves: [] }],
      }, {
        headers: { cookie: await sessionCookie('SUPER_ADMIN') },
      }))

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({
        error: 'Each warehouse must have a non-empty id/name and finite positive geometry.',
      })
    })

    test('PUT /api/admin/storage-layout rejects duplicate warehouse and shelf ids', async () => {
      const app = createTestApp()

      const duplicateWarehouses = await app.handle(putJson('/api/admin/storage-layout', {
        version: 1,
        warehouses: [
          { id: 'Kho A', name: 'Kho A', x: 0, y: 0, w: 200, h: 200, shelves: [] },
          { id: 'Kho A', name: 'Kho A copy', x: 0, y: 0, w: 200, h: 200, shelves: [] },
        ],
      }, {
        headers: { cookie: await sessionCookie('SUPER_ADMIN') },
      }))
      expect(duplicateWarehouses.status).toBe(400)
      expect(await duplicateWarehouses.json()).toEqual({ error: 'Warehouse ids must be unique.' })

      const duplicateShelves = await app.handle(putJson('/api/admin/storage-layout', {
        version: 1,
        warehouses: [{
          id: 'Kho A',
          name: 'Kho A',
          x: 0,
          y: 0,
          w: 200,
          h: 200,
          shelves: [
            { id: 'Dãy 1::Kệ 1', name: 'Kệ 1', row: 'Dãy 1', x: 1, y: 1, w: 40, h: 20 },
            { id: 'Dãy 1::Kệ 1', name: 'Kệ 1 copy', row: 'Dãy 1', x: 2, y: 2, w: 40, h: 20 },
          ],
        }],
      }, {
        headers: { cookie: await sessionCookie('SUPER_ADMIN') },
      }))
      expect(duplicateShelves.status).toBe(400)
      expect(await duplicateShelves.json()).toEqual({ error: 'Shelf ids must be unique within each warehouse.' })
    })

    test('GET /api/admin/storage-layout/occupancy returns grouped warehouse and shelf counts', async () => {
      const app = createTestApp()
      const calls: unknown[] = []
      const rows = [
        {
          id: 'box-1',
          code: 'BOX-1',
          warehouse: 'Kho A',
          line: 'Dãy 1',
          shelf: 'Kệ 1',
          slot: 'Ô 1',
          boxNumber: '001',
          year: 2026,
          caseType: 'Dân sự',
          fromFileCode: '1',
          toFileCode: '10',
          agency: { name: 'Phông A' },
        },
        {
          id: 'box-2',
          code: 'BOX-2',
          warehouse: 'Kho A',
          line: 'Dãy 1',
          shelf: 'Kệ 1',
          slot: 'Ô 2',
          boxNumber: '002',
          year: 2026,
          caseType: 'Hình sự',
          fromFileCode: '11',
          toFileCode: '20',
          agency: { name: 'Phông B' },
        },
      ]

      setDbForTesting({
        storageBox: {
          findMany: async (args: unknown) => {
            calls.push(args)
            return rows
          },
        },
      })

      const response = await app.handle(jsonRequest('/api/admin/storage-layout/occupancy', {
        headers: { cookie: await sessionCookie('VIEWER') },
      }))

      expect(response.status).toBe(200)
      expect(calls[0]).toMatchObject({
        where: {},
        select: {
          id: true,
          code: true,
          warehouse: true,
          line: true,
          shelf: true,
        },
      })
      expect(await response.json()).toEqual({
        totalBoxes: 2,
        matchedBoxes: 2,
        caseTypes: ['Dân sự', 'Hình sự'],
        warehouses: [{
          id: 'Kho A',
          name: 'Kho A',
          totalBoxes: 2,
          matchedBoxes: 2,
          shelves: [{
            id: 'Dãy 1::Kệ 1',
            row: 'Dãy 1',
            name: 'Kệ 1',
            totalBoxes: 2,
            matchedBoxes: 2,
            previewBoxes: [
              { id: 'box-1', code: 'BOX-1', warehouse: 'Kho A', line: 'Dãy 1', shelf: 'Kệ 1', slot: 'Ô 1', boxNumber: '001', year: 2026, caseType: 'Dân sự', agencyName: 'Phông A' },
              { id: 'box-2', code: 'BOX-2', warehouse: 'Kho A', line: 'Dãy 1', shelf: 'Kệ 1', slot: 'Ô 2', boxNumber: '002', year: 2026, caseType: 'Hình sự', agencyName: 'Phông B' },
            ],
          }],
        }],
      })
    })

    test('GET /api/admin/storage-layout/occupancy applies table and canvas filters', async () => {
      const app = createTestApp()
      const calls: unknown[] = []
      const rows = [
        {
          id: 'box-1',
          code: 'ABC-1',
          warehouse: 'Kho A',
          line: 'Dãy 1',
          shelf: 'Kệ 1',
          slot: 'Ô 1',
          boxNumber: '001',
          year: 2026,
          caseType: 'Dân sự',
          fromFileCode: '1',
          toFileCode: '10',
          agency: { name: 'Phông A' },
        },
        {
          id: 'box-2',
          code: 'XYZ-2',
          warehouse: 'Kho A',
          line: 'Dãy 2',
          shelf: 'Kệ 2',
          slot: 'Ô 2',
          boxNumber: '002',
          year: 2026,
          caseType: 'Hình sự',
          fromFileCode: '11',
          toFileCode: '20',
          agency: { name: 'Phông B' },
        },
      ]

      setDbForTesting({
        storageBox: {
          findMany: async (args: unknown) => {
            calls.push(args)
            return rows
          },
        },
      })

      const response = await app.handle(jsonRequest('/api/admin/storage-layout/occupancy?search=Kho&year=2026&code=ABC&fond=Ph%C3%B4ng%20A&caseType=D%C3%A2n%20s%E1%BB%B1&documentNumber=5', {
        headers: { cookie: await sessionCookie('VIEWER') },
      }))

      expect(response.status).toBe(200)
      expect(calls[0]).toMatchObject({ where: { year: 2026 } })
      const body = await response.json()
      expect(body.totalBoxes).toBe(2)
      expect(body.matchedBoxes).toBe(1)
      expect(body.warehouses[0].matchedBoxes).toBe(1)
      expect(body.warehouses[0].shelves.map((shelf: { id: string; matchedBoxes: number }) => [shelf.id, shelf.matchedBoxes])).toEqual([
        ['Dãy 1::Kệ 1', 1],
        ['Dãy 2::Kệ 2', 0],
      ])
    })

    test('GET /api/admin/storage-layout/occupancy rejects unauthenticated users', async () => {
      const app = createTestApp()

      const response = await app.handle(jsonRequest('/api/admin/storage-layout/occupancy'))

      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({ error: 'Unauthorized' })
    })

    test('GET /api/qr/boxes/:id returns box details and file summaries for authorized users', async () => {
      const app = createTestApp()
      const calls: unknown[] = []
      const box = {
        id: 'box-1',
        code: 'BOX-1',
        warehouse: 'Kho B',
        line: 'Dãy 2',
        shelf: 'Kệ 4',
        slot: 'Ô 8',
        boxNumber: '008',
        agency: { id: 'agency-1', name: 'TAND Thành phố Hồ Chí Minh' },
        _count: { files: 2 },
        files: [
          { id: 'file-1', code: 'LD-2026-001', title: 'Hồ sơ lao động 001', type: 'Lao động', year: 2026, status: 'IN_STOCK' },
          { id: 'file-2', code: 'LD-2026-002', title: 'Hồ sơ lao động 002', type: 'Lao động', year: 2026, status: 'BORROWED' },
        ],
      }

      setDbForTesting({
        storageBox: {
          findUnique: async (args: unknown) => {
            calls.push(args)
            return box
          },
        },
      })

      const response = await app.handle(jsonRequest('/api/qr/boxes/box-1', {
        headers: { cookie: await sessionCookie('VIEWER') },
      }))

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        success: true,
        box: {
          id: 'box-1',
          code: 'BOX-1',
          warehouse: 'Kho B',
          line: 'Dãy 2',
          shelf: 'Kệ 4',
          slot: 'Ô 8',
          boxNumber: '008',
          agency: { id: 'agency-1', name: 'TAND Thành phố Hồ Chí Minh' },
          _count: { files: 2 },
        },
        files: box.files,
      })
      expect(calls[0]).toMatchObject({
        where: { id: 'box-1' },
        include: {
          agency: true,
          _count: { select: { files: true } },
          files: {
            select: { id: true, code: true, title: true, type: true, year: true, status: true },
            orderBy: { code: 'asc' },
          },
        },
      })
    })

    test('GET /api/qr/boxes/:id rejects requests without a session', async () => {
      const app = createTestApp()

      const response = await app.handle(jsonRequest('/api/qr/boxes/box-1'))

      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({ error: 'Unauthorized' })
    })

    test('GET /api/qr/boxes/:id returns a clear error when the box is missing', async () => {
      const app = createTestApp()

      setDbForTesting({
        storageBox: {
          findUnique: async () => null,
        },
      })

      const response = await app.handle(jsonRequest('/api/qr/boxes/missing-box', {
        headers: { cookie: await sessionCookie('VIEWER') },
      }))

      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({ success: false, message: 'Không tìm thấy hộp lưu trữ' })
    })

    test('DELETE /api/admin/boxes/:id keeps the non-empty box error shape', async () => {
      const app = createTestApp()
  
      setDbForTesting({
        file: {
          count: async () => 2,
        },
      })
  
      const response = await app.handle(jsonRequest('/api/admin/boxes/box-1', {
        method: 'DELETE',
        headers: { cookie: await sessionCookie('SUPER_ADMIN') },
      }))
  
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({
        error: 'Không thể xóa hộp lưu trữ. Hộp hiện đang chứa 2 hồ sơ. Vui lòng di chuyển các hồ sơ này sang hộp khác trước khi thực hiện xóa.',
      })
    })

    test('POST /api/admin/database/backup without a session keeps the legacy auth error shape', async () => {
      const app = createTestApp()

      const response = await app.handle(jsonRequest('/api/admin/database/backup', { method: 'POST' }))

      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({ error: 'Unauthorized' })
    })

    test('POST /api/admin/database/backup with a non super admin keeps the forbidden error shape', async () => {
      const app = createTestApp()

      const response = await app.handle(jsonRequest('/api/admin/database/backup', {
        method: 'POST',
        headers: { cookie: await sessionCookie('ADMIN') },
      }))

      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({ error: 'Forbidden' })
    })

    test('POST /api/admin/database/backup returns a downloadable PostgreSQL dump', async () => {
      const app = createTestApp()
      const auditCreateCalls: unknown[] = []

      setPostgresBackupRunnerForTesting(async () => ({
        filename: 'court-management-2026-05-21T00-00-00-000Z.dump',
        size: 11,
        stream: () => new Blob(['dump-output']).stream(),
        cleanup: async () => undefined,
      }))
      setDbForTesting({
        auditLog: {
          create: async (args: unknown) => {
            auditCreateCalls.push(args)
            return { id: 'audit-1' }
          },
        },
      })

      const response = await app.handle(jsonRequest('/api/admin/database/backup', {
        method: 'POST',
        headers: { cookie: await sessionCookie('SUPER_ADMIN') },
      }))

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('application/octet-stream')
      expect(response.headers.get('content-disposition')).toBe('attachment; filename="court-management-2026-05-21T00-00-00-000Z.dump"')
      expect(response.headers.get('content-length')).toBe('11')
      expect(await response.text()).toBe('dump-output')
      expect(auditCreateCalls).toHaveLength(1)

      resetPostgresBackupRunnerForTesting()
    })

    test('POST /api/admin/database/restore rejects non super admins', async () => {
      const app = createTestApp()
      const formData = new FormData()
      formData.set('confirm', 'RESTORE')
      formData.set('file', new File(['dump-output'], 'backup.dump'))

      const response = await app.handle(jsonRequest('/api/admin/database/restore', {
        method: 'POST',
        headers: { cookie: await sessionCookie('ADMIN') },
        body: formData,
      }))

      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({ error: 'Forbidden' })
    })

    test('POST /api/admin/database/restore requires confirmation text', async () => {
      const app = createTestApp()
      const formData = new FormData()
      formData.set('confirm', 'WRONG')
      formData.set('file', new File(['dump-output'], 'backup.dump'))

      const response = await app.handle(jsonRequest('/api/admin/database/restore', {
        method: 'POST',
        headers: { cookie: await sessionCookie('SUPER_ADMIN') },
        body: formData,
      }))

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: 'Vui lòng nhập RESTORE để xác nhận khôi phục cơ sở dữ liệu' })
    })

    test('POST /api/admin/database/restore requires a dump file', async () => {
      const app = createTestApp()
      const formData = new FormData()
      formData.set('confirm', 'RESTORE')

      const response = await app.handle(jsonRequest('/api/admin/database/restore', {
        method: 'POST',
        headers: { cookie: await sessionCookie('SUPER_ADMIN') },
        body: formData,
      }))

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: 'Vui lòng chọn file .dump để khôi phục' })
    })

    test('POST /api/admin/database/restore restores a PostgreSQL dump and writes audit log', async () => {
      const app = createTestApp()
      const restoreCalls: unknown[] = []
      const auditCreateCalls: unknown[] = []
      const formData = new FormData()
      formData.set('confirm', 'RESTORE')
      formData.set('file', new File(['dump-output'], 'court-management.dump'))

      setPostgresRestoreRunnerForTesting(async (input) => {
        restoreCalls.push(input)
        return { filename: input.filename, size: input.size }
      })
      setDbForTesting({
        auditLog: {
          create: async (args: unknown) => {
            auditCreateCalls.push(args)
            return { id: 'audit-restore-1' }
          },
        },
      })

      const response = await app.handle(jsonRequest('/api/admin/database/restore', {
        method: 'POST',
        headers: { cookie: await sessionCookie('SUPER_ADMIN') },
        body: formData,
      }))

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        success: true,
        filename: 'court-management.dump',
        size: 11,
      })
      expect(restoreCalls).toEqual([{ file: expect.any(File), filename: 'court-management.dump', size: 11 }])
      expect(auditCreateCalls).toHaveLength(1)
      expect(auditCreateCalls[0]).toMatchObject({
        data: {
          action: 'IMPORT',
          target: 'Database',
          targetId: 'postgres',
          userId: 'test-user-id',
          detail: JSON.stringify({ filename: 'court-management.dump', size: 11 }),
        },
      })

      resetPostgresRestoreRunnerForTesting()
    })

    test('PUT /api/admin/database/backup-schedule saves the backup schedule', async () => {
      const app = createTestApp()
      const upsertCalls: unknown[] = []

      setDbForTesting({
        backupSchedule: {
          upsert: async (args: unknown) => {
            upsertCalls.push(args)
            return {
              id: 'default',
              enabled: true,
              frequency: 'DAILY',
              timeOfDay: '23:30',
              retentionDays: 14,
              target: 'local',
              updatedAt: '2026-05-21T00:00:00.000Z',
            }
          },
        },
        auditLog: {
          create: async () => ({ id: 'audit-schedule' }),
        },
      })

      const response = await app.handle(jsonRequest('/api/admin/database/backup-schedule', {
        method: 'PUT',
        headers: {
          cookie: await sessionCookie('SUPER_ADMIN'),
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          enabled: true,
          frequency: 'DAILY',
          timeOfDay: '23:30',
          retentionDays: 14,
          target: 'local',
        }),
      }))

      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        success: true,
        schedule: {
          enabled: true,
          frequency: 'DAILY',
          timeOfDay: '23:30',
          retentionDays: 14,
        },
      })
      expect(upsertCalls[0]).toMatchObject({
        where: { id: 'default' },
        create: {
          id: 'default',
          enabled: true,
          frequency: 'DAILY',
          timeOfDay: '23:30',
          retentionDays: 14,
          target: 'local',
        },
      })
    })

    test('POST /api/admin/boxes - fails when physical coordinates are duplicate', async () => {
      const app = createTestApp()

      setDbForTesting({
        storageBox: {
          findUnique: async () => null,
          findFirst: async () => ({
            id: 'box-existing',
            code: 'BOX-EXISTING',
            warehouse: 'Kho A',
            line: 'Dãy 1',
            shelf: 'Kệ 2',
            slot: 'Ngăn 3',
            boxNumber: '004',
          }),
        },
      })

      const response = await app.handle(postJson('/api/admin/boxes', {
        warehouse: 'Kho A',
        line: 'Dãy 1',
        shelf: 'Kệ 2',
        slot: 'Ngăn 3',
        boxNumber: '004',
        code: 'BOX-NEW',
      }, {
        headers: { cookie: await sessionCookie('SUPER_ADMIN') },
      }))

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({
        error: 'Vị trí lưu kho này đã được đăng ký cho hộp khác (Mã hộp: BOX-EXISTING).',
      })
    })
})
