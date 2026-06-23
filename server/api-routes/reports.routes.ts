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
      const type = query.type === 'borrows' || query.type === 'audit' ? query.type : 'files'
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

async function loadReportRows(type: 'files' | 'borrows' | 'audit', query: Record<string, string | undefined>) {
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
