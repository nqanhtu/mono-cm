import { Elysia } from 'elysia'

import { db } from '@/lib/db'
import { apiError } from '@/lib/http'
import { getClientIp } from '@/lib/request'
import { sessionOrDenied } from '@/api-routes/_shared'
import { createAuditLog } from '@/lib/services/audit-log'

export const documentRoutes = new Elysia()
  .post('/api/documents', async ({ request, set }) => {
    try {
      const { session, denied } = await sessionOrDenied({ request, set }, 'manageFiles')
      if (denied) return denied
      const data = await request.json() as Record<string, unknown>
      const fileId = String(data.fileId)
      
      const file = await db.file.findUnique({ where: { id: fileId } })
      if (!file) return apiError(set, 'Không tìm thấy hồ sơ', 404)
      if (file.isLocked && !['SUPER_ADMIN', 'ADMIN'].includes(session!.role)) {
        return apiError(set, 'Hồ sơ đã bị khóa, không thể thêm tài liệu con', 403)
      }
      if (session!.role === 'COORDINATOR' && file.createdById !== session!.id) {
        return apiError(set, 'Không có quyền thêm tài liệu vào hồ sơ này', 403)
      }

      const newDoc = await db.document.create({
        data: {
          fileId,
          title: String(data.title ?? ''),
          code: data.code ? String(data.code) : null,
          year: data.year ? Number(data.year) : null,
          pageCount: data.pageCount ? Number(data.pageCount) : null,
          order: data.order ? Number(data.order) : 0,
          note: data.note ? String(data.note) : null,
          preservationTime: data.preservationTime ? String(data.preservationTime) : null,
          contentIndex: data.contentIndex ? String(data.contentIndex) : null,
          createdById: session!.id,
          updatedById: session!.id,
        },
      })
      await createAuditLog({ action: 'CREATE', target: 'Document', targetId: newDoc.id, detail: { title: newDoc.title, fileId }, userId: session!.id, ipAddress: getClientIp(request) })
      return { success: true, data: newDoc }
    } catch (error) {
      console.error('Create document error:', error)
      return apiError(set, 'Failed to create document', 500)
    }
  })
  .put('/api/documents/:id', async ({ request, set, params }) => {
    try {
      const { session, denied } = await sessionOrDenied({ request, set }, 'manageFiles')
      if (denied) return denied

      // Retrieve document and check if parent file is locked
      const doc = await db.document.findUnique({
        where: { id: params.id },
        include: { file: true }
      })
      if (!doc) return apiError(set, 'Document not found', 404)
      if (doc.file.isLocked && !['SUPER_ADMIN', 'ADMIN'].includes(session!.role)) {
        return apiError(set, 'File is locked', 403)
      }
      if (session!.role === 'COORDINATOR' && doc.file.createdById !== session!.id) {
        return apiError(set, 'Không có quyền chỉnh sửa tài liệu thuộc hồ sơ này', 403)
      }

      const data = await request.json() as Record<string, unknown>
      const updatedDoc = await db.document.update({
        where: { id: params.id },
        data: {
          title: data.title ? String(data.title) : undefined,
          code: data.code ? String(data.code) : null,
          year: data.year ? Number(data.year) : null,
          pageCount: data.pageCount ? Number(data.pageCount) : null,
          order: data.order ? Number(data.order) : undefined,
          note: data.note ? String(data.note) : null,
          preservationTime: data.preservationTime ? String(data.preservationTime) : null,
          contentIndex: data.contentIndex ? String(data.contentIndex) : null,
          updatedById: session!.id,
        },
      })
      await createAuditLog({ action: 'UPDATE', target: 'Document', targetId: updatedDoc.id, detail: { title: updatedDoc.title }, userId: session!.id, ipAddress: getClientIp(request) })
      return { success: true, data: updatedDoc }
    } catch (error) {
      console.error('Update document error:', error)
      return apiError(set, 'Failed to update document', 500)
    }
  })
  .delete('/api/documents/:id', async ({ request, set, params }) => {
    try {
      const { session, denied } = await sessionOrDenied({ request, set }, 'manageFiles')
      if (denied) return denied

      if (session!.role !== 'SUPER_ADMIN') {
        return apiError(set, 'Chỉ duy nhất SUPER_ADMIN mới được phép xóa hồ sơ con', 403)
      }

      // Retrieve document and check if parent file is locked
      const docToDelete = await db.document.findUnique({
        where: { id: params.id },
        include: { file: true }
      })
      if (!docToDelete) return apiError(set, 'Document not found', 404)

      await db.document.delete({ where: { id: params.id } })
      await createAuditLog({
        action: 'DELETE',
        target: 'Document',
        targetId: params.id,
        detail: { title: docToDelete.title, fileId: docToDelete.fileId },
        userId: session!.id,
        ipAddress: getClientIp(request),
        macAddress: request.headers.get('x-mac-address') || undefined,
      })
      return { success: true }
    } catch (error) {
      console.error('Delete document error:', error)
      return apiError(set, 'Failed to delete document', 500)
    }
  })
