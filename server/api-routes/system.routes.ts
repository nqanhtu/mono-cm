import { Elysia } from 'elysia'

import { db } from '@/lib/db'
import { jsonError } from '@/lib/http'
import { getClientIp } from '@/lib/request'
import { getSession } from '@/lib/session'
import { createAuditLog } from '@/lib/services/audit-log'

export const systemRoutes = new Elysia()
  .post('/api/reset', async ({ request, set }) => {
    try {
      const session = await getSession(request.headers)
      if (!session) return jsonError(set, 'Chưa đăng nhập', 401)
      if (session.role !== 'SUPER_ADMIN') return jsonError(set, 'Chỉ SUPER_ADMIN mới có quyền thực hiện thao tác này', 403)
      const body = await request.json().catch(() => ({})) as { confirm?: string }
      if (body.confirm !== 'RESET') return jsonError(set, 'Thiếu xác nhận. Gửi body { "confirm": "RESET" } để tiếp tục.', 400)
      const [deletedEvents, deletedItems, deletedSlips, deletedDocs, deletedIndexes, deletedFiles] = await db.$transaction([db.borrowSlipEvent.deleteMany({}), db.borrowItem.deleteMany({}), db.borrowSlip.deleteMany({}), db.document.deleteMany({}), db.fileIndex.deleteMany({}), db.file.deleteMany({})])
      const deletedCounts = { files: deletedFiles.count, documents: deletedDocs.count, fileIndexes: deletedIndexes.count, borrowSlips: deletedSlips.count, borrowItems: deletedItems.count, borrowSlipEvents: deletedEvents.count }
      await createAuditLog({ action: 'DELETE', target: 'System', targetId: 'reset', userId: session.id, ipAddress: getClientIp(request), detail: { action: 'FULL_RESET', deletedCounts } })
      return { success: true, message: 'Đã xóa toàn bộ dữ liệu hồ sơ và phiếu mượn.', deletedCounts }
    } catch (error) {
      console.error('Reset error:', error)
      set.status = 500
      return { error: error instanceof Error ? error.message : 'Lỗi hệ thống khi reset dữ liệu' }
    }
  })
