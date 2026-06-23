import type { AppSet } from '@/lib/http'
import type { SessionPayload } from '@/lib/session'
import { jsonError } from '@/lib/http'

export const USER_ROLES = ['SUPER_ADMIN', 'ADMIN', 'VIEWER', 'COORDINATOR', 'BASIC_VIEWER'] as const

export type UserRole = (typeof USER_ROLES)[number]

export const permissions = {
  manageUsers: ['SUPER_ADMIN'],
  manageAgencies: ['SUPER_ADMIN'],
  viewAudit: ['SUPER_ADMIN'],
  viewFiles: ['SUPER_ADMIN', 'ADMIN', 'VIEWER', 'COORDINATOR', 'BASIC_VIEWER'],
  manageFiles: ['SUPER_ADMIN', 'ADMIN', 'COORDINATOR'],
  viewBorrow: ['SUPER_ADMIN', 'ADMIN', 'COORDINATOR'],
  manageBorrow: ['SUPER_ADMIN', 'COORDINATOR'],
  viewStorage: ['SUPER_ADMIN', 'ADMIN', 'VIEWER', 'COORDINATOR', 'BASIC_VIEWER'],
  manageStorage: ['SUPER_ADMIN'],
  viewReports: ['SUPER_ADMIN', 'ADMIN', 'VIEWER', 'COORDINATOR', 'BASIC_VIEWER'],
} as const satisfies Record<string, readonly UserRole[]>

export type Permission = keyof typeof permissions

export function isUserRole(role: unknown): role is UserRole {
  return typeof role === 'string' && USER_ROLES.includes(role as UserRole)
}

export function can(role: unknown, permission: Permission) {
  return isUserRole(role) && (permissions[permission] as readonly UserRole[]).includes(role)
}

export function requirePermission(
  set: AppSet,
  session: SessionPayload | null,
  permission: Permission
) {
  if (!session?.id) return jsonError(set, 'Unauthorized', 401)
  if (!can(session.role, permission)) return jsonError(set, 'Forbidden', 403)
  return null
}
