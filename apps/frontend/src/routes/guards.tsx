import { Loader2 } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useSession } from '@/lib/hooks/use-auth'
import { can, type Permission } from '@/lib/rbac'

export function LoginRoute({ children }: { children: React.ReactNode }) {
  const { session, isLoading } = useSession()
  const location = useLocation()
  if (isLoading) return <FullPageSpinner />
  if (session) {
    const redirectTo = typeof location.state?.from === 'string' ? location.state.from : '/'
    return <Navigate to={redirectTo} replace />
  }
  return children
}

export function ProtectedRoute() {
  const { session, isLoading } = useSession()
  const location = useLocation()

  if (isLoading) return <FullPageSpinner />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <Outlet />
}

export function PermissionRoute({ permission, children }: { permission: Permission; children: React.ReactNode }) {
  const { session } = useSession()
  if (!can(session?.role, permission)) return <Navigate to="/forbidden" replace />
  return children
}

function FullPageSpinner() {
  return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}
