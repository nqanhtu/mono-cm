import { QueryClientProvider } from '@tanstack/react-query'
import type React from 'react'
import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

import { Toaster } from '@/components/ui/sonner'
import { SessionProvider } from '@/lib/hooks/use-auth'
import { queryClient } from '@/src/lib/query-client'
import { MainLayout } from '@/src/layouts/main-layout'
import { LoginRoute, PermissionRoute, ProtectedRoute } from '@/src/routes/guards'
import { RouteErrorBoundary } from '@/src/routes/route-error-boundary'
import type { Permission } from '@/lib/rbac'

const Home = lazy(() => import('@/src/routes/files/files-page'))
const LoginPage = lazy(() => import('@/src/routes/auth/login-page'))
const FileDetailPage = lazy(() => import('@/src/routes/files/file-detail-page'))
const BorrowPage = lazy(() => import('@/src/routes/borrow/borrow-page'))
const CreateBorrowPage = lazy(() => import('@/src/routes/borrow/create-borrow-page'))
const UploadPage = lazy(() => import('@/src/routes/upload/upload-page'))
const UsersPage = lazy(() => import('@/src/routes/users/users-page'))
const AgencyPage = lazy(() => import('@/src/routes/admin/agency-page'))
const AuditLogPage = lazy(() => import('@/src/routes/admin/audit-page'))
const StorageBoxesPage = lazy(() => import('@/src/routes/admin/storage-boxes-page'))
const BackupPage = lazy(() => import('@/src/routes/admin/backup-page'))
const Reports = lazy(() => import('@/src/routes/reports/reports-page'))
const ResetPage = lazy(() => import('@/src/routes/reset/reset-page'))
const ForbiddenPage = lazy(() => import('@/src/routes/forbidden-page'))
const QrFilePage = lazy(() => import('@/src/routes/qr/qr-file-page'))
const QrBoxPage = lazy(() => import('@/src/routes/qr/qr-box-page'))
const ChangelogPage = lazy(() => import('@/src/routes/changelog/changelog-page'))

type AppRoute = {
  path: string
  element: React.ReactNode
  permission?: Permission
  layout: 'main' | 'public'
  lazy: true
}

const mainRoutes: AppRoute[] = [
  { path: '/', element: <Home />, permission: 'viewFiles', layout: 'main', lazy: true },
  { path: '/files/:id', element: <FileDetailPage />, permission: 'viewFiles', layout: 'main', lazy: true },
  { path: '/qr/files/:token', element: <QrFilePage />, permission: 'viewFiles', layout: 'main', lazy: true },
  { path: '/qr/boxes/:id', element: <QrBoxPage />, permission: 'viewStorage', layout: 'main', lazy: true },
  { path: '/borrow', element: <BorrowPage />, permission: 'viewBorrow', layout: 'main', lazy: true },
  { path: '/borrow/create', element: <CreateBorrowPage />, permission: 'manageBorrow', layout: 'main', lazy: true },
  { path: '/upload', element: <UploadPage />, permission: 'createFiles', layout: 'main', lazy: true },
  { path: '/users', element: <UsersPage />, permission: 'manageUsers', layout: 'main', lazy: true },
  { path: '/admin/agency', element: <AgencyPage />, permission: 'manageAgencies', layout: 'main', lazy: true },
  { path: '/admin/audit', element: <AuditLogPage />, permission: 'viewAudit', layout: 'main', lazy: true },
  { path: '/admin/boxes', element: <StorageBoxesPage />, permission: 'manageStorage', layout: 'main', lazy: true },
  { path: '/admin/backup', element: <BackupPage />, permission: 'manageMaintenance', layout: 'main', lazy: true },
  { path: '/reports', element: <Reports />, permission: 'viewReports', layout: 'main', lazy: true },
  { path: '/reset', element: <ResetPage />, permission: 'manageMaintenance', layout: 'main', lazy: true },
]

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SessionProvider>
          <RouteErrorBoundary>
            <Suspense fallback={<RouteSpinner />}>
              <Routes>
                <Route path="/login" element={<LoginRoute><LoginPage /></LoginRoute>} />
                <Route path="/changelog" element={<ChangelogPage />} />
                <Route element={<ProtectedRoute />}>
                  <Route element={<MainLayout />}>
                    {mainRoutes.map((route) => (
                      <Route
                        key={route.path}
                        path={route.path}
                        element={<PermissionRoute permission={route.permission!}>{route.element}</PermissionRoute>}
                      />
                    ))}
                    <Route path="/forbidden" element={<ForbiddenPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Route>
                </Route>
              </Routes>
            </Suspense>
          </RouteErrorBoundary>
          <Toaster />
        </SessionProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

function RouteSpinner() {
  return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}
