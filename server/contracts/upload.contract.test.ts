import { describe, expect, test } from 'bun:test'
import * as XLSX from 'xlsx'

import { createTestApp, jsonRequest, sessionCookie, setDbForTesting } from './helpers'

function createSampleExcelBuffer(options?: {
  fileCode?: string
  judgmentNumber?: string
  judgmentDate?: string
  title?: string
  plaintiff?: string
  defendant?: string
  pages?: number
  type?: string
  year?: number
  retention?: string
  note?: string
  boxCode?: string
  includeDoc?: boolean
}) {
  const wb = XLSX.utils.book_new()
  const sheet1Data = [
    {
      'Hộp số': options?.boxCode ?? 'H01',
      'Hồ sơ số': options?.fileCode ?? '2024/HS-ST/01',
      'Số bản án/ quyết định': options?.judgmentNumber ?? '45/2024/HS-ST',
      'Ngày bản án/ quyết định': options?.judgmentDate ?? '15/04/2024',
      'Tiêu đề': options?.title ?? 'Vụ án trộm cắp tài sản',
      'Nguyên đơn/ người bị hại': options?.plaintiff ?? 'Nguyễn Văn Bị Hại',
      'Bị cáo/ bị đơn': options?.defendant ?? 'Trần Văn Bị Cáo 1, Lê Văn Bị Cáo 2',
      'Số tờ': options?.pages ?? 120,
      'Loại án': options?.type ?? 'Hình sự',
      'Thời gian': options?.year ?? 2024,
      'THBQ': options?.retention ?? 'Vĩnh viễn',
      'Ghi chú': options?.note ?? 'Án điểm',
    },
  ]

  const ws1 = XLSX.utils.json_to_sheet(sheet1Data)
  XLSX.utils.book_append_sheet(wb, ws1, 'Thông tin hồ sơ')

  if (options?.includeDoc !== false) {
    const sheet2Data = [
      {
        'Hồ sơ số': options?.fileCode ?? '2024/HS-ST/01',
        'Mục lục văn bản': 'VB-01',
        'Tiêu đề': 'Cáo trạng',
        'Loại án': options?.type ?? 'Hình sự',
        'Thời gian': options?.year ?? 2024,
        'Số tờ': 10,
        'Thời hạn bảo quản': 'Vĩnh viễn',
        'Ghi chú': 'Bản chính',
      },
    ]
    const ws2 = XLSX.utils.json_to_sheet(sheet2Data)
    XLSX.utils.book_append_sheet(wb, ws2, 'Mục lục văn bản')
  }

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}

describe('upload contract', () => {
    test('commit rejects malformed date before starting any write transaction', async () => {
      const app = createTestApp()
      let transactions = 0
      setDbForTesting({ file: { findMany: async () => [] }, $transaction: async () => { transactions++; throw new Error('Must not write') } })
      const body = new FormData()
      body.append('file', new File([createSampleExcelBuffer({ judgmentDate: '31/02/2023' })], 'invalid.xlsx'))
      const response = await app.handle(jsonRequest('/api/upload/excel/commit', { method: 'POST', headers: { cookie: await sessionCookie('ADMIN') }, body }))
      expect(response.status).toBe(422)
      expect(transactions).toBe(0)
      expect((await response.json()).errors).toEqual(expect.arrayContaining([expect.objectContaining({ column: 'Ngày bản án/ quyết định', severity: 'error' })]))
    })
    test('POST /api/upload/excel/preview without a session keeps the legacy auth error shape', async () => {
      const app = createTestApp()
      const formData = new FormData()
  
      const response = await app.handle(jsonRequest('/api/upload/excel/preview', {
        method: 'POST',
        body: formData,
      }))
  
      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({ error: 'Unauthorized' })
    })

    test('POST /api/upload/excel/preview with no file keeps the API error shape', async () => {
      const app = createTestApp()
      const formData = new FormData()
  
      const response = await app.handle(jsonRequest('/api/upload/excel/preview', {
        method: 'POST',
        headers: { cookie: await sessionCookie('ADMIN') },
        body: formData,
      }))
  
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({
        success: false,
        message: 'Vui lòng chọn file Excel',
      })
    })

    test('POST /api/upload/excel/preview with valid new 12-column template returns preview data', async () => {
      const app = createTestApp()
      const buffer = createSampleExcelBuffer()
      const file = new File([buffer], 'import-test.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const formData = new FormData()
      formData.append('file', file)

      setDbForTesting({
        file: {
          findMany: async () => [],
        },
      })

      const response = await app.handle(jsonRequest('/api/upload/excel/preview', {
        method: 'POST',
        headers: { cookie: await sessionCookie('ADMIN') },
        body: formData,
      }))

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.summary).toMatchObject({
        files: 1,
        documents: 1,
        errors: 0,
        warnings: 0,
      })
      expect(data.data.files[0]).toMatchObject({
        code: '2024/HS-ST/01',
        title: 'Vụ án trộm cắp tài sản',
        type: 'Hình sự',
        year: 2024,
        status: 'ready',
      })
      expect(data.data.issues).toHaveLength(0)
    })

    test('POST /api/upload/excel/preview detects duplicate file code already in database', async () => {
      const app = createTestApp()
      const buffer = createSampleExcelBuffer({ fileCode: '2024/HS-ST/DUPLICATE' })
      const file = new File([buffer], 'import-test.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const formData = new FormData()
      formData.append('file', file)

      setDbForTesting({
        file: {
          findMany: async () => [{ code: '2024/HS-ST/DUPLICATE' }],
        },
      })

      const response = await app.handle(jsonRequest('/api/upload/excel/preview', {
        method: 'POST',
        headers: { cookie: await sessionCookie('ADMIN') },
        body: formData,
      }))

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.summary.errors).toBe(1)
      expect(data.data.files[0].status).toBe('error')
      expect(data.data.issues).toEqual([
        {
          row: 2,
          column: 'Hồ sơ số',
          message: 'Mã hồ sơ đã tồn tại trong hệ thống',
          code: '2024/HS-ST/DUPLICATE',
          severity: 'error',
        },
      ])
    })

    test('POST /api/upload/excel/commit correctly maps judgmentDate, judgmentNumber, plaintiffs, defendants, datetime and commits to database', async () => {
      const app = createTestApp()
      const buffer = createSampleExcelBuffer({
        fileCode: '2024/HS-ST/01',
        judgmentNumber: '45/2024/HS-ST',
        judgmentDate: '15/04/2024',
        title: 'Vụ án trộm cắp tài sản',
        plaintiff: 'Nguyễn Văn Bị Hại',
        defendant: 'Trần Văn Bị Cáo 1, Lê Văn Bị Cáo 2',
        pages: 120,
        type: 'Hình sự',
        year: 2024,
        retention: 'Vĩnh viễn',
        note: 'Án điểm',
        boxCode: 'H01',
      })
      const file = new File([buffer], 'import-commit.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const formData = new FormData()
      formData.append('file', file)

      const fileCreateCalls: unknown[] = []
      const boxUpsertCalls: unknown[] = []

      setDbForTesting({
        file: {
          findMany: async () => [],
        },
        agencyHistory: {
          findFirst: async () => null,
        },
        auditLog: {
          create: async () => ({ id: 'audit-global' }),
        },
        $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({
          storageBox: {
            findMany: async () => [],
            upsert: async (args: unknown) => {
              boxUpsertCalls.push(args)
              return { id: 'box-1', code: 'H01' }
            },
          },
          file: {
            create: async (args: unknown) => {
              fileCreateCalls.push(args)
              return { id: 'file-1', code: '2024/HS-ST/01' }
            },
          },
          auditLog: {
            create: async () => ({ id: 'audit-file-1' }),
          },
        }),
      })

      const response = await app.handle(jsonRequest('/api/upload/excel/commit', {
        method: 'POST',
        headers: { cookie: await sessionCookie('ADMIN', 'user-admin-id') },
        body: formData,
      }))

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.message).toBe('Nhập dữ liệu thành công')
      expect(data.data.stats).toEqual({ success: 1, failure: 0 })

      expect(fileCreateCalls).toHaveLength(1)
      const createdData = (fileCreateCalls[0] as { data: Record<string, unknown> }).data
      expect(createdData.code).toBe('2024/HS-ST/01')
      expect(createdData.title).toBe('Vụ án trộm cắp tài sản')
      expect(createdData.type).toBe('Hình sự')
      expect(createdData.year).toBe(2024)
      expect(createdData.judgmentNumber).toBe('45/2024/HS-ST')
      // 15/04/2024 at midnight Vietnam time (UTC+7)
      expect(createdData.judgmentDate).toEqual(new Date("2024-04-15T00:00:00+07:00"))
      expect(createdData.datetime).toEqual(new Date("2024-04-15T00:00:00+07:00"))
      expect(createdData.plaintiffs).toEqual(['Nguyễn Văn Bị Hại'])
      expect(createdData.defendants).toEqual(['Trần Văn Bị Cáo 1', 'Lê Văn Bị Cáo 2'])
      expect(createdData.pageCount).toBe(120)
      expect(createdData.retention).toBe('Vĩnh viễn')
      expect(createdData.note).toBe('Án điểm')
      expect(createdData.isLocked).toBe(true)
      expect(createdData.box).toEqual({ connect: { code: 'H01' } })
      expect(createdData.documents).toEqual({
        create: [
          {
            title: 'Cáo trạng',
            code: 'VB-01',
            year: 2024,
            pageCount: 10,
            order: 1,
            note: 'Bản chính',
            preservationTime: 'Vĩnh viễn',
            contentIndex: 'VB-01',
          },
        ],
      })
    })

    test('POST /api/upload/excel returns 422 when validation fails', async () => {
      const app = createTestApp()
      const buffer = createSampleExcelBuffer({ fileCode: 'DUPLICATE_CODE' })
      const file = new File([buffer], 'import-error.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const formData = new FormData()
      formData.append('file', file)

      setDbForTesting({
        file: {
          findMany: async () => [{ code: 'DUPLICATE_CODE' }],
        },
      })

      const response = await app.handle(jsonRequest('/api/upload/excel', {
        method: 'POST',
        headers: { cookie: await sessionCookie('ADMIN') },
        body: formData,
      }))

      expect(response.status).toBe(422)
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.message).toBe('File Excel còn lỗi, chưa thể nhập dữ liệu')
      expect(data.errors).toBeDefined()
      expect(Array.isArray(data.errors)).toBe(true)
    })

    test('POST /api/files/import-child-docs with no file keeps the legacy JSON error shape', async () => {
      const app = createTestApp()
      const formData = new FormData()
  
      const response = await app.handle(jsonRequest('/api/files/import-child-docs', {
        method: 'POST',
        headers: { cookie: await sessionCookie('ADMIN') },
        body: formData,
      }))
  
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: 'Missing fileId or file' })
    })

    test('POST /api/upload/excel/patch-boxes without a session keeps the legacy auth error shape', async () => {
      const app = createTestApp()
      const formData = new FormData()

      const response = await app.handle(jsonRequest('/api/upload/excel/patch-boxes', {
        method: 'POST',
        body: formData,
      }))

      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({ error: 'Unauthorized' })
    })
})
