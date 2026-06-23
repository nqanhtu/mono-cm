import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'

import { renderWithRouter } from '@/src/test/test-utils'

const sessionState = vi.hoisted(() => ({
  value: {
    session: null as null | { id: string; username: string; fullName: string; role: string },
    isLoading: false,
  },
}))

vi.mock('@/lib/hooks/use-auth', () => ({
  useSession: () => ({
    session: sessionState.value.session,
    isLoading: sessionState.value.isLoading,
    isAuthenticated: Boolean(sessionState.value.session),
    refreshSession: vi.fn(),
    mutate: vi.fn(),
    logout: vi.fn(),
  }),
}))

import { LoginRoute, PermissionRoute, ProtectedRoute } from '@/src/routes/guards'

describe('route guards', () => {
  beforeEach(() => {
    sessionState.value.session = null
    sessionState.value.isLoading = false
  })

  it('redirects unauthenticated users to login', () => {
    renderWithRouter(
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/borrow" element={<div>Borrow page</div>} />
        </Route>
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>,
      ['/borrow']
    )

    expect(screen.getByText('Login page')).toBeInTheDocument()
  })

  it('returns authenticated login-route users to the originally requested page', () => {
    sessionState.value.session = { id: 'u1', username: 'admin', fullName: 'Admin', role: 'ADMIN' }

    renderWithRouter(
      <Routes>
        <Route path="/login" element={<LoginRoute><div>Login page</div></LoginRoute>} />
        <Route path="/borrow" element={<div>Borrow page</div>} />
        <Route path="/" element={<div>Dashboard</div>} />
      </Routes>,
      [{ pathname: '/login', state: { from: '/borrow' } }]
    )

    expect(screen.getByText('Borrow page')).toBeInTheDocument()
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
  })

  it('redirects users without permission to forbidden', () => {
    sessionState.value.session = { id: 'u1', username: 'viewer', fullName: 'Viewer', role: 'VIEWER' }

    renderWithRouter(
      <Routes>
        <Route path="/admin/boxes" element={<PermissionRoute permission="manageStorage"><div>Boxes</div></PermissionRoute>} />
        <Route path="/forbidden" element={<div>Forbidden</div>} />
      </Routes>,
      ['/admin/boxes']
    )

    expect(screen.getByText('Forbidden')).toBeInTheDocument()
  })

  it('protects maintenance routes with SUPER_ADMIN-only permission', () => {
    sessionState.value.session = { id: 'u2', username: 'admin', fullName: 'Admin', role: 'ADMIN' }

    renderWithRouter(
      <Routes>
        <Route path="/reset" element={<PermissionRoute permission="manageMaintenance"><div>Reset</div></PermissionRoute>} />
        <Route path="/forbidden" element={<div>Forbidden</div>} />
      </Routes>,
      ['/reset']
    )

    expect(screen.getByText('Forbidden')).toBeInTheDocument()
  })

  it('allows coordinators to access file creation routes', () => {
    sessionState.value.session = { id: 'u3', username: 'coord', fullName: 'Coordinator', role: 'COORDINATOR' }

    renderWithRouter(
      <Routes>
        <Route path="/upload" element={<PermissionRoute permission="createFiles"><div>Upload</div></PermissionRoute>} />
        <Route path="/forbidden" element={<div>Forbidden</div>} />
      </Routes>,
      ['/upload']
    )

    expect(screen.getByText('Upload')).toBeInTheDocument()
    expect(screen.queryByText('Forbidden')).not.toBeInTheDocument()
  })
})
