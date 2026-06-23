import type { Permission } from '@/lib/rbac'
import { can } from '@/lib/rbac'
import { useSession } from '@/lib/hooks/use-auth'

export function PermissionGate({ permission, children }: { permission: Permission; children: React.ReactNode }) {
  const { session } = useSession()
  if (!can(session?.role, permission)) return null
  return children
}
