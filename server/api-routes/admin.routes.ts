import { Elysia } from 'elysia'
import type { Prisma } from '@/generated/prisma/client'

import { db } from '@/lib/db'
import { jsonError, type AppSet } from '@/lib/http'
import { getClientIp, toInt } from '@/lib/request'
import { getSession } from '@/lib/session'
import { sessionOrDenied, requireSuperAdmin, isUploadedFile } from '@/api-routes/_shared'
import { createAuditLog } from '@/lib/services/audit-log'
import { createPostgresBackup } from '@/lib/services/database-backup'
import { restorePostgresBackup } from '@/lib/services/database-restore'
import { uploadBackupToBlob, cleanExpiredBlobs } from '@/lib/services/vercel-blob'
import type { UserAccessEvent } from '@/generated/prisma/client'

const DEFAULT_STORAGE_LAYOUT_ID = 'default'

type StorageLayoutShelfData = {
  id: string
  name: string
  row: string
  x: number
  y: number
  w: number
  h: number
  capacity?: number | null
}

type StorageLayoutWarehouseData = {
  id: string
  name: string
  x: number
  y: number
  w: number
  h: number
  widthInMeters?: number | null
  heightInMeters?: number | null
  capacity?: number | null
  shelves: StorageLayoutShelfData[]
}

type StorageLayoutData = {
  version: 1
  warehouses: StorageLayoutWarehouseData[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function readNonEmptyString(record: Record<string, unknown>, key: string) {
  const value = record[key]
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function readFiniteNumber(record: Record<string, unknown>, key: string) {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readOptionalFiniteNumber(record: Record<string, unknown>, key: string) {
  const value = record[key]
  if (value === undefined || value === null) return null
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function readOptionalPositiveNumber(record: Record<string, unknown>, key: string) {
  const value = readOptionalFiniteNumber(record, key)
  if (value === null) return null
  if (value === undefined || value <= 0) return undefined
  return value
}

function normalizeStorageLabel(value: string | null | undefined, fallback: string) {
  const trimmed = (value || '').trim()
  return trimmed.length > 0 ? trimmed : fallback
}

function getStorageShelfId(line: string | null | undefined, shelf: string | null | undefined) {
  return `${normalizeStorageLabel(line, 'Chưa rõ dãy')}::${normalizeStorageLabel(shelf, 'Chưa rõ kệ')}`
}

function splitStorageShelfId(shelfId: string) {
  const [row, ...rest] = shelfId.split('::')
  return {
    row: row || 'Dãy',
    name: rest.join('::') || shelfId,
  }
}

function validateStorageLayoutData(value: unknown): { data: StorageLayoutData } | { error: string } {
  if (!isRecord(value)) return { error: 'Layout payload must be an object.' }
  if (value.version !== 1) return { error: 'Layout version must be 1.' }
  if (!Array.isArray(value.warehouses)) return { error: 'Layout warehouses must be an array.' }

  const warehouses: StorageLayoutWarehouseData[] = []
  const warehouseIds = new Set<string>()
  for (const warehouseValue of value.warehouses) {
    if (!isRecord(warehouseValue)) return { error: 'Each warehouse must be an object.' }
    const id = readNonEmptyString(warehouseValue, 'id')
    const name = readNonEmptyString(warehouseValue, 'name')
    const x = readFiniteNumber(warehouseValue, 'x')
    const y = readFiniteNumber(warehouseValue, 'y')
    const w = readFiniteNumber(warehouseValue, 'w')
    const h = readFiniteNumber(warehouseValue, 'h')
    if (!id || !name || x === null || y === null || w === null || h === null || w <= 0 || h <= 0) {
      return { error: 'Each warehouse must have a non-empty id/name and finite positive geometry.' }
    }
    if (warehouseIds.has(id)) return { error: 'Warehouse ids must be unique.' }
    warehouseIds.add(id)
    if (!Array.isArray(warehouseValue.shelves)) return { error: 'Each warehouse shelves field must be an array.' }

    const widthInMeters = readOptionalFiniteNumber(warehouseValue, 'widthInMeters')
    const heightInMeters = readOptionalFiniteNumber(warehouseValue, 'heightInMeters')
    if (widthInMeters === undefined || heightInMeters === undefined) {
      return { error: 'Warehouse meter dimensions must be finite numbers when provided.' }
    }
    const capacity = readOptionalPositiveNumber(warehouseValue, 'capacity')
    if (capacity === undefined) return { error: 'Warehouse capacity must be a positive finite number when provided.' }

    const shelves: StorageLayoutShelfData[] = []
    const shelfIds = new Set<string>()
    for (const shelfValue of warehouseValue.shelves) {
      if (!isRecord(shelfValue)) return { error: 'Each shelf must be an object.' }
      const shelfId = readNonEmptyString(shelfValue, 'id')
      const shelfName = readNonEmptyString(shelfValue, 'name')
      const row = readNonEmptyString(shelfValue, 'row')
      const shelfX = readFiniteNumber(shelfValue, 'x')
      const shelfY = readFiniteNumber(shelfValue, 'y')
      const shelfW = readFiniteNumber(shelfValue, 'w')
      const shelfH = readFiniteNumber(shelfValue, 'h')
      if (!shelfId || !shelfName || !row || shelfX === null || shelfY === null || shelfW === null || shelfH === null || shelfW <= 0 || shelfH <= 0) {
        return { error: 'Each shelf must have a non-empty id/name/row and finite positive geometry.' }
      }
      if (shelfIds.has(shelfId)) return { error: 'Shelf ids must be unique within each warehouse.' }
      shelfIds.add(shelfId)
      const shelfCapacity = readOptionalPositiveNumber(shelfValue, 'capacity')
      if (shelfCapacity === undefined) return { error: 'Shelf capacity must be a positive finite number when provided.' }
      shelves.push({ id: shelfId, name: shelfName, row, x: shelfX, y: shelfY, w: shelfW, h: shelfH, capacity: shelfCapacity })
    }

    warehouses.push({
      id,
      name,
      x,
      y,
      w,
      h,
      widthInMeters,
      heightInMeters,
      capacity,
      shelves,
    })
  }

  return { data: { version: 1, warehouses } }
}

type StorageLayoutQuery = {
  search?: string
  year?: string
  code?: string
  fond?: string
  caseType?: string
  documentNumber?: string
  warehouse?: string
  line?: string
  shelf?: string
}

function buildStorageBoxWhere(query: StorageLayoutQuery) {
  const search = query.search || ''
  const year = query.year ? Number(query.year) : null
  const where: Prisma.StorageBoxWhereInput = {}
  if (year && Number.isFinite(year)) where.year = year
  if (query.warehouse) where.warehouse = query.warehouse
  if (query.line) where.line = query.line
  if (query.shelf) where.shelf = query.shelf
  if (search) {
    where.OR = [
      { code: { contains: search, mode: 'insensitive' } },
      { warehouse: { contains: search, mode: 'insensitive' } },
      { line: { contains: search, mode: 'insensitive' } },
      { shelf: { contains: search, mode: 'insensitive' } },
      { slot: { contains: search, mode: 'insensitive' } },
      { boxNumber: { contains: search, mode: 'insensitive' } },
    ]
  }
  return where
}

function matchesStorageLayoutSearch(
  box: {
    code: string
    caseType: string | null
    fromFileCode: string | null
    toFileCode: string | null
    agency: { name: string } | null
  },
  query: StorageLayoutQuery
) {
  const code = (query.code || '').trim().toLowerCase()
  const fond = (query.fond || '').trim().toLowerCase()
  const caseType = (query.caseType || '').trim()
  const documentNumber = (query.documentNumber || '').trim()
  if (code && !box.code.toLowerCase().includes(code)) return false
  if (fond && !(box.agency?.name || '').toLowerCase().includes(fond)) return false
  if (caseType && box.caseType !== caseType) return false
  if (documentNumber) {
    const docNumber = Number(documentNumber)
    const from = Number(box.fromFileCode)
    const to = Number(box.toFileCode)
    if (!Number.isFinite(docNumber) || !Number.isFinite(from) || !Number.isFinite(to)) return false
    if (docNumber < from || docNumber > to) return false
  }
  return true
}

export const adminRoutes = new Elysia()
  .get('/api/admin/agency', async ({ request, set }) => {
    try {
      const { denied } = await sessionOrDenied({ request, set })
      if (denied) return denied
      return await db.agencyHistory.findMany({ orderBy: { startDate: 'desc' } })
    } catch (error) {
      console.error('Error fetching agencies:', error)
      return jsonError(set, 'Internal Server Error', 500)
    }
  })
  .post('/api/admin/agency', async ({ request, set }) => {
    try {
      const session = await getSession(request.headers)
      const denied = requireSuperAdmin(set, session)
      if (denied) return denied
      const data = await request.json() as Record<string, unknown>
      if (!data.name || !data.startDate) return jsonError(set, 'Name and Start Date are required', 400)
      const agency = await db.agencyHistory.create({ data: { name: String(data.name), startDate: new Date(String(data.startDate)), endDate: data.endDate ? new Date(String(data.endDate)) : null } })
      await createAuditLog({ action: 'CREATE', target: 'AgencyHistory', targetId: agency.id, userId: session!.id, ipAddress: getClientIp(request), detail: { name: agency.name, startDate: agency.startDate, endDate: agency.endDate } })
      return agency
    } catch (error) {
      console.error('Error creating agency:', error)
      return jsonError(set, 'Internal Server Error', 500)
    }
  })
  .patch('/api/admin/agency/:id', async ({ request, set, params }) => {
    try {
      const session = await getSession(request.headers)
      const denied = requireSuperAdmin(set, session)
      if (denied) return denied
      const data = await request.json() as Record<string, unknown>
      const updateData: Prisma.AgencyHistoryUpdateInput = {}
      if (data.name) updateData.name = String(data.name)
      if (data.startDate) updateData.startDate = new Date(String(data.startDate))
      if (data.endDate !== undefined) updateData.endDate = data.endDate ? new Date(String(data.endDate)) : null
      const agency = await db.agencyHistory.update({ where: { id: params.id }, data: updateData })
      await createAuditLog({ action: 'UPDATE', target: 'AgencyHistory', targetId: agency.id, userId: session!.id, ipAddress: getClientIp(request), detail: updateData })
      return agency
    } catch (error) {
      console.error('Error updating agency:', error)
      return jsonError(set, 'Internal Server Error', 500)
    }
  })
  .delete('/api/admin/agency/:id', async ({ request, set, params }) => {
    try {
      const session = await getSession(request.headers)
      const denied = requireSuperAdmin(set, session)
      if (denied) return denied
      const relatedBoxes = await db.storageBox.count({ where: { agencyId: params.id } })
      if (relatedBoxes > 0) return jsonError(set, 'Cannot delete agency with associated storage boxes. Please reassign or delete the boxes first.', 400)
      const agency = await db.agencyHistory.delete({ where: { id: params.id } })
      await createAuditLog({ action: 'DELETE', target: 'AgencyHistory', targetId: agency.id, userId: session!.id, ipAddress: getClientIp(request), detail: { name: agency.name } })
      return { success: true }
    } catch (error) {
      console.error('Error deleting agency:', error)
      return jsonError(set, 'Internal Server Error', 500)
    }
  })
  .get('/api/admin/storage-layout', async ({ request, set }) => {
    try {
      const { denied } = await sessionOrDenied({ request, set }, 'viewStorage')
      if (denied) return denied
      const layout = await db.storageLayout.findUnique({ where: { id: DEFAULT_STORAGE_LAYOUT_ID } })
      if (!layout) return new Response('null', { headers: { 'content-type': 'application/json' } })
      return layout.data
    } catch (error) {
      console.error('Error fetching storage layout:', error)
      return jsonError(set, 'Internal Server Error', 500)
    }
  })
  .put('/api/admin/storage-layout', async ({ request, set }) => {
    try {
      const session = await getSession(request.headers)
      const denied = requireSuperAdmin(set, session)
      if (denied) return denied
      const validation = validateStorageLayoutData(await request.json().catch(() => null))
      if ('error' in validation) return jsonError(set, validation.error, 400)

      const layout = await db.storageLayout.upsert({
        where: { id: DEFAULT_STORAGE_LAYOUT_ID },
        update: { data: validation.data },
        create: { id: DEFAULT_STORAGE_LAYOUT_ID, data: validation.data },
      })
      await createAuditLog({
        action: 'UPDATE',
        target: 'StorageLayout',
        targetId: layout.id,
        userId: session!.id,
        ipAddress: getClientIp(request),
        detail: { warehouses: validation.data.warehouses.length },
      })
      return layout.data
    } catch (error) {
      console.error('Error saving storage layout:', error)
      return jsonError(set, 'Internal Server Error', 500)
    }
  })
  .get('/api/admin/storage-layout/occupancy', async ({ request, set, query }) => {
    try {
      const { denied } = await sessionOrDenied({ request, set }, 'viewStorage')
      if (denied) return denied
      const typedQuery = query as StorageLayoutQuery
      const baseWhere = buildStorageBoxWhere(typedQuery)
      const boxes = await db.storageBox.findMany({
        where: baseWhere,
        select: {
          id: true,
          code: true,
          warehouse: true,
          line: true,
          shelf: true,
          slot: true,
          boxNumber: true,
          year: true,
          caseType: true,
          fromFileCode: true,
          toFileCode: true,
          agency: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      })

      const caseTypes = Array.from(new Set(boxes.map((box) => box.caseType).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b, 'vi'))
      const filteredBoxes = boxes.filter((box) => matchesStorageLayoutSearch(box, typedQuery))
      const matchedIds = new Set(filteredBoxes.map((box) => box.id))
      const warehouseMap = new Map<string, {
        id: string
        name: string
        totalBoxes: number
        matchedBoxes: number
        shelves: Map<string, {
          id: string
          row: string
          name: string
          totalBoxes: number
          matchedBoxes: number
          previewBoxes: {
            id: string
            code: string
            warehouse: string
            line: string
            shelf: string
            slot: string
            boxNumber: string
            year?: number | null
            caseType?: string | null
            agencyName?: string | null
          }[]
        }>
      }>()

      for (const box of boxes) {
        const warehouseId = normalizeStorageLabel(box.warehouse, 'Chưa rõ kho')
        const shelfId = getStorageShelfId(box.line, box.shelf)
        const splitShelf = splitStorageShelfId(shelfId)
        const isMatched = matchedIds.has(box.id)
        const warehouse = warehouseMap.get(warehouseId) || {
          id: warehouseId,
          name: warehouseId,
          totalBoxes: 0,
          matchedBoxes: 0,
          shelves: new Map(),
        }
        const shelf = warehouse.shelves.get(shelfId) || {
          id: shelfId,
          row: splitShelf.row,
          name: splitShelf.name,
          totalBoxes: 0,
          matchedBoxes: 0,
          previewBoxes: [],
        }

        warehouse.totalBoxes += 1
        shelf.totalBoxes += 1
        if (isMatched) {
          warehouse.matchedBoxes += 1
          shelf.matchedBoxes += 1
          if (shelf.previewBoxes.length < 24) {
            shelf.previewBoxes.push({
              id: box.id,
              code: box.code,
              warehouse: box.warehouse,
              line: box.line,
              shelf: box.shelf,
              slot: box.slot,
              boxNumber: box.boxNumber,
              year: box.year,
              caseType: box.caseType,
              agencyName: box.agency?.name || null,
            })
          }
        }
        warehouse.shelves.set(shelfId, shelf)
        warehouseMap.set(warehouseId, warehouse)
      }

      return {
        totalBoxes: boxes.length,
        matchedBoxes: filteredBoxes.length,
        caseTypes,
        warehouses: Array.from(warehouseMap.values())
          .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
          .map((warehouse) => ({
            ...warehouse,
            shelves: Array.from(warehouse.shelves.values()).sort((a, b) => a.id.localeCompare(b.id, 'vi')),
          })),
      }
    } catch (error) {
      console.error('Error fetching storage layout occupancy:', error)
      return jsonError(set, 'Internal Server Error', 500)
    }
  })
  .get('/api/admin/boxes', async ({ request, set, query }) => {
    try {
      const { denied } = await sessionOrDenied({ request, set }, 'viewStorage')
      if (denied) return denied
      const where = buildStorageBoxWhere(query as StorageLayoutQuery)
      return await db.storageBox.findMany({ where, include: { agency: true, _count: { select: { files: true } } }, orderBy: { createdAt: 'desc' } })
    } catch (error) {
      console.error('Error fetching storage boxes:', error)
      return jsonError(set, 'Internal Server Error', 500)
    }
  })
  .get('/api/qr/boxes/:id', async ({ request, set, params }) => {
    try {
      const { denied } = await sessionOrDenied({ request, set }, 'viewStorage')
      if (denied) return denied

      const box = await db.storageBox.findUnique({
        where: { id: params.id },
        include: {
          agency: true,
          _count: { select: { files: true } },
          files: {
            select: { id: true, code: true, title: true, type: true, year: true, status: true },
            orderBy: { code: 'asc' },
          },
        },
      })

      if (!box) {
        set.status = 404
        return { success: false, message: 'Không tìm thấy hộp lưu trữ' }
      }

      const { files, ...boxDetails } = box
      return { success: true, box: boxDetails, files }
    } catch (error) {
      console.error('Error resolving storage box QR:', error)
      return jsonError(set, 'Internal Server Error', 500)
    }
  })
  .post('/api/admin/boxes', async ({ request, set }) => {
    return upsertStorageBox(request, set)
  })
  .put('/api/admin/boxes/:id', async ({ request, set, params }) => {
    return upsertStorageBox(request, set, params.id)
  })
  .delete('/api/admin/boxes/:id', async ({ request, set, params }) => {
    try {
      const session = await getSession(request.headers)
      const denied = requireSuperAdmin(set, session)
      if (denied) return denied
      const filesCount = await db.file.count({ where: { boxId: params.id } })
      if (filesCount > 0) return jsonError(set, `Không thể xóa hộp lưu trữ. Hộp hiện đang chứa ${filesCount} hồ sơ. Vui lòng di chuyển các hồ sơ này sang hộp khác trước khi thực hiện xóa.`, 400)
      await db.storageBoxLabel.deleteMany({ where: { storageBoxId: params.id } })
      const box = await db.storageBox.delete({ where: { id: params.id } })
      await createAuditLog({ action: 'DELETE', target: 'StorageBox', targetId: box.id, userId: session!.id, ipAddress: getClientIp(request), detail: { code: box.code, location: `${box.warehouse}-${box.line}-${box.shelf}-${box.slot}-${box.boxNumber}` } })
      return { success: true }
    } catch (error) {
      console.error('Error deleting storage box:', error)
      return jsonError(set, 'Internal Server Error', 500)
    }

  })
  .post('/api/admin/database/backup', async ({ request, set }) => {
    const session = await getSession(request.headers)
    const denied = requireSuperAdmin(set, session)
    if (denied) return denied

    let target = 'local'
    try {
      const body = await request.json() as { target?: string }
      if (body.target === 'server-cloud') {
        target = 'server-cloud'
      }
    } catch {
      // Fallback to local if body is empty
    }

    let backup: Awaited<ReturnType<typeof createPostgresBackup>> | null = null

    try {
      backup = await createPostgresBackup()
      await createAuditLog({
        action: 'EXPORT',
        target: 'Database',
        targetId: 'postgres',
        userId: session!.id,
        ipAddress: getClientIp(request),
        detail: { filename: backup.filename, size: backup.size },
      })

      if (target === 'server-cloud') {
        const url = await uploadBackupToBlob(backup.filename, backup.buffer)
        await recordBackupRun({
          status: 'SUCCESS',
          filename: backup.filename,
          size: backup.size,
          target: 'server-cloud',
        })

        // Retention
        const schedule = await db.backupSchedule.findUnique({ where: { id: 'default' } })
        if (schedule && schedule.enabled) {
          await cleanExpiredBlobs(schedule.retentionDays)
          await db.backupRun.deleteMany({
            where: {
              startedAt: { lt: new Date(Date.now() - schedule.retentionDays * 24 * 60 * 60 * 1000) }
            }
          })
        }

        return { success: true, url, filename: backup.filename, size: backup.size }
      } else {
        await recordBackupRun({
          status: 'SUCCESS',
          filename: backup.filename,
          size: backup.size,
          target: 'local',
        })

        return new Response(backup.stream(), {
          headers: {
            'content-type': 'application/octet-stream',
            'content-disposition': `attachment; filename="${backup.filename}"`,
            'content-length': String(backup.size),
            'cache-control': 'no-store',
          },
        })
      }
    } catch (error) {
      await backup?.cleanup()
      console.error('Database backup error:', error instanceof Error ? error.message : error)
      await recordBackupRun({
        status: 'FAILED',
        message: error instanceof Error ? error.message : 'Unknown backup error',
        target,
      })
      return jsonError(set, 'Không thể tạo bản sao lưu cơ sở dữ liệu', 500)
    }
  }, {
    detail: {
      tags: ['Database Admin'],
      summary: 'Backup PostgreSQL database',
    },
  })
  .post('/api/admin/database/restore', async ({ request, set }) => {
    const session = await getSession(request.headers)
    const denied = requireSuperAdmin(set, session)
    if (denied) return denied

    try {
      const formData = await request.formData()
      const confirm = formData.get('confirm')
      const file = formData.get('file')

      if (confirm !== 'RESTORE') {
        return jsonError(set, 'Vui lòng nhập RESTORE để xác nhận khôi phục cơ sở dữ liệu', 400)
      }

      if (!isUploadedFile(file) || (!file.name.toLowerCase().endsWith('.json.gz') && !file.name.toLowerCase().endsWith('.gz'))) {
        return jsonError(set, 'Vui lòng chọn file .json.gz để khôi phục', 400)
      }

      const restore = await restorePostgresBackup({
        file,
        filename: file.name,
        size: file.size,
      })

      await createAuditLog({
        action: 'IMPORT',
        target: 'Database',
        targetId: 'postgres',
        userId: session!.id,
        ipAddress: getClientIp(request),
        detail: { filename: restore.filename, size: restore.size },
      })
      await recordBackupRun({
        status: 'RESTORED',
        filename: restore.filename,
        size: restore.size,
        target: 'local',
      })

      return {
        success: true,
        filename: restore.filename,
        size: restore.size,
      }
    } catch (error) {
      console.error('Database restore error:', error instanceof Error ? error.message : error)
      await recordBackupRun({
        status: 'RESTORE_FAILED',
        message: error instanceof Error ? error.message : 'Unknown restore error',
        target: 'local',
      })
      return jsonError(set, 'Không thể khôi phục cơ sở dữ liệu', 500)
    }
  }, {
    detail: {
      tags: ['Database Admin'],
      summary: 'Restore PostgreSQL database',
    },
  })
  .get('/api/admin/access-logs', async ({ request, set, query }) => {
    const session = await getSession(request.headers)
    if (!session || session.role !== 'SUPER_ADMIN') return jsonError(set, 'Unauthorized', 401)

    const q = query.q || undefined
    const userId = query.userId || undefined
    const from = query.from ? new Date(String(query.from)) : undefined
    const to = query.to ? new Date(String(query.to)) : undefined
    const deviceType = query.deviceType || undefined
    const browserName = query.browserName || undefined
    const osName = query.osName || undefined
    const event = query.event === 'LOGIN' || query.event === 'LOGOUT'
      ? query.event as UserAccessEvent
      : undefined
    const limit = toInt(query.limit, 20) ?? 20
    const offset = toInt(query.offset, 0) ?? 0

    const searchWhere: Prisma.UserAccessLogWhereInput = q ? {
      OR: [
        { ipAddress: { contains: q, mode: 'insensitive' } },
        { userAgent: { contains: q, mode: 'insensitive' } },
        { deviceType: { contains: q, mode: 'insensitive' } },
        { osName: { contains: q, mode: 'insensitive' } },
        { browserName: { contains: q, mode: 'insensitive' } },
        { user: { username: { contains: q, mode: 'insensitive' } } },
        { user: { fullName: { contains: q, mode: 'insensitive' } } },
      ],
    } : {}

    const baseAnd: Prisma.UserAccessLogWhereInput[] = [
      searchWhere,
      userId ? { userId } : {},
      from && !Number.isNaN(from.getTime()) ? { occurredAt: { gte: from } } : {},
      to && !Number.isNaN(to.getTime()) ? { occurredAt: { lte: to } } : {},
      deviceType ? { deviceType: { equals: deviceType, mode: 'insensitive' } } : {},
      browserName ? { browserName: { contains: browserName, mode: 'insensitive' } } : {},
      osName ? { osName: { contains: osName, mode: 'insensitive' } } : {},
    ]
    const baseWhere: Prisma.UserAccessLogWhereInput = { AND: baseAnd }
    const where: Prisma.UserAccessLogWhereInput = {
      AND: [
        ...baseAnd,
        event ? { event } : {},
      ],
    }

    try {
      const [logs, total, totalLogins, totalLogouts, activeUserRows, lastAccess] = await Promise.all([
        db.userAccessLog.findMany({
          where,
          take: limit,
          skip: offset,
          orderBy: { occurredAt: 'desc' },
          include: { user: true },
        }),
        db.userAccessLog.count({ where }),
        db.userAccessLog.count({ where: { AND: [baseWhere, { event: 'LOGIN' }] } }),
        db.userAccessLog.count({ where: { AND: [baseWhere, { event: 'LOGOUT' }] } }),
        db.userAccessLog.findMany({ where: baseWhere, distinct: ['userId'], select: { userId: true } }),
        db.userAccessLog.findFirst({ where: baseWhere, orderBy: { occurredAt: 'desc' }, select: { occurredAt: true } }),
      ])

      return {
        logs,
        total,
        summary: {
          totalLogins,
          totalLogouts,
          activeUsers: activeUserRows.length,
          lastAccessAt: lastAccess?.occurredAt ?? null,
        },
      }
    } catch (error) {
      console.error('Error fetching user access logs:', error)
      return jsonError(set, 'Failed to fetch access logs', 500)
    }
  }, {
    detail: {
      tags: ['Database Admin'],
      summary: 'List user access logs',
    },
  })
  .get('/api/admin/database/backup-schedule', async ({ request, set }) => {
    const session = await getSession(request.headers)
    const denied = requireSuperAdmin(set, session)
    if (denied) return denied

    try {
      const schedule = await db.backupSchedule.findUnique({ where: { id: 'default' } })
      const runs = await db.backupRun.findMany({ take: 20, orderBy: { startedAt: 'desc' } })
      return {
        schedule: schedule ?? {
          id: 'default',
          enabled: false,
          frequency: 'DAILY',
          timeOfDay: '23:00',
          retentionDays: 7,
          target: 'local',
          lastRunAt: null,
          lastStatus: null,
          lastMessage: null,
        },
        runs,
      }
    } catch (error) {
      console.error('Backup schedule fetch error:', error)
      return jsonError(set, 'Không thể tải lịch sao lưu', 500)
    }
  })
  .put('/api/admin/database/backup-schedule', async ({ request, set }) => {
    const session = await getSession(request.headers)
    const denied = requireSuperAdmin(set, session)
    if (denied) return denied

    try {
      const body = await request.json() as Record<string, unknown>
      const frequency = String(body.frequency || 'DAILY')
      const timeOfDay = String(body.timeOfDay || '23:00')
      const retentionDays = Math.max(1, Number(body.retentionDays || 7))
      const target = String(body.target || 'local')
      const enabled = body.enabled === true
      const schedule = await db.backupSchedule.upsert({
        where: { id: 'default' },
        create: { id: 'default', enabled, frequency, timeOfDay, retentionDays, target },
        update: { enabled, frequency, timeOfDay, retentionDays, target },
      })

      await createAuditLog({
        action: 'UPDATE',
        target: 'BackupSchedule',
        targetId: 'default',
        userId: session!.id,
        ipAddress: getClientIp(request),
        detail: { enabled, frequency, timeOfDay, retentionDays, target },
      })

      return { success: true, schedule }
    } catch (error) {
      console.error('Backup schedule update error:', error)
      return jsonError(set, 'Không thể lưu lịch sao lưu', 500)
    }
  })
  .post('/api/cron/backup', async ({ request, set }) => {
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.CRON_SECRET;
    
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    try {
      const schedule = await db.backupSchedule.findUnique({ where: { id: 'default' } });
      if (!schedule || !schedule.enabled) {
        return { success: true, message: 'Backup schedule is disabled' };
      }

      // Check if backup is due
      const now = new Date();
      const currentHour = now.getHours();
      const [scheduledHour] = schedule.timeOfDay.split(':').map(Number);

      // Verify trigger window (only if not forced or triggered by Vercel Cron)
      const urlObj = new URL(request.url);
      const isForce = urlObj.searchParams.get('force') === 'true';
      const isVercelCron = request.headers.get('x-vercel-cron') === 'true' || 
                           request.headers.get('user-agent')?.toLowerCase().includes('vercel-cron');

      if (!isForce && !isVercelCron && currentHour !== scheduledHour) {
        return { success: true, message: `Skipping: scheduled at ${schedule.timeOfDay}, current hour is ${currentHour}` };
      }

      // Ensure we haven't run it in the last 20 hours to prevent duplicate runs
      if (schedule.lastRunAt) {
        const hoursSinceLastRun = (now.getTime() - new Date(schedule.lastRunAt).getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastRun < 20) {
          return { success: true, message: 'Backup already run recently' };
        }
      }

      const backup = await createPostgresBackup();
      const url = await uploadBackupToBlob(backup.filename, backup.buffer);

      const target = schedule.target || 'server-cloud';
      await recordBackupRun({
        status: 'SUCCESS',
        filename: backup.filename,
        size: backup.size,
        target,
      });

      // Cleanup
      await cleanExpiredBlobs(schedule.retentionDays);
      await db.backupRun.deleteMany({
        where: {
          startedAt: { lt: new Date(Date.now() - schedule.retentionDays * 24 * 60 * 60 * 1000) }
        }
      });

      return { success: true, filename: backup.filename, url };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown cron backup error';
      console.error('Scheduled backup error:', errMsg);
      await recordBackupRun({
        status: 'FAILED',
        message: errMsg,
        target: 'server-cloud',
      });
      set.status = 500;
      return { error: errMsg };
    }
  })

async function upsertStorageBox(request: Request, set: AppSet, id?: string) {
  try {
    const session = await getSession(request.headers)
    const denied = requireSuperAdmin(set, session)
    if (denied) return denied
    const data = await request.json() as Record<string, string | number | null | undefined>
    const required = ['warehouse', 'line', 'shelf', 'slot', 'boxNumber', 'code']
    for (const field of required) if (!data[field]) return jsonError(set, `${field} is required`, 400)
    const code = String(data.code).trim().toUpperCase()
    const existing = id ? await db.storageBox.findFirst({ where: { code, NOT: { id } } }) : await db.storageBox.findUnique({ where: { code } })
    if (existing) return jsonError(set, 'Mã hộp lưu trữ đã tồn tại trên hệ thống.', 400)
    const warehouse = String(data.warehouse).trim()
    const line = String(data.line).trim()
    const shelf = String(data.shelf).trim()
    const slot = String(data.slot).trim()
    const boxNumber = String(data.boxNumber).trim()

    const existingLoc = id
      ? await db.storageBox.findFirst({ where: { warehouse, line, shelf, slot, boxNumber, NOT: { id } } })
      : await db.storageBox.findFirst({ where: { warehouse, line, shelf, slot, boxNumber } })

    if (existingLoc) {
      return jsonError(set, `Vị trí lưu kho này đã được đăng ký cho hộp khác (Mã hộp: ${existingLoc.code}).`, 400)
    }

    const payload = {
      warehouse,
      line,
      shelf,
      slot,
      boxNumber,
      code,
      agencyId: data.agencyId ? String(data.agencyId) : null,
      caseType: data.caseType ? String(data.caseType).trim() : null,
      year: data.year ? Number(data.year) : null,
      fromFileCode: data.fromFileCode ? String(data.fromFileCode).trim() : null,
      toFileCode: data.toFileCode ? String(data.toFileCode).trim() : null,
      retention: data.retention ? String(data.retention).trim() : null,
    }
    const box = id
      ? await db.storageBox.update({ where: { id }, data: payload, include: { agency: true, _count: { select: { files: true } } } })
      : await db.storageBox.create({ data: payload, include: { agency: true, _count: { select: { files: true } } } })
    await createAuditLog({ action: id ? 'UPDATE' : 'CREATE', target: 'StorageBox', targetId: box.id, userId: session!.id, ipAddress: getClientIp(request), detail: { code: box.code, location: `${box.warehouse}-${box.line}-${box.shelf}-${box.slot}-${box.boxNumber}`, agency: box.agency?.name, year: box.year } })
    return box
  } catch (error) {
    console.error('Error saving storage box:', error)
    return jsonError(set, 'Internal Server Error', 500)
  }
}

async function recordBackupRun({
  status,
  filename,
  size,
  message,
  target,
}: {
  status: string
  filename?: string
  size?: number
  message?: string
  target: string
}) {
  try {
    if (!db.backupRun || !db.backupSchedule) return
    await db.backupRun.create({
      data: {
        status,
        filename,
        size,
        message,
        target,
        endedAt: new Date(),
      },
    })
    await db.backupSchedule.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        enabled: false,
        frequency: 'DAILY',
        timeOfDay: '23:00',
        retentionDays: 7,
        target,
        lastRunAt: new Date(),
        lastStatus: status,
        lastMessage: message,
      },
      update: {
        lastRunAt: new Date(),
        lastStatus: status,
        lastMessage: message,
      },
    })
  } catch (error) {
    console.error('Failed to record backup run:', error)
  }
}
