import { Elysia } from 'elysia'
import bcrypt from 'bcryptjs'

import { db } from '@/lib/db'
import { jsonError, apiError, apiSuccess } from '@/lib/http'
import { isUserRole } from '@/lib/rbac'
import { sessionOrDenied, USER_SELECT, isUploadedFile } from '@/api-routes/_shared'
import { parseUserUpload, previewUserImport, commitUserImport } from '@/lib/services/user-import'

export const userRoutes = new Elysia()
  .get('/api/users', async ({ request, set, query }) => {
    try {
      const purpose = query.purpose
      const { session, denied } = await sessionOrDenied({ request, set }, purpose === 'borrower' ? 'manageBorrow' : 'manageUsers')
      if (denied) return denied

      if (purpose === 'borrower') {
        return await db.user.findMany({
          where: { status: true },
          select: USER_SELECT,
          orderBy: { fullName: 'asc' },
        })
      }
      
      if (purpose === 'coordinator') {
        return await db.user.findMany({
          where: { status: true, role: 'COORDINATOR' },
          select: USER_SELECT,
          orderBy: { fullName: 'asc' },
        })
      }

      return await db.user.findMany({
        omit: { password: true },
        orderBy: { createdAt: 'desc' },
      })
    } catch (error) {
      console.error('Error fetching users:', error)
      return jsonError(set, 'Internal Server Error', 500)
    }
  })
  .post('/api/users', async ({ request, set }) => {
    try {
      const { denied } = await sessionOrDenied({ request, set }, 'manageUsers')
      if (denied) return denied

      const data = await request.json() as Record<string, unknown>
      if (data.role && !isUserRole(data.role)) return jsonError(set, 'Invalid role', 400)
      if (!data.password || typeof data.password !== 'string') return jsonError(set, 'Password is required', 400)

      const user = await db.user.create({
        data: {
          username: String(data.username ?? '').trim(),
          fullName: String(data.fullName ?? '').trim(),
          unit: data.unit ? String(data.unit).trim() : null,
          role: isUserRole(data.role) ? data.role : undefined,
          status: data.status === true || data.status === 'active',
          password: await bcrypt.hash(data.password, 10),
        },
      })
      return { success: true, user }
    } catch (error) {
      console.error('Error creating user:', error)
      return jsonError(set, 'Internal Server Error', 500)
    }
  })
  .get('/api/users/:id', async ({ request, set, params }) => {
    try {
      const { denied } = await sessionOrDenied({ request, set }, 'manageUsers')
      if (denied) return denied

      const user = await db.user.findUnique({ where: { id: params.id }, select: USER_SELECT })
      if (!user) return jsonError(set, 'User not found', 404)
      return user
    } catch (error) {
      console.error('Error fetching user:', error)
      return jsonError(set, 'Internal Server Error', 500)
    }
  })
  .put('/api/users/:id', async ({ request, set, params }) => {
    try {
      const { denied } = await sessionOrDenied({ request, set }, 'manageUsers')
      if (denied) return denied

      const data = await request.json() as Record<string, unknown>
      if (data.role && !isUserRole(data.role)) return jsonError(set, 'Invalid role', 400)

      const updateData: Record<string, unknown> = {}
      if ('fullName' in data) updateData.fullName = String(data.fullName ?? '').trim()
      if ('unit' in data) updateData.unit = data.unit ? String(data.unit).trim() : null
      if ('role' in data) updateData.role = data.role
      if ('status' in data) updateData.status = data.status === true || data.status === 'active'
      if (data.password && typeof data.password === 'string' && data.password.trim()) {
        updateData.password = await bcrypt.hash(data.password, 10)
      }

      if (Object.keys(updateData).length === 0) return jsonError(set, 'Không có dữ liệu để cập nhật', 400)

      const user = await db.user.update({ where: { id: params.id }, data: updateData, select: USER_SELECT })
      return { success: true, user }
    } catch (error) {
      console.error('Error updating user:', error)
      set.status = 500
      return { error: error instanceof Error ? error.message : 'Internal Server Error' }
    }
  })
  .delete('/api/users/:id', async ({ request, set, params }) => {
    try {
      const { denied } = await sessionOrDenied({ request, set }, 'manageUsers')
      if (denied) return denied
      await db.user.delete({ where: { id: params.id } })
      return { success: true }
    } catch (error) {
      console.error('Error deleting user:', error)
      set.status = 500
      return { error: error instanceof Error ? error.message : 'Internal Server Error' }
    }
  })
  .post('/api/users/import/preview', async ({ request, set }) => {
    try {
      const { denied } = await sessionOrDenied({ request, set }, 'manageUsers')
      if (denied) return denied
      const formData = await request.formData()
      const file = formData.get('file')
      if (!isUploadedFile(file)) return apiError(set, 'Vui lòng chọn file Excel hoặc CSV', 400)
      return apiSuccess(await previewUserImport(await parseUserUpload(file)))
    } catch (error) {
      console.error('User import preview error:', error)
      return apiError(set, error instanceof Error ? error.message : 'Không thể đọc file', 500)
    }
  })
  .post('/api/users/import/commit', async ({ request, set }) => {
    try {
      const { session, denied } = await sessionOrDenied({ request, set }, 'manageUsers')
      if (denied) return denied
      const formData = await request.formData()
      const file = formData.get('file')
      if (!isUploadedFile(file)) return apiError(set, 'Vui lòng chọn file Excel hoặc CSV', 400)
      const result = await commitUserImport(await parseUserUpload(file), session!.id)
      if (!result.success) return apiError(set, 'File còn lỗi, chưa thể nhập dữ liệu', 422, result.preview.issues)
      return apiSuccess({ stats: result.stats, preview: result.preview }, 'Nhập danh sách người dùng thành công')
    } catch (error) {
      console.error('User import commit error:', error)
      return apiError(set, error instanceof Error ? error.message : 'Không thể nhập dữ liệu', 500)
    }
  })

