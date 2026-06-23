import { screen, waitFor } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'

import { apiFetch } from '@/lib/api/client'
import { renderWithRouter } from '@/src/test/test-utils'
import QrBoxPage from '@/src/routes/qr/qr-box-page'
import QrFilePage from '@/src/routes/qr/qr-file-page'

vi.mock('@/lib/api/client', () => ({
  apiFetch: vi.fn(),
}))

describe('QR pages', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
  })

  it('resolves file QR and renders file summary', async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        file: {
          id: 'file-1',
          code: 'HS-001',
          title: 'Hồ sơ thử nghiệm',
          type: 'Lao động',
          year: 2026,
          status: 'IN_STOCK',
          box: null,
        },
      }),
    } as Response)

    renderWithRouter(
      <Routes>
        <Route path="/qr/files/:token" element={<QrFilePage />} />
      </Routes>,
      ['/qr/files/token-1']
    )

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/api/qr/files/token-1'))
    expect(await screen.findByText('Hồ sơ thử nghiệm')).toBeInTheDocument()
  })

  it('resolves box QR and renders box files', async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        box: {
          id: 'box-1',
          code: 'BOX-001',
          warehouse: 'Kho A',
          line: 'Dãy 1',
          shelf: 'Kệ 2',
          slot: 'Ô 3',
          boxNumber: '001',
          agency: { id: 'agency-1', name: 'TAND' },
          _count: { files: 1 },
        },
        files: [{ id: 'file-1', code: 'HS-001', title: 'Hồ sơ trong hộp', type: 'Dân sự', year: 2026, status: 'IN_STOCK' }],
      }),
    } as Response)

    renderWithRouter(
      <Routes>
        <Route path="/qr/boxes/:id" element={<QrBoxPage />} />
      </Routes>,
      ['/qr/boxes/box-1']
    )

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/api/qr/boxes/box-1'))
    expect(await screen.findAllByText('Hồ sơ trong hộp')).toHaveLength(2)
  })
})
