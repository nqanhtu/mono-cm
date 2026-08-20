import { Elysia } from 'elysia'
import type { Prisma } from '@/generated/prisma/client'

import { db } from '@/lib/db'
import { apiError, jsonError } from '@/lib/http'
import { getClientIp, toInt } from '@/lib/request'
import { sessionOrDenied, USER_SELECT } from '@/api-routes/_shared'
import { createAuditLog } from '@/lib/services/audit-log'
import { createFileQrToken, verifyFileQrToken } from '@/lib/services/qr-token'
import { findFileIdsMatchingParty, findFileIdsMatchingText } from '@/lib/vi-search'

export const fileRoutes = new Elysia()
  .get('/api/files', async ({ request, set, query }) => {
    const { session, denied } = await sessionOrDenied({ request, set }, 'viewFiles')
    if (denied) return denied

    const q = query.q || undefined
    const type = query.type || undefined
    const year = query.year ? Number.parseInt(String(query.year), 10) : undefined
    const status = query.status || undefined
    const judgmentNumber = query.judgmentNumber || undefined
    const party = query.party || undefined
    const warehouse = query.warehouse || undefined
    const line = query.line || undefined
    const shelf = query.shelf || undefined
    const slot = query.slot || undefined
    const hasBox = query.hasBox || undefined
    const limit = toInt(query.limit, 20) ?? 20
    const offset = toInt(query.offset, 0) ?? 0
    const sortField = query.sortField || undefined
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc'

    let filterCreatedById: string | undefined = undefined
    if (session?.role === 'COORDINATOR') {
      filterCreatedById = session.id
    } else if (query.createdById) {
      filterCreatedById = String(query.createdById)
    }

    let partyFileIds: string[] | undefined = undefined
    if (party) {
      try {
        partyFileIds = await findFileIdsMatchingParty(party)
      } catch (err) {
        console.error('Error querying party with raw SQL:', err)
      }
    }

    let qFileIds: string[] | undefined = undefined
    if (q) {
      try {
        qFileIds = await findFileIdsMatchingText(q)
      } catch (err) {
        console.error('Error querying q with raw SQL:', err)
      }
    }

    const where: Prisma.FileWhereInput = {
      AND: [
        q ? (
          qFileIds !== undefined
            ? { id: { in: qFileIds } }
            : {
                OR: [
                  { code: { contains: q, mode: 'insensitive' } },
                  { title: { contains: q, mode: 'insensitive' } },
                  { judgmentNumber: { contains: q, mode: 'insensitive' } },
                  { indexCode: { contains: q, mode: 'insensitive' } },
                  { defendants: { has: q } },
                  { plaintiffs: { has: q } },
                  { civilDefendants: { has: q } },
                ],
              }
        ) : {},
        type && type !== 'all' ? { type: { equals: type } } : {},
        year ? { year: { equals: year } } : {},
        status && status !== 'all' ? { status: { equals: status } } : { NOT: { status: 'ARCHIVED' } },
        hasBox === 'false' ? { boxId: null } : {},
        hasBox === 'true' ? { boxId: { not: null } } : {},
        judgmentNumber ? { judgmentNumber: { contains: judgmentNumber, mode: 'insensitive' } } : {},
        party ? (
          partyFileIds !== undefined 
            ? { id: { in: partyFileIds } } 
            : { OR: [{ defendants: { has: party } }, { plaintiffs: { has: party } }, { civilDefendants: { has: party } }] }
        ) : {},
        warehouse || line || shelf || slot ? {
          box: {
            is: {
              ...(warehouse ? { warehouse: { contains: warehouse, mode: 'insensitive' as const } } : {}),
              ...(line ? { line: { contains: line, mode: 'insensitive' as const } } : {}),
              ...(shelf ? { shelf: { contains: shelf, mode: 'insensitive' as const } } : {}),
              ...(slot ? { slot: { contains: slot, mode: 'insensitive' as const } } : {}),
            },
          },
        } : {},
        filterCreatedById ? {
          createdById: {
            in: filterCreatedById === 'none' ? [] : filterCreatedById.split(','),
          },
        } : {},
      ],
    }

    try {
      const validFields = ['code', 'title', 'type', 'year', 'pageCount', 'status', 'createdAt', 'updatedAt', 'note', 'judgmentNumber', 'judgmentDate']
      let orderBy: Prisma.FileOrderByWithRelationInput = { createdAt: 'desc' }
      if (sortField) {
        if (sortField === 'defendants_civil') {
          orderBy = { defendants: sortOrder }
        } else if (sortField === 'plaintiffs_victims') {
          orderBy = { plaintiffs: sortOrder }
        } else if (validFields.includes(sortField)) {
          orderBy = { [sortField]: sortOrder }
        }
      }

      if (sortField === 'code') {
        const allFiles = await db.file.findMany({
          where,
          include: { box: true, createdBy: { select: USER_SELECT }, updatedBy: { select: USER_SELECT } },
        })
        const mult = sortOrder === 'asc' ? 1 : -1
        allFiles.sort((a, b) => {
          const codeA = a.code ?? ''
          const codeB = b.code ?? ''
          return codeA.localeCompare(codeB, 'vi', { numeric: true, sensitivity: 'base' }) * mult
        })
        const total = allFiles.length
        const files = allFiles.slice(offset, offset + limit)
        return { files, total }
      }

      const [files, total] = await Promise.all([
        db.file.findMany({ where, take: limit, skip: offset, orderBy, include: { box: true, createdBy: { select: USER_SELECT }, updatedBy: { select: USER_SELECT } } }),
        db.file.count({ where }),
      ])
      return { files, total }
    } catch (error) {
      console.error('Error searching files:', error)
      return jsonError(set, 'Internal Server Error', 500)
    }
  })
  .post('/api/files', async ({ request, set }) => {
    try {
      const { session, denied } = await sessionOrDenied({ request, set }, 'manageFiles')
      if (denied) return denied
      const data = await request.json() as Record<string, unknown>
      const code = typeof data.code === 'string' ? data.code.trim() : ''
      if (!code) return apiError(set, 'Vui lòng nhập mã hồ sơ', 400)

      const existingFile = await db.file.findUnique({
        where: { code },
        select: { id: true },
      })
      if (existingFile) {
        return apiError(set, `Mã hồ sơ "${code}" đã tồn tại trong hệ thống.`, 409)
      }

      const boxId = typeof data.boxId === 'string' ? data.boxId.trim() : ''
      if (boxId) {
        const box = await db.storageBox.findUnique({
          where: { id: boxId },
          select: { id: true },
        })
        if (!box) {
          return apiError(set, 'Hộp lưu trữ đã chọn không hợp lệ. Vui lòng chọn lại từ danh sách.', 400)
        }
      }

      const fileData = {
        ...data,
        code,
        ...(typeof data.boxId === 'string' ? { boxId: boxId || null } : {}),
        isLocked: false,
        status: 'IN_STOCK',
        createdById: session?.id,
        updatedById: session?.id,
      }
      const file = await db.file.create({ data: fileData as unknown as Prisma.FileCreateInput })
      await createAuditLog({
        action: 'CREATE',
        target: 'File',
        targetId: file.id,
        userId: session?.id,
        ipAddress: getClientIp(request),
        detail: { title: file.title, code: file.code },
      })
      return { success: true, file }
    } catch (error) {
      console.error('Error creating file:', error)
      set.status = 500
      return { success: false, error: 'Failed to create file' }
    }
  })
  .post('/api/files/batch-assign-box', async ({ request, set }) => {
    try {
      const { session, denied } = await sessionOrDenied({ request, set }, 'manageFiles')
      if (denied) return denied

      const body = await request.json() as { fileIds?: string[]; boxId?: string }
      const fileIds = Array.isArray(body?.fileIds) ? body.fileIds.filter(id => typeof id === 'string' && id.trim()) : []
      const boxId = typeof body?.boxId === 'string' ? body.boxId.trim() : ''

      if (fileIds.length === 0) {
        return apiError(set, 'Vui lòng chọn ít nhất một hồ sơ', 400)
      }
      if (!boxId) {
        return apiError(set, 'Vui lòng chọn hộp lưu trữ đích', 400)
      }

      const box = await db.storageBox.findUnique({
        where: { id: boxId },
        select: { id: true, code: true, retention: true },
      })
      if (!box) {
        return apiError(set, 'Hộp lưu trữ không tồn tại', 404)
      }

      const updateData: Record<string, any> = {
        boxId: box.id,
        updatedById: session!.id,
      }
      if (box.retention) {
        updateData.retention = box.retention
      }

      const result = await db.file.updateMany({
        where: { id: { in: fileIds } },
        data: updateData,
      })

      await createAuditLog({
        action: 'UPDATE',
        target: 'File',
        targetId: 'batch_assign_box',
        userId: session!.id,
        ipAddress: getClientIp(request),
        detail: {
          boxId: box.id,
          boxCode: box.code,
          count: result.count,
          fileIds,
        },
      })

      return {
        success: true,
        message: `Đã chuyển thành công ${result.count} hồ sơ vào hộp ${box.code}`,
        count: result.count,
      }
    } catch (error) {
      console.error('Error in batch assign box:', error)
      return apiError(set, 'Không thể chuyển hồ sơ vào hộp lưu trữ', 500)
    }
  }, {
    detail: {
      tags: ['Files'],
      summary: 'Batch assign files to a storage box',
    },
  })
  .get('/api/files/stats', async ({ request, set }) => {
    try {
      const { denied } = await sessionOrDenied({ request, set }, 'viewFiles')
      if (denied) return denied
      const now = new Date()
      const [total, borrowed, overdue, byType] = await Promise.all([
        db.file.count({ where: { NOT: { status: 'ARCHIVED' } } }),
        db.file.count({ where: { status: 'BORROWED' } }),
        db.borrowSlip.count({ where: { OR: [{ status: 'OVERDUE' }, { status: { in: ['BORROWING', 'PARTIAL_RETURN'] }, dueDate: { lt: now } }] } }),
        db.file.groupBy({ by: ['type'], _count: true }),
      ])
      return { total, borrowed, overdue, byType }
    } catch (error) {
      console.error('Error fetching file stats:', error)
      return jsonError(set, 'Internal Server Error', 500)
    }
  })
  .get('/api/files/autocomplete-suggestions', async ({ request, set }) => {
    try {
      const { denied } = await sessionOrDenied({ request, set }, 'viewFiles')
      if (denied) return denied

      const [distinctTypes, distinctRetentions, distinctDocPreservations, recentTitles, recentDocTitles] = await Promise.all([
        db.file.findMany({ select: { type: true }, distinct: ['type'] }),
        db.file.findMany({ select: { retention: true }, distinct: ['retention'] }),
        db.document.findMany({ select: { preservationTime: true }, distinct: ['preservationTime'] }),
        db.file.findMany({
          select: { title: true },
          orderBy: { createdAt: 'desc' },
          take: 100,
          distinct: ['title']
        }),
        db.document.findMany({
          select: { title: true },
          orderBy: { id: 'desc' },
          take: 100,
          distinct: ['title']
        })
      ])

      const predefinedTypes = [
        'Hình sự',
        'Dân sự',
        'Hành chính',
        'Kinh doanh thương mại',
        'Lao động',
        'Hôn nhân gia đình',
        'Hình sự phúc thẩm',
        'Dân sự phúc thẩm',
        'Hôn nhân phúc thẩm'
      ]
      const predefinedRetentions = ['10 năm', '15 năm', '20 năm', '70 năm', 'Vĩnh viễn']

      const typesSet = new Set([...predefinedTypes, ...distinctTypes.map(t => t.type).filter(Boolean)])
      const retentionsSet = new Set([
        ...predefinedRetentions,
        ...distinctRetentions.map(r => r.retention).filter(Boolean),
        ...distinctDocPreservations.map(d => d.preservationTime).filter(Boolean)
      ])

      return {
        types: Array.from(typesSet),
        retentions: Array.from(retentionsSet),
        titles: recentTitles.map(f => f.title).filter(Boolean),
        documentTitles: recentDocTitles.map(d => d.title).filter(Boolean)
      }
    } catch (error) {
      console.error('Error fetching autocomplete suggestions:', error)
      return jsonError(set, 'Internal Server Error', 500)
    }
  })
  .get('/api/files/:id', async ({ request, set, params }) => {
    try {
      const { session, denied } = await sessionOrDenied({ request, set }, 'viewFiles')
      if (denied) return denied
      const file = await db.file.findUnique({
        where: { id: params.id },
        include: {
          box: { include: { agency: true } },
          borrowItems: { where: { status: 'BORROWING' }, include: { borrowSlip: true } },
          documents: { orderBy: { order: 'asc' }, include: { createdBy: { select: USER_SELECT }, updatedBy: { select: USER_SELECT } } },
          fileIndex: true,
          createdBy: { select: USER_SELECT },
          updatedBy: { select: USER_SELECT },
        },
      })
      if (!file) return apiError(set, 'Không tìm thấy hồ sơ', 404)

      if (session?.role === 'COORDINATOR' && file.createdById !== session.id) {
        return apiError(set, 'Không có quyền truy cập hồ sơ này', 403)
      }

      return file
    } catch (error) {
      console.error('Error fetching file:', error)
      return apiError(set, 'Lỗi máy chủ', 500)
    }
  })
  .post('/api/files/:id/qr-token', async ({ request, set, params }) => {
    try {
      const { denied } = await sessionOrDenied({ request, set }, 'viewFiles')
      if (denied) return denied
      const file = await db.file.findUnique({ where: { id: params.id }, select: { id: true, code: true } })
      if (!file) return apiError(set, 'Không tìm thấy hồ sơ', 404)
      const token = await createFileQrToken(file.id)
      return { success: true, token, url: `/qr/files/${encodeURIComponent(token)}` }
    } catch (error) {
      console.error('Create file QR token error:', error)
      return apiError(set, 'Không thể tạo mã QR', 500)
    }
  })
  .get('/api/qr/files/:token', async ({ request, set, params }) => {
    try {
      const { denied } = await sessionOrDenied({ request, set }, 'viewFiles')
      if (denied) return denied
      const payload = await verifyFileQrToken(params.token)
      const file = await db.file.findUnique({
        where: { id: payload.resourceId },
        include: {
          box: { include: { agency: true } },
          borrowItems: { where: { status: 'BORROWING' }, include: { borrowSlip: true } },
          documents: { orderBy: { order: 'asc' }, include: { createdBy: { select: USER_SELECT }, updatedBy: { select: USER_SELECT } } },
          fileIndex: true,
          createdBy: { select: USER_SELECT },
          updatedBy: { select: USER_SELECT },
        },
      })
      if (!file) return apiError(set, 'Không tìm thấy hồ sơ', 404)
      return { success: true, file }
    } catch {
      return apiError(set, 'QR không hợp lệ hoặc đã hết hạn', 401)
    }
  })
  .put('/api/files/:id', async ({ request, set, params }) => {
    try {
      const { session, denied } = await sessionOrDenied({ request, set }, 'manageFiles')
      if (denied) return denied

      const oldFile = await db.file.findUnique({ where: { id: params.id } })
      if (!oldFile) return apiError(set, 'Không tìm thấy hồ sơ', 404)
      if (oldFile.isLocked && !['SUPER_ADMIN', 'ADMIN'].includes(session!.role)) {
        return apiError(set, 'Hồ sơ đã bị khóa, không thể chỉnh sửa', 403)
      }
      if (session!.role === 'COORDINATOR' && oldFile.createdById !== session!.id) {
        return apiError(set, 'Không có quyền chỉnh sửa hồ sơ này', 403)
      }

      const data = await request.json() as Record<string, any>

      if (typeof data.code === 'string' && data.code.trim()) {
        const newCode = data.code.trim()
        if (newCode !== oldFile.code) {
          const duplicateFile = await db.file.findFirst({
            where: {
              code: newCode,
              id: { not: params.id },
            },
            select: { id: true },
          })
          if (duplicateFile) {
            return apiError(set, `Mã hồ sơ "${newCode}" đã tồn tại trong hệ thống.`, 409)
          }
        }
        data.code = newCode
      }

      const fields = [
        'code', 'title', 'type', 'year', 'pageCount', 'retention', 'note',
        'judgmentNumber', 'judgmentDate', 'defendants', 'plaintiffs', 'civilDefendants', 'boxId'
      ]
      const changes: Record<string, { old: any; new: any }> = {}
      for (const field of fields) {
        if (field in data) {
          let oldVal = (oldFile as any)[field]
          let newVal = data[field]

          if (field === 'judgmentDate' && oldVal) {
            oldVal = new Date(oldVal).toISOString().split('T')[0]
          }
          if (field === 'judgmentDate' && newVal) {
            newVal = new Date(newVal).toISOString().split('T')[0]
          }

          if (Array.isArray(oldVal) || Array.isArray(newVal)) {
            const oldStr = JSON.stringify(oldVal || [])
            const newStr = JSON.stringify(newVal || [])
            if (oldStr !== newStr) {
              changes[field] = { old: oldVal, new: newVal }
            }
          } else if (oldVal !== newVal) {
            changes[field] = { old: oldVal, new: newVal }
          }
        }
      }

      const updatedData: Record<string, any> = {}
      for (const field of fields) {
        if (field in data) {
          if (field === 'judgmentDate') {
            updatedData[field] = data[field] ? new Date(data[field]) : null
          } else {
            updatedData[field] = data[field]
          }
        }
      }
      updatedData['updatedById'] = session!.id

      const updatedFile = await db.file.update({
        where: { id: params.id },
        data: updatedData
      })

      if (Object.keys(changes).length > 0) {
        await createAuditLog({
          action: 'UPDATE',
          target: 'File',
          targetId: params.id,
          userId: session!.id,
          ipAddress: getClientIp(request),
          detail: { changes }
        })
      }

      return { success: true, file: updatedFile }
    } catch (error) {
      console.error('Error updating file:', error)
      return apiError(set, 'Không thể cập nhật hồ sơ', 500)
    }
  })
  .delete('/api/files/:id', async ({ request, set, params }) => {
    try {
      const { session, denied } = await sessionOrDenied({ request, set }, 'manageFiles')
      if (denied) return denied

      if (session!.role !== 'SUPER_ADMIN') {
        return apiError(set, 'Chỉ duy nhất SUPER_ADMIN mới được phép xóa hồ sơ chính', 403)
      }

      const file = await db.file.findUnique({ where: { id: params.id }, include: { borrowItems: { select: { id: true, status: true } } } })
      if (!file) return apiError(set, 'Không tìm thấy hồ sơ', 404)
      if (file.status === 'ARCHIVED') {
        return apiError(set, 'Hồ sơ đã được lưu trữ trước đó.', 409)
      }
      if (file.status === 'BORROWED' || file.borrowItems.some((item) => item.status === 'BORROWING')) {
        return apiError(set, 'Không thể lưu trữ hồ sơ đang được mượn.', 409)
      }

      // Giải phóng mã hồ sơ gốc để có thể dùng lại cho hồ sơ mới, đồng thời giữ vết mã cũ trong archivedCode
      const archivedCode = `${file.code}#ARCHIVED-${params.id}`
      await db.file.update({ where: { id: params.id }, data: { code: archivedCode, status: 'ARCHIVED', isLocked: true } })
      await createAuditLog({
        action: 'UPDATE',
        target: 'File',
        targetId: params.id,
        userId: session!.id,
        ipAddress: getClientIp(request),
        macAddress: request.headers.get('x-mac-address') || undefined,
        detail: { code: file.code, archivedCode, title: file.title, status: 'ARCHIVED', action: 'SOFT_DELETE' },
      })
      return { success: true, message: 'Đã lưu trữ hồ sơ' }
    } catch (error) {
      console.error('Error archiving file:', error)
      return apiError(set, 'Không thể lưu trữ hồ sơ', 500)
    }
  })
