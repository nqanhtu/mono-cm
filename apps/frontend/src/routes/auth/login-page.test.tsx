import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

const apiFetch = vi.hoisted(() => vi.fn())
const mutate = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api/client', () => ({
  apiFetch,
}))

vi.mock('@/lib/hooks/use-auth', () => ({
  useSession: () => ({
    mutate,
  }),
}))

import LoginPage from '@/src/routes/auth/login-page'

function CurrentPath() {
  const location = useLocation()
  return <div>{location.pathname}</div>
}

describe('login page', () => {
  beforeEach(() => {
    apiFetch.mockReset()
    mutate.mockReset()
  })

  it('returns to the protected QR page after a successful login', async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    })

    const user = userEvent.setup()
    const { container } = render(
      <MemoryRouter initialEntries={[{ pathname: '/login', state: { from: '/qr/files/token-1' } }]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/qr/files/:token" element={<CurrentPath />} />
          <Route path="/" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    )

    await user.type(container.querySelector('input[name="username"]')!, 'admin')
    await user.type(container.querySelector('input[name="password"]')!, 'secret')
    await user.click(screen.getByRole('button'))

    await waitFor(() => expect(screen.getByText('/qr/files/token-1')).toBeInTheDocument())
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
  })
})
