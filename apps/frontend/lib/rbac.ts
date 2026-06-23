export const USER_ROLES = ['SUPER_ADMIN', 'ADMIN', 'VIEWER', 'COORDINATOR', 'BASIC_VIEWER'] as const

export type UserRole = (typeof USER_ROLES)[number]
export type PermissionSession = { id?: string | null; role?: unknown } | null

export const permissions = {
  manageUsers: ['SUPER_ADMIN'],
  manageAgencies: ['SUPER_ADMIN'],
  manageMaintenance: ['SUPER_ADMIN'],
  viewAudit: ['SUPER_ADMIN'],
  viewFiles: ['SUPER_ADMIN', 'ADMIN', 'VIEWER', 'COORDINATOR', 'BASIC_VIEWER'],
  createFiles: ['SUPER_ADMIN', 'ADMIN', 'COORDINATOR'],
  manageFiles: ['SUPER_ADMIN', 'ADMIN'],
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
  session: PermissionSession,
  permission: Permission
) {
  if (!session?.id) {
    return { error: 'Unauthorized', status: 401 }
  }

  if (!can(session.role, permission)) {
    return { error: 'Forbidden', status: 403 }
  }

  return null
}
