import { describe, expect, test } from 'bun:test'
import { createTestApp, jsonRequest, sessionCookie, setDbForTesting } from './helpers'

describe('cases reports contract', () => {
  test('GET /api/reports/cases-matrix aggregates files by type and year correctly', async () => {
    const app = createTestApp()
    const mockFiles = [
      { type: 'Dân sự sơ thẩm', year: 2014, pageCount: 10 },
      { type: 'Dân sự sơ thẩm', year: 2014, pageCount: 20 },
      { type: 'Dân sự sơ thẩm', year: 2015, pageCount: 15 },
      { type: 'Hình sự sơ thẩm', year: 2014, pageCount: 30 },
      { type: 'Hình sự sơ thẩm', year: 2016, pageCount: 25 },
    ]

    setDbForTesting({
      file: {
        findMany: async () => mockFiles,
      },
    })

    const response = await app.handle(jsonRequest('/api/reports/cases-matrix?fromYear=2014&toYear=2016', {
      headers: { cookie: await sessionCookie('VIEWER') },
    }))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.years).toEqual([2014, 2015, 2016])
    expect(body.types).toContain('Dân sự sơ thẩm')
    expect(body.types).toContain('Hình sự sơ thẩm')
    expect(body.grandTotal).toBe(5)
    expect(body.totalPageCount).toBe(100)
    expect(body.yearTotals['2014']).toBe(3)
    expect(body.yearTotals['2015']).toBe(1)
    expect(body.yearTotals['2016']).toBe(1)
    
    const dsRow = body.matrix.find((r: { type: string }) => r.type === 'Dân sự sơ thẩm')
    expect(dsRow).toBeDefined()
    expect(dsRow.countsByYear['2014']).toBe(2)
    expect(dsRow.countsByYear['2015']).toBe(1)
    expect(dsRow.countsByYear['2016']).toBe(0)
    expect(dsRow.total).toBe(3)

    expect(body.topType).toEqual({ type: 'Dân sự sơ thẩm', count: 3 })
    expect(body.peakYear).toEqual({ year: 2014, count: 3 })
  })

  test('GET /api/reports/cases-matrix/drilldown returns matching case files', async () => {
    const app = createTestApp()
    const mockFiles = [
      { id: 'f-1', code: '01/2014/DS-ST', title: 'Tranh chấp đất đai', type: 'Dân sự sơ thẩm', year: 2014, status: 'IN_STOCK', box: { code: 'HOP-01' } },
    ]
    setDbForTesting({
      file: {
        findMany: async () => mockFiles,
      },
    })

    const response = await app.handle(jsonRequest('/api/reports/cases-matrix/drilldown?year=2014&type=Dân%20sự%20sơ%20thẩm', {
      headers: { cookie: await sessionCookie('VIEWER') },
    }))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.files).toHaveLength(1)
    expect(body.files[0].code).toBe('01/2014/DS-ST')
  })

  test('GET /api/reports/export with type=case-matrix exports spreadsheet correctly', async () => {
    const app = createTestApp()
    const mockFiles = [
      { type: 'Dân sự sơ thẩm', year: 2014 },
      { type: 'Hình sự sơ thẩm', year: 2015 },
    ]
    setDbForTesting({
      file: {
        findMany: async () => mockFiles,
      },
      auditLog: {
        create: async () => ({ id: 'audit-1' }),
      },
    })

    const response = await app.handle(jsonRequest('/api/reports/export?type=case-matrix&format=xlsx', {
      headers: { cookie: await sessionCookie('VIEWER') },
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('spreadsheetml.sheet')
  })
})
