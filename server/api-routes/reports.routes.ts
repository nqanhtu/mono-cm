import { Elysia } from 'elysia'
import * as XLSX from 'xlsx'
import type { Prisma } from '@/generated/prisma/client'

import { db } from '@/lib/db'
import { jsonError } from '@/lib/http'
import { getClientIp } from '@/lib/request'
import { sessionOrDenied } from '@/api-routes/_shared'
import { createAuditLog } from '@/lib/services/audit-log'

export const reportRoutes = new Elysia()
  .get('/api/reports/stats', async ({ request, set }) => {
    try {
      const { denied } = await sessionOrDenied({ request, set }, 'viewReports')
      if (denied) return denied
      const totalBorrows = await db.borrowSlip.count()
      const activeBorrows = await db.borrowSlip.count({ where: { status: { in: ['BORROWING', 'OVERDUE'] } } })
      const overdueBorrows = await db.borrowSlip.count({ where: { OR: [{ status: 'OVERDUE' }, { status: 'BORROWING', dueDate: { lt: new Date() } }] } })
      const returnedCount = await db.borrowSlip.count({ where: { status: 'RETURNED' } })
      const returnedRate = totalBorrows > 0 ? Math.round((returnedCount / totalBorrows) * 100) : 0
      const recentBorrows = await db.borrowSlip.findMany({ take: 20, orderBy: { createdAt: 'desc' }, include: { items: { include: { file: true } } } })
      return { totalBorrows, activeBorrows, overdueBorrows, returnedRate, recentBorrows }
    } catch (error) {
      console.error('Error fetching report stats:', error)
      return jsonError(set, 'Internal Server Error', 500)
    }
  })
  .get('/api/reports/files', async ({ request, set, query }) => {
    try {
      const { denied } = await sessionOrDenied({ request, set }, 'viewReports')
      if (denied) return denied
      const where = buildFileReportWhere(query)
      const files = await db.file.findMany({ where, include: { box: true }, orderBy: { createdAt: 'desc' } })
      return { files, total: files.length }
    } catch (error) {
      console.error('Error fetching file report:', error)
      return jsonError(set, 'Internal Server Error', 500)
    }
  })
  .get('/api/reports/borrows', async ({ request, set, query }) => {
    try {
      const { denied } = await sessionOrDenied({ request, set }, 'viewReports')
      if (denied) return denied
      const where = buildBorrowReportWhere(query)
      const borrows = await db.borrowSlip.findMany({ where, include: { lender: true, items: { include: { file: true } } }, orderBy: { createdAt: 'desc' } })
      return { borrows, total: borrows.length }
    } catch (error) {
      console.error('Error fetching borrow report:', error)
      return jsonError(set, 'Internal Server Error', 500)
    }
  })
  .get('/api/reports/audit', async ({ request, set, query }) => {
    try {
      const { denied } = await sessionOrDenied({ request, set }, 'viewReports')
      if (denied) return denied
      const where: Prisma.AuditLogWhereInput = {
        AND: [
          query.from ? { createdAt: { gte: new Date(String(query.from)) } } : {},
          query.to ? { createdAt: { lte: new Date(String(query.to)) } } : {},
          query.action ? { action: String(query.action) as Prisma.EnumAuditActionFilter['equals'] } : {},
        ],
      }
      const logs = await db.auditLog.findMany({ where, include: { user: true }, orderBy: { createdAt: 'desc' } })
      return { logs, total: logs.length }
    } catch (error) {
      console.error('Error fetching audit report:', error)
      return jsonError(set, 'Internal Server Error', 500)
    }
  })
  .get('/api/reports/export', async ({ request, set, query }) => {
    try {
      const { session, denied } = await sessionOrDenied({ request, set }, 'viewReports')
      if (denied) return denied
      const type = query.type === 'borrows' || query.type === 'audit' || query.type === 'case-matrix' ? query.type : 'files'
      const format = query.format === 'xlsx' ? 'xlsx' : 'csv'
      const rows = await loadReportRows(type, query)

      if (rows.length > 100 && session!.role !== 'SUPER_ADMIN') {
        return jsonError(set, 'Không cho phép xuất dữ liệu hàng loạt vượt quá 100 bản ghi. Vui lòng sử dụng bộ lọc chi tiết hơn hoặc đăng nhập tài khoản SUPER_ADMIN.', 400)
      }

      const filename = `${type}-report.${format}`
      const body = format === 'xlsx' ? new Uint8Array(toXlsx(rows, type)) : toCsv(rows)

      await createAuditLog({
        action: 'EXPORT',
        target: 'Report',
        targetId: type,
        userId: session?.id,
        ipAddress: getClientIp(request),
        detail: { type, format, rows: rows.length },
      })

      return new Response(body, {
        headers: {
          'content-type': format === 'xlsx'
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="${filename}"`,
          'cache-control': 'no-store',
        },
      })
    } catch (error) {
      console.error('Error exporting report:', error)
      return jsonError(set, 'Không thể kết xuất báo cáo', 500)
    }
  })
  .get('/api/reports/contributions', async ({ request, set, query }) => {
    try {
      const { session, denied } = await sessionOrDenied({ request, set }, 'viewReports')
      if (denied) return denied

      let targetUserId = session!.id
      if (['SUPER_ADMIN', 'ADMIN'].includes(session!.role) && query.userId) {
        targetUserId = String(query.userId)
      }

      const fromStr = query.from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const toStr = query.to || new Date().toISOString().split('T')[0]

      const fromDate = new Date(`${fromStr}T00:00:00+07:00`)
      const toDate = new Date(`${toStr}T23:59:59.999+07:00`)

      // Get target user details
      const user = await db.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, fullName: true, username: true }
      })
      if (!user) {
        set.status = 404
        return { error: 'Không tìm thấy người dùng' }
      }

      // Fetch Files and Documents concurrently
      const [files, docs] = await Promise.all([
        db.file.findMany({
          where: {
            createdById: targetUserId,
            createdAt: { gte: fromDate, lte: toDate },
          },
          select: { createdAt: true },
        }),
        db.document.findMany({
          where: {
            createdById: targetUserId,
            createdAt: { gte: fromDate, lte: toDate },
          },
          select: { createdAt: true },
        }),
      ])

      // Aggregate counts by local YYYY-MM-DD key (GMT+7)
      const dailyMap: Record<string, { files: number; documents: number }> = {}

      files.forEach((f) => {
        const localTime = new Date(new Date(f.createdAt).getTime() + 7 * 60 * 60 * 1000)
        const dateKey = localTime.toISOString().split('T')[0]
        if (!dailyMap[dateKey]) dailyMap[dateKey] = { files: 0, documents: 0 }
        dailyMap[dateKey].files += 1
      })

      docs.forEach((d) => {
        const localTime = new Date(new Date(d.createdAt).getTime() + 7 * 60 * 60 * 1000)
        const dateKey = localTime.toISOString().split('T')[0]
        if (!dailyMap[dateKey]) dailyMap[dateKey] = { files: 0, documents: 0 }
        dailyMap[dateKey].documents += 1
      })

      // Generate a continuous list of dates from start to end
      const contributions: { date: string; files: number; documents: number; total: number }[] = []
      const current = new Date(`${fromStr}T00:00:00+07:00`)
      const end = new Date(`${toStr}T23:59:59.999+07:00`)

      while (current <= end) {
        const localTime = new Date(current.getTime() + 7 * 60 * 60 * 1000)
        const dateKey = localTime.toISOString().split('T')[0]
        const counts = dailyMap[dateKey] || { files: 0, documents: 0 }
        contributions.push({
          date: dateKey,
          files: counts.files,
          documents: counts.documents,
          total: counts.files + counts.documents,
        })
        current.setDate(current.getDate() + 1)
      }

      return {
        userId: user.id,
        fullName: user.fullName,
        username: user.username,
        contributions,
      }
    } catch (error) {
      console.error('Error fetching contributions stats:', error)
      set.status = 500
      return { error: 'Internal Server Error' }
    }
  })
  .get('/api/reports/cases-matrix', async ({ request, set, query }) => {
    try {
      const { denied } = await sessionOrDenied({ request, set }, 'viewReports')
      if (denied) return denied

      const fromYearNum = query.fromYear ? parseInt(String(query.fromYear), 10) : undefined
      const toYearNum = query.toYear ? parseInt(String(query.toYear), 10) : undefined
      const typeFilter = query.type ? String(query.type).trim() : undefined

      const where: Prisma.FileWhereInput = {
        AND: [
          fromYearNum ? { year: { gte: fromYearNum } } : {},
          toYearNum ? { year: { lte: toYearNum } } : {},
          typeFilter ? { type: { contains: typeFilter, mode: 'insensitive' } } : {},
          { status: { not: 'ARCHIVED' } },
        ],
      }

      const files = await db.file.findMany({
        where,
        select: {
          type: true,
          year: true,
          pageCount: true,
        },
      })

      const isValidYear = (y: number | null | undefined): y is number =>
        typeof y === 'number' && y >= 1950 && y <= 2050

      // Determine year range
      let years: number[] = []
      if (fromYearNum && toYearNum) {
        for (let y = fromYearNum; y <= toYearNum; y++) {
          years.push(y)
        }
      } else {
        const foundYears = new Set<number>()
        files.forEach((f) => {
          if (isValidYear(f.year)) foundYears.add(f.year)
        })
        if (foundYears.size > 0) {
          years = Array.from(foundYears).sort((a, b) => a - b)
        } else {
          const currentYear = new Date().getFullYear()
          for (let y = currentYear - 5; y <= currentYear; y++) {
            years.push(y)
          }
        }
      }

      // Collect distinct normalized types
      const typesSet = new Set<string>()
      files.forEach((f) => {
        const norm = (f.type || '').trim() || 'Chưa phân loại'
        typesSet.add(norm)
      })

      const predefinedOrder = [
        'Dân sự sơ thẩm',
        'Hôn nhân sơ thẩm',
        'Hình sự sơ thẩm',
        'Dân sự',
        'Hình sự',
        'Hôn nhân gia đình',
        'Hành chính',
        'Kinh doanh thương mại',
        'Lao động',
        'Dân sự phúc thẩm',
        'Hình sự phúc thẩm',
      ]
      
      const orderedTypes: string[] = []
      predefinedOrder.forEach((t) => {
        if (typesSet.has(t)) {
          orderedTypes.push(t)
          typesSet.delete(t)
        }
      })
      // Add any remaining types found in database
      typesSet.forEach((t) => orderedTypes.push(t))

      const types = orderedTypes.length > 0 ? orderedTypes : (typeFilter ? [typeFilter] : predefinedOrder)

      // Initialize structures
      const matrixMap: Record<string, Record<number, number>> = {}
      const yearTotals: Record<number, number> = {}
      years.forEach((y) => {
        yearTotals[y] = 0
      })

      types.forEach((t) => {
        matrixMap[t] = {}
        years.forEach((y) => {
          matrixMap[t][y] = 0
        })
      })

      let grandTotal = 0
      let totalPageCount = 0

      files.forEach((f) => {
        grandTotal += 1
        totalPageCount += f.pageCount || 0
        const y = f.year
        const t = (f.type || '').trim() || 'Chưa phân loại'
        if (isValidYear(y) && matrixMap[t] && typeof matrixMap[t][y] === 'number') {
          matrixMap[t][y] += 1
          yearTotals[y] = (yearTotals[y] || 0) + 1
        }
      })

      const matrix = types.map((t) => {
        let typeTotal = 0
        const countsByYear: Record<string, number> = {}
        years.forEach((y) => {
          const count = matrixMap[t]?.[y] || 0
          countsByYear[String(y)] = count
          typeTotal += count
        })
        return {
          type: t,
          countsByYear,
          total: typeTotal,
        }
      })

      // Top type
      let topType: { type: string; count: number } | null = null
      matrix.forEach((m) => {
        if (!topType || m.total > topType.count) {
          topType = { type: m.type, count: m.total }
        }
      })

      // Peak year
      let peakYear: { year: number; count: number } | null = null
      years.forEach((y) => {
        const count = yearTotals[y] || 0
        if (!peakYear || count > peakYear.count) {
          peakYear = { year: y, count }
        }
      })

      return {
        years,
        types,
        matrix,
        yearTotals,
        grandTotal,
        totalPageCount,
        topType: grandTotal > 0 ? topType : null,
        peakYear: grandTotal > 0 ? peakYear : null,
      }
    } catch (error) {
      console.error('Error fetching cases matrix:', error)
      return jsonError(set, 'Internal Server Error', 500)
    }
  })
  .get('/api/reports/cases-matrix/drilldown', async ({ request, set, query }) => {
    try {
      const { denied } = await sessionOrDenied({ request, set }, 'viewReports')
      if (denied) return denied

      const year = query.year ? parseInt(String(query.year), 10) : undefined
      const type = query.type ? String(query.type).trim() : undefined

      if (!year || !type) {
        return jsonError(set, 'Thiếu thông tin năm hoặc loại án', 400)
      }

      const files = await db.file.findMany({
        where: {
          year,
          status: { not: 'ARCHIVED' },
          OR: [
            { type: { equals: type, mode: 'insensitive' } },
            { type: { startsWith: `${type} ` } },
            { type: { startsWith: type } },
          ],
        },
        include: {
          box: true,
        },
        orderBy: { code: 'asc' },
      })

      return { files, total: files.length, year, type }
    } catch (error) {
      console.error('Error fetching case drilldown:', error)
      return jsonError(set, 'Internal Server Error', 500)
    }
  })

function buildFileReportWhere(query: Record<string, string | undefined>): Prisma.FileWhereInput {
  return {
    AND: [
      query.from ? { createdAt: { gte: new Date(String(query.from)) } } : {},
      query.to ? { createdAt: { lte: new Date(String(query.to)) } } : {},
      query.type ? { type: { equals: String(query.type) } } : {},
      query.status ? { status: { equals: String(query.status) } } : {},
      query.warehouse ? { box: { is: { warehouse: { contains: String(query.warehouse), mode: 'insensitive' } } } } : {},
    ],
  }
}

function buildBorrowReportWhere(query: Record<string, string | undefined>): Prisma.BorrowSlipWhereInput {
  return {
    AND: [
      query.from ? { createdAt: { gte: new Date(String(query.from)) } } : {},
      query.to ? { createdAt: { lte: new Date(String(query.to)) } } : {},
      query.status ? { status: { equals: String(query.status) } } : {},
      query.userId ? { lenderId: String(query.userId) } : {},
    ],
  }
}

async function loadReportRows(type: 'files' | 'borrows' | 'audit' | 'case-matrix', query: Record<string, string | undefined>) {
  if (type === 'case-matrix') {
    const fromYearNum = query.fromYear ? parseInt(String(query.fromYear), 10) : undefined
    const toYearNum = query.toYear ? parseInt(String(query.toYear), 10) : undefined

    const where: Prisma.FileWhereInput = {
      AND: [
        fromYearNum ? { year: { gte: fromYearNum } } : {},
        toYearNum ? { year: { lte: toYearNum } } : {},
        { status: { not: 'ARCHIVED' } },
      ],
    }

    const files = await db.file.findMany({
      where,
      select: { type: true, year: true },
    })

    const isValidYear = (y: number | null | undefined): y is number =>
      typeof y === 'number' && y >= 1950 && y <= 2050

    let years: number[] = []
    if (fromYearNum && toYearNum) {
      for (let y = fromYearNum; y <= toYearNum; y++) {
        years.push(y)
      }
    } else {
      const foundYears = new Set<number>()
      files.forEach((f) => {
        if (isValidYear(f.year)) foundYears.add(f.year)
      })
      if (foundYears.size > 0) {
        years = Array.from(foundYears).sort((a, b) => a - b)
      } else {
        const currentYear = new Date().getFullYear()
        for (let y = currentYear - 5; y <= currentYear; y++) {
          years.push(y)
        }
      }
    }

    const typesSet = new Set<string>()
    files.forEach((f) => {
      const norm = (f.type || '').trim() || 'Chưa phân loại'
      typesSet.add(norm)
    })

    const predefinedOrder = [
      'Dân sự sơ thẩm',
      'Hôn nhân sơ thẩm',
      'Hình sự sơ thẩm',
      'Dân sự',
      'Hình sự',
      'Hôn nhân gia đình',
      'Hành chính',
      'Kinh doanh thương mại',
      'Lao động',
      'Dân sự phúc thẩm',
      'Hình sự phúc thẩm',
    ]

    const orderedTypes: string[] = []
    predefinedOrder.forEach((t) => {
      if (typesSet.has(t)) {
        orderedTypes.push(t)
        typesSet.delete(t)
      }
    })
    typesSet.forEach((t) => orderedTypes.push(t))
    const types = orderedTypes.length > 0 ? orderedTypes : predefinedOrder

    const matrixMap: Record<string, Record<number, number>> = {}
    const yearTotals: Record<number, number> = {}
    years.forEach((y) => {
      yearTotals[y] = 0
    })
    types.forEach((t) => {
      matrixMap[t] = {}
      years.forEach((y) => {
        matrixMap[t][y] = 0
      })
    })

    let grandTotal = 0
    files.forEach((f) => {
      grandTotal += 1
      const y = f.year
      const t = (f.type || '').trim() || 'Chưa phân loại'
      if (isValidYear(y) && matrixMap[t] && typeof matrixMap[t][y] === 'number') {
        matrixMap[t][y] += 1
        yearTotals[y] = (yearTotals[y] || 0) + 1
      }
    })

    const rows: Array<Record<string, unknown>> = types.map((t) => {
      const row: Record<string, unknown> = { 'Loại hồ sơ án': t }
      let rowTotal = 0
      years.forEach((y) => {
        const count = matrixMap[t]?.[y] || 0
        row[String(y)] = count
        rowTotal += count
      })
      row['Tổng cộng'] = rowTotal
      return row
    })

    const summaryRow: Record<string, unknown> = { 'Loại hồ sơ án': 'Tổng cộng theo năm' }
    years.forEach((y) => {
      summaryRow[String(y)] = yearTotals[y] || 0
    })
    summaryRow['Tổng cộng'] = grandTotal
    rows.push(summaryRow)

    return rows
  }

  if (type === 'files') {
    const files = await db.file.findMany({ where: buildFileReportWhere(query), include: { box: true }, orderBy: { createdAt: 'desc' } })
    return files.map((file) => ({
      code: file.code,
      title: file.title,
      type: file.type,
      year: file.year ?? '',
      status: file.status,
      box: file.box?.code ?? '',
    }))
  }

  if (type === 'borrows') {
    const borrows = await db.borrowSlip.findMany({ where: buildBorrowReportWhere(query), include: { lender: true, items: { include: { file: true } } }, orderBy: { createdAt: 'desc' } })
    return borrows.map((slip) => ({
      code: slip.code,
      borrowerName: slip.borrowerName,
      status: slip.status,
      dueDate: slip.dueDate?.toISOString?.() ?? String(slip.dueDate ?? ''),
      lender: slip.lender?.fullName ?? '',
      files: slip.items?.map((item) => item.file?.code).filter(Boolean).join(', ') ?? '',
    }))
  }

  const logs = await db.auditLog.findMany({ include: { user: true }, orderBy: { createdAt: 'desc' } })
  return logs.map((log) => ({
    action: log.action,
    target: log.target,
    targetId: log.targetId ?? '',
    user: log.user?.username ?? '',
    ipAddress: log.ipAddress ?? '',
    createdAt: log.createdAt?.toISOString?.() ?? String(log.createdAt ?? ''),
  }))
}

function toCsv(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(',')),
  ]
  return `\uFEFF${lines.join('\n')}`
}

function csvCell(value: unknown) {
  const text = String(value ?? '')
  if (!/[",\n]/.test(text)) return text
  return `"${text.replace(/"/g, '""')}"`
}

function toXlsx(rows: Array<Record<string, unknown>>, sheetName: string) {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), sheetName)
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}
