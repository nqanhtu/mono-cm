import { Elysia } from 'elysia'
import type { AuditAction, Prisma } from '@/generated/prisma/client'

import { db } from '@/lib/db'
import { jsonError } from '@/lib/http'
import { toInt } from '@/lib/request'
import { getSession } from '@/lib/session'

export const auditRoutes = new Elysia()
  .get('/api/audit', async ({ request, set, query }) => {
    const session = await getSession(request.headers)
    if (!session || session.role !== 'SUPER_ADMIN') return jsonError(set, 'Unauthorized', 401)
    const q = query.q || undefined
    const action = query.action || undefined
    const userId = query.userId || undefined
    const target = query.target || undefined
    const ip = query.ip || undefined
    const from = query.from ? new Date(String(query.from)) : undefined
    const to = query.to ? new Date(String(query.to)) : undefined
    const limit = toInt(query.limit, 20) ?? 20
    const offset = toInt(query.offset, 0) ?? 0
    const where: Prisma.AuditLogWhereInput = {
      AND: [
        q ? {
          OR: [
            { detail: { path: ['code'], string_contains: q } },
            { target: { contains: q, mode: 'insensitive' } },
            { ipAddress: { contains: q, mode: 'insensitive' } },
            { user: { username: { contains: q, mode: 'insensitive' } } },
            { user: { fullName: { contains: q, mode: 'insensitive' } } },
          ],
        } : {},
        action ? { action: { equals: action as AuditAction } } : {},
        userId ? { userId } : {},
        target ? { target: { contains: target, mode: 'insensitive' } } : {},
        ip ? { ipAddress: { contains: ip, mode: 'insensitive' } } : {},
        from && !Number.isNaN(from.getTime()) ? { createdAt: { gte: from } } : {},
        to && !Number.isNaN(to.getTime()) ? { createdAt: { lte: to } } : {},
      ],
    }
    try {
      const [logs, total] = await Promise.all([db.auditLog.findMany({ where, take: limit, skip: offset, orderBy: { createdAt: 'desc' }, include: { user: true } }), db.auditLog.count({ where })])
      return { logs, total }
    } catch {
      return jsonError(set, 'Failed to fetch audit logs', 500)
    }
  })
