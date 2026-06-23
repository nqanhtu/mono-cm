import type { AppSet } from '@/lib/http'
import { jsonError } from '@/lib/http'
import { requirePermission, type Permission } from '@/lib/rbac'
import { getSession, type SessionPayload } from '@/lib/session'

type RouteContext = {
  request: Request
  set: AppSet
}

export async function sessionOrDenied(ctx: RouteContext, permission?: Permission) {
  const session = await getSession(ctx.request.headers)
  if (permission) {
    const denied = requirePermission(ctx.set, session, permission)
    if (denied) return { denied }
  } else if (!session) {
    return { denied: jsonError(ctx.set, 'Unauthorized', 401) }
  }
  return { session }
}

export function requireSuperAdmin(set: AppSet, session: SessionPayload | null) {
  if (!session) return jsonError(set, 'Unauthorized', 401)
  if (session.role !== 'SUPER_ADMIN') return jsonError(set, 'Forbidden', 403)
  return null
}

export function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File
}

export const USER_SELECT = {
  id: true,
  username: true,
  fullName: true,
  unit: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const
