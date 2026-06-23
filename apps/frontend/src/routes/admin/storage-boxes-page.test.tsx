import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderWithRouter } from '@/src/test/test-utils'
import StorageBoxesPage from '@/src/routes/admin/storage-boxes-page'

const mocks = vi.hoisted(() => ({
  boxes: [
    {
      id: 'box-1',
      code: 'BOX-001',
      warehouse: 'Kho B',
      line: 'Dãy 2',
      shelf: 'Kệ 4',
      slot: 'Ô 8',
      boxNumber: '008',
      caseType: 'Lao động',
      year: 2026,
      retention: 'Vĩnh viễn',
      agency: { id: 'agency-1', name: 'Phông A', startDate: '2026-01-01' },
      _count: { files: 0 },
    },
  ],
}))

vi.mock('qrcode.react', () => ({
  QRCodeCanvas: ({ id, value, className }: { id: string; value: string; className?: string }) => (
    <canvas id={id} data-testid={id} data-value={value} className={className} />
  ),
}))

vi.mock('@/components/forms/storage-box-dialog', () => ({
  StorageBoxDialog: () => null,
}))

vi.mock('@/components/storage-layout/storage-layout-canvas', () => ({
  StorageLayoutCanvas: () => <div data-testid="storage-layout-canvas" />,
}))

vi.mock('@/lib/hooks/use-auth', () => ({
  useSession: () => ({
    session: { id: 'user-1', username: 'admin', fullName: 'Admin', role: 'SUPER_ADMIN' },
    isLoading: false,
  }),
}))

vi.mock('@/lib/hooks/use-storage-boxes', () => ({
  useStorageBoxes: () => ({
    boxes: mocks.boxes,
    isLoading: false,
  }),
  useDeleteStorageBox: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}))

vi.mock('@/lib/hooks/use-storage-layout', () => ({
  useStorageLayout: () => ({
    layout: null,
    isLoading: false,
  }),
}))

describe('StorageBoxesPage', () => {
  it('opens single-box QR label preview from row print action', async () => {
    renderWithRouter(<StorageBoxesPage />)

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Mở thao tác hộp BOX-001' }), {
      button: 0,
      ctrlKey: false,
    })
    fireEvent.click(await screen.findByRole('menuitem', { name: 'In nhãn' }))

    expect(await screen.findByText('Xem trước nhãn QR hộp lưu trữ')).toBeInTheDocument()
    expect(screen.getByTestId('storage-box-preview-qr-box-1')).toHaveAttribute(
      'data-value',
      expect.stringContaining('/qr/boxes/box-1')
    )
    expect(screen.getByText('Kho B - Dãy 2 - Kệ 4 - Ô 8 - 008')).toBeInTheDocument()
  })

  it('renders the storage layout canvas tab', async () => {
    renderWithRouter(<StorageBoxesPage />)

    await userEvent.click(screen.getByRole('tab', { name: 'Sơ đồ kho' }))

    expect(screen.getByTestId('storage-layout-canvas')).toBeInTheDocument()
  })
})
