import { Elysia } from 'elysia'

import { db } from '@/lib/db'
import { apiError, apiSuccess, jsonError } from '@/lib/http'
import { getClientIp } from '@/lib/request'
import { getSession } from '@/lib/session'
import { requirePermission } from '@/lib/rbac'
import { sessionOrDenied } from '@/api-routes/_shared'
import { createAuditLog } from '@/lib/services/audit-log'
import { createBorrowSlipEvent } from '@/lib/services/borrow'
import { borrowReturnSchema } from '@/lib/validation/borrow'

export const borrowRoutes = new Elysia()
  .get('/api/borrow', async ({ request, set }) => {
    try {
      const { denied } = await sessionOrDenied({ request, set }, 'viewBorrow')
      if (denied) return denied
      return await db.borrowSlip.findMany({ include: { lender: true, items: { include: { file: true } } }, orderBy: { createdAt: 'desc' } })
    } catch (error) {
      console.error('Error fetching borrow slips:', error)
      return jsonError(set, 'Internal Server Error', 500)
    }
  })
  .post('/api/borrow', async ({ request, set }) => {
    try {
      const { session, denied } = await sessionOrDenied({ request, set }, 'manageBorrow')
      if (denied) return denied
      const data = await request.json() as { borrowerName: string; borrowerUnit?: string; borrowerTitle?: string; reason?: string; dueDate: string; fileIds: string[] }
      const { borrowerName, borrowerUnit, borrowerTitle, reason, dueDate, fileIds } = data
      const files = await db.file.findMany({ where: { id: { in: fileIds } } })
      const unavailable = files.filter((file) => file.status === 'BORROWED')
      if (unavailable.length > 0) return { success: false, message: `Hồ sơ ${unavailable.map((file) => file.code).join(', ')} đang được mượn.` }
      const reserved = await db.borrowItem.findFirst({
        where: {
          fileId: { in: fileIds },
          status: { in: ['REQUESTED', 'APPROVED', 'BORROWING'] },
          borrowSlip: { status: { in: ['PENDING_APPROVAL', 'APPROVED', 'EXPORTED', 'PARTIAL_RETURN', 'OVERDUE'] } },
        },
        include: { file: { select: { code: true } } },
      })
      if (reserved) {
        return apiError(set, `Hồ sơ ${reserved.file.code} đang có yêu cầu mượn hoặc đang được mượn.`, 409)
      }
      const slipCode = `PM-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`
      const slip = await db.$transaction(async (tx) => {
        return await tx.borrowSlip.create({
          data: {
            code: slipCode,
            borrowerName,
            borrowerUnit,
            borrowerTitle,
            reason,
            dueDate: new Date(dueDate),
            lenderId: session!.id,
            status: 'PENDING_APPROVAL',
            items: { create: fileIds.map((fileId) => ({ fileId, status: 'REQUESTED' })) },
          },
        })
      })
      await createBorrowSlipEvent({ borrowSlipId: slip.id, eventType: 'REQUESTED', description: 'Tạo yêu cầu mượn hồ sơ', details: { code: slip.code, files: fileIds }, creatorId: session!.id })
      await createAuditLog({ action: 'CREATE', target: 'BorrowSlip', targetId: slip.id, userId: session!.id, ipAddress: getClientIp(request), detail: { code: slip.code, files: fileIds } })
      return { success: true, slipId: slip.id }
    } catch (error) {
      console.error('Create Borrow Slip Error:', error)
      set.status = 500
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' }
    }
  })
  .post('/api/borrow/:id/approve', async ({ request, set, params }) => {
    const session = await getSession(request.headers)
    if (!session) return jsonError(set, 'Unauthorized', 401)
    if (!['SUPER_ADMIN', 'ADMIN'].includes(session.role)) return jsonError(set, 'Forbidden', 403)
    try {
      const slip = await db.borrowSlip.findUnique({ where: { id: params.id } })
      if (!slip) return apiError(set, 'Phiếu mượn không tồn tại', 404)
      if (slip.status !== 'PENDING_APPROVAL') return apiError(set, 'Chỉ có thể duyệt yêu cầu đang chờ duyệt', 400)
      const updated = await db.borrowSlip.update({
        where: { id: params.id },
        data: { status: 'APPROVED', approvedById: session!.id, approvedAt: new Date() },
      })
      await db.borrowItem?.updateMany?.({ where: { borrowSlipId: params.id, status: 'REQUESTED' }, data: { status: 'APPROVED' } })
      await createBorrowSlipEvent({ borrowSlipId: params.id, eventType: 'APPROVED', description: 'Duyệt yêu cầu mượn', creatorId: session!.id })
      await createAuditLog({ action: 'UPDATE', target: 'BorrowSlip', targetId: params.id, userId: session!.id, ipAddress: getClientIp(request), detail: { status: 'APPROVED' } })
      return { success: true, status: updated.status }
    } catch (error) {
      console.error('Approve borrow slip error:', error)
      return apiError(set, 'Không thể duyệt yêu cầu mượn', 500)
    }
  })
  .post('/api/borrow/:id/reject', async ({ request, set, params }) => {
    const session = await getSession(request.headers)
    if (!session) return jsonError(set, 'Unauthorized', 401)
    if (!['SUPER_ADMIN', 'ADMIN'].includes(session.role)) return jsonError(set, 'Forbidden', 403)
    try {
      const body = await request.json().catch(() => ({})) as { reason?: string }
      const slip = await db.borrowSlip.findUnique({ where: { id: params.id } })
      if (!slip) return apiError(set, 'Phiếu mượn không tồn tại', 404)
      if (slip.status !== 'PENDING_APPROVAL') return apiError(set, 'Chỉ có thể từ chối yêu cầu đang chờ duyệt', 400)
      const updated = await db.borrowSlip.update({
        where: { id: params.id },
        data: { status: 'REJECTED', rejectedById: session!.id, rejectedAt: new Date(), rejectReason: body.reason || null },
      })
      await db.borrowItem?.updateMany?.({ where: { borrowSlipId: params.id, status: 'REQUESTED' }, data: { status: 'RETURNED' } })
      await createBorrowSlipEvent({ borrowSlipId: params.id, eventType: 'REJECTED', description: 'Từ chối yêu cầu mượn', details: { reason: body.reason }, creatorId: session!.id })
      await createAuditLog({ action: 'UPDATE', target: 'BorrowSlip', targetId: params.id, userId: session!.id, ipAddress: getClientIp(request), detail: { status: 'REJECTED', reason: body.reason } })
      return { success: true, status: updated.status }
    } catch (error) {
      console.error('Reject borrow slip error:', error)
      return apiError(set, 'Không thể từ chối yêu cầu mượn', 500)
    }
  })
  .post('/api/borrow/:id/export', async ({ request, set, params }) => {
    const session = await getSession(request.headers)
    const denied = requirePermission(set, session, 'manageBorrow')
    if (denied) return denied
    try {
      const slip = await db.borrowSlip.findUnique({ where: { id: params.id }, include: { items: true } })
      if (!slip) return apiError(set, 'Phiếu mượn không tồn tại', 404)
      if (slip.status !== 'APPROVED') return apiError(set, 'Chỉ có thể xuất hồ sơ sau khi yêu cầu đã được duyệt', 400)
      const fileIds = slip.items.map((item) => item.fileId)
      await db.$transaction(async (tx) => {
        const updatedBatch = await tx.file.updateMany({ where: { id: { in: fileIds }, status: 'IN_STOCK' }, data: { status: 'BORROWED' } })
        if (updatedBatch.count !== fileIds.length) throw new Error('Một hoặc nhiều hồ sơ đã được mượn bởi người khác hoặc không tồn tại.')
        await tx.borrowItem.updateMany({ where: { borrowSlipId: params.id }, data: { status: 'BORROWING' } })
        await tx.borrowSlip.update({ where: { id: params.id }, data: { status: 'EXPORTED', exportedById: session!.id, exportedAt: new Date() } })
      })
      await createBorrowSlipEvent({ borrowSlipId: params.id, eventType: 'EXPORTED', description: 'Xuất hồ sơ cho người mượn', details: { files: fileIds }, creatorId: session!.id })
      await createAuditLog({ action: 'UPDATE', target: 'BorrowSlip', targetId: params.id, userId: session!.id, ipAddress: getClientIp(request), detail: { status: 'EXPORTED', files: fileIds } })
      return { success: true, status: 'EXPORTED' }
    } catch (error) {
      console.error('Export borrow slip error:', error)
      return apiError(set, error instanceof Error ? error.message : 'Không thể xuất hồ sơ', 500)
    }
  })
  .put('/api/borrow', async ({ request, set }) => {
    try {
      const { session, denied } = await sessionOrDenied({ request, set }, 'manageBorrow')
      if (denied) return denied
      const data = await request.json() as { id: string }
      const id = data.id
      await db.$transaction(async (tx) => {
        const borrowSlip = await tx.borrowSlip.findUnique({ where: { id }, include: { items: true } })
        if (!borrowSlip) throw new Error('Phiếu mượn không tồn tại.')
        if (borrowSlip.status === 'RETURNED') throw new Error('Phiếu mượn đã được trả.')
        const fileIds = borrowSlip.items.map((item) => item.fileId)
        await tx.borrowSlip.update({ where: { id }, data: { status: 'RETURNED' } })
        await tx.borrowItem.updateMany({ where: { borrowSlipId: id }, data: { status: 'RETURNED' } })
        await tx.file.updateMany({ where: { id: { in: fileIds } }, data: { status: 'IN_STOCK' } })
      })
      await createAuditLog({ action: 'UPDATE', target: 'BorrowSlip', targetId: id, detail: { status: 'RETURNED' }, userId: session!.id, ipAddress: getClientIp(request) })
      return { success: true }
    } catch (error) {
      console.error('Return Borrow Slip Error:', error)
      set.status = 500
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' }
    }
  })
  .get('/api/borrow/alerts', async ({ request, set }) => {
    try {
      const { denied } = await sessionOrDenied({ request, set }, 'viewBorrow')
      if (denied) return denied
      const now = new Date()
      const soonDate = new Date()
      soonDate.setDate(now.getDate() + 3)
      await db.borrowSlip.updateMany({ where: { status: { in: ['EXPORTED', 'PARTIAL_RETURN'] }, dueDate: { lt: now } }, data: { status: 'OVERDUE' } })
      const include = { lender: { select: { fullName: true, username: true } }, items: { include: { file: { select: { code: true, title: true } } } } }
      const overdue = await db.borrowSlip.findMany({ where: { status: 'OVERDUE' }, include, orderBy: { dueDate: 'asc' } })
      const soonOverdue = await db.borrowSlip.findMany({ where: { status: { in: ['EXPORTED', 'PARTIAL_RETURN'] }, dueDate: { gte: now, lte: soonDate } }, include, orderBy: { dueDate: 'asc' } })
      return { overdueCount: overdue.length, soonOverdueCount: soonOverdue.length, overdue, soonOverdue }
    } catch (error) {
      console.error('Error fetching borrow alerts:', error)
      return jsonError(set, 'Internal Server Error', 500)
    }
  })
  .get('/api/borrow/:id', async ({ request, set, params }) => {
    try {
      const { denied } = await sessionOrDenied({ request, set }, 'viewBorrow')
      if (denied) return denied
      const borrowSlip = await db.borrowSlip.findUnique({ where: { id: params.id }, include: { lender: true, items: { include: { file: true } } } })
      if (!borrowSlip) return jsonError(set, 'Borrow slip not found', 404)
      return borrowSlip
    } catch (error) {
      console.error('Error fetching borrow slip:', error)
      return jsonError(set, 'Internal Server Error', 500)
    }
  })
  .put('/api/borrow/:id', async ({ request, set, params }) => {
    try {
      const { session, denied } = await sessionOrDenied({ request, set }, 'manageBorrow')
      if (denied) return denied
      const data = await request.json() as { borrowerName: string; borrowerUnit?: string; borrowerTitle?: string; reason?: string; dueDate: string; fileIds: string[] }
      const { borrowerName, borrowerUnit, borrowerTitle, reason, dueDate, fileIds } = data
      const currentSlip = await db.borrowSlip.findUnique({ where: { id: params.id }, include: { items: true } })
      if (!currentSlip) return apiError(set, 'Phiếu mượn không tồn tại', 404)
      const currentFileIds = currentSlip.items.map((item) => item.fileId)
      const addedFileIds = fileIds.filter((fileId) => !currentFileIds.includes(fileId))
      const removedFileIds = currentFileIds.filter((fileId) => !fileIds.includes(fileId))
      if (addedFileIds.length > 0) {
        const files = await db.file.findMany({ where: { id: { in: addedFileIds } } })
        const unavailable = files.filter((file) => file.status === 'BORROWED')
        if (unavailable.length > 0) return { success: false, message: `Hồ sơ ${unavailable.map((file) => file.code).join(', ')} đang được mượn.` }
      }
      await db.$transaction(async (tx) => {
        if (addedFileIds.length > 0) {
          await tx.file.updateMany({ where: { id: { in: addedFileIds }, status: 'IN_STOCK' }, data: { status: 'BORROWED' } })
          await tx.borrowItem.createMany({ data: addedFileIds.map((fileId) => ({ borrowSlipId: params.id, fileId, status: 'BORROWING' })) })
        }
        if (removedFileIds.length > 0) {
          await tx.file.updateMany({ where: { id: { in: removedFileIds } }, data: { status: 'IN_STOCK' } })
          await tx.borrowItem.deleteMany({ where: { borrowSlipId: params.id, fileId: { in: removedFileIds } } })
        }
        await tx.borrowSlip.update({ where: { id: params.id }, data: { borrowerName, borrowerUnit, borrowerTitle, reason, dueDate: new Date(dueDate) } })
      })
      if (addedFileIds.length > 0) {
        const addedFiles = await db.file.findMany({ where: { id: { in: addedFileIds } }, select: { code: true } })
        await createBorrowSlipEvent({ borrowSlipId: params.id, eventType: 'ADD_FILE', description: `Thêm ${addedFileIds.length} hồ sơ`, details: { files: addedFiles.map((file) => file.code) }, creatorId: session!.id })
      }
      if (removedFileIds.length > 0) {
        const removedFiles = await db.file.findMany({ where: { id: { in: removedFileIds } }, select: { code: true } })
        await createBorrowSlipEvent({ borrowSlipId: params.id, eventType: 'REMOVE_FILE', description: `Đã trả/xóa ${removedFileIds.length} hồ sơ`, details: { files: removedFiles.map((file) => file.code) }, creatorId: session!.id })
      }
      const newDueDate = new Date(dueDate)
      if (currentSlip.borrowerName !== borrowerName || currentSlip.reason !== reason || currentSlip.dueDate.getTime() !== newDueDate.getTime()) {
        await createBorrowSlipEvent({ borrowSlipId: params.id, eventType: 'UPDATE_INFO', description: 'Cập nhật thông tin phiếu', details: { changes: { borrowerName: currentSlip.borrowerName !== borrowerName ? { from: currentSlip.borrowerName, to: borrowerName } : undefined, reason: currentSlip.reason !== reason ? { from: currentSlip.reason, to: reason } : undefined, dueDate: currentSlip.dueDate.toISOString() !== newDueDate.toISOString() ? { from: currentSlip.dueDate, to: newDueDate } : undefined } }, creatorId: session!.id })
      }
      await createAuditLog({ action: 'UPDATE', target: 'BorrowSlip', targetId: params.id, detail: { changes: { borrowerName: currentSlip.borrowerName !== borrowerName ? { from: currentSlip.borrowerName, to: borrowerName } : undefined, reason: currentSlip.reason !== reason ? { from: currentSlip.reason, to: reason } : undefined } }, userId: session!.id, ipAddress: getClientIp(request) })
      return { success: true }
    } catch (error) {
      console.error('Update Borrow Slip Error:', error)
      set.status = 500
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' }
    }
  })
  .put('/api/borrow/:id/return', async ({ request, set, params }) => {
    try {
      const { session, denied } = await sessionOrDenied({ request, set }, 'manageBorrow')
      if (denied) return denied
      const parsed = borrowReturnSchema.safeParse(await request.json())
      if (!parsed.success) return apiError(set, 'Dữ liệu trả hồ sơ không hợp lệ', 400, parsed.error.flatten())
      const returnedDate = parsed.data.returnedDate ?? new Date()
      const result = await db.$transaction(async (tx) => {
        const slip = await tx.borrowSlip.findUnique({ where: { id: params.id }, include: { items: { include: { file: true } } } })
        if (!slip) throw new Error('Phiếu mượn không tồn tại')
        if (slip.status === 'RETURNED') throw new Error('Phiếu mượn đã được trả toàn bộ')
        if (!['EXPORTED', 'PARTIAL_RETURN', 'OVERDUE'].includes(slip.status)) throw new Error('Chỉ có thể trả hồ sơ sau khi đã xuất')
        const borrowingItems = slip.items.filter((item) => item.status === 'BORROWING')
        const requestedItemIds = parsed.data.itemIds?.length ? new Set(parsed.data.itemIds) : new Set(borrowingItems.map((item) => item.id))
        const returningItems = borrowingItems.filter((item) => requestedItemIds.has(item.id))
        if (returningItems.length === 0) throw new Error('Không có hồ sơ nào cần trả')
        await tx.borrowItem.updateMany({ where: { id: { in: returningItems.map((item) => item.id) } }, data: { status: 'RETURNED', returnedDate, condition: parsed.data.condition } })
        await tx.file.updateMany({ where: { id: { in: returningItems.map((item) => item.fileId) } }, data: { status: 'IN_STOCK' } })
        const nextStatus = borrowingItems.length - returningItems.length > 0 ? 'PARTIAL_RETURN' : 'RETURNED'
        await tx.borrowSlip.update({ where: { id: params.id }, data: { status: nextStatus, returnedDate: nextStatus === 'RETURNED' ? returnedDate : null } })
        return { nextStatus, returnedCodes: returningItems.map((item) => item.file.code) }
      })
      await createBorrowSlipEvent({ borrowSlipId: params.id, eventType: result.nextStatus === 'RETURNED' ? 'RETURNED_ALL' : 'RETURNED_PARTIAL', description: `Trả ${result.returnedCodes.length} hồ sơ`, details: { files: result.returnedCodes, condition: parsed.data.condition, note: parsed.data.note, returnedDate }, creatorId: session!.id })
      await createAuditLog({ action: 'UPDATE', target: 'BorrowSlip', targetId: params.id, userId: session!.id, ipAddress: getClientIp(request), detail: { status: result.nextStatus, returnedFiles: result.returnedCodes } })
      return apiSuccess(result, 'Đã cập nhật trả hồ sơ')
    } catch (error) {
      console.error('Return borrow slip error:', error)
      return apiError(set, error instanceof Error ? error.message : 'Không thể trả hồ sơ', 500)
    }
  })
  .get('/api/borrow/:id/borrow-slip-event', async ({ request, set, params }) => {
    try {
      const { denied } = await sessionOrDenied({ request, set }, 'viewBorrow')
      if (denied) return denied
      return await db.borrowSlipEvent.findMany({ where: { borrowSlipId: params.id }, include: { creator: { select: { fullName: true, username: true } } }, orderBy: { createdAt: 'desc' } })
    } catch (error) {
      console.error('Get Borrow Events Error:', error)
      return jsonError(set, 'Internal Server Error', 500)
    }
  })
  .post('/api/borrow/:id/borrow-slip-event', async ({ request, set, params }) => {
    try {
      const { session, denied } = await sessionOrDenied({ request, set }, 'manageBorrow')
      if (denied) return denied
      const body = await request.json() as { eventType?: string; description?: string; details?: unknown }
      if (!body.eventType) return jsonError(set, 'eventType is required', 400)
      const event = await db.borrowSlipEvent.create({ data: { borrowSlipId: params.id, eventType: body.eventType, description: body.description, details: body.details ? JSON.stringify(body.details) : undefined, creatorId: session!.id } })
      return { success: true, event }
    } catch (error) {
      console.error('Create Borrow Event Error:', error)
      return jsonError(set, 'Internal Server Error', 500)
    }
  })
