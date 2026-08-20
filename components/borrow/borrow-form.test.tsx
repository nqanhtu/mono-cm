import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import BorrowForm from '@/components/borrow/borrow-form'
import type { FileDto, UserDto } from '@/lib/api/types'

const apiFetch = vi.hoisted(() => vi.fn())
const toastError = vi.hoisted(() => vi.fn())
const toastSuccess = vi.hoisted(() => vi.fn())
const toastWarning = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api/client', () => ({
  apiFetch,
}))

vi.mock('sonner', () => ({
  toast: {
    error: toastError,
    success: toastSuccess,
    warning: toastWarning,
  },
}))

vi.mock('@/lib/hooks/use-auth', () => ({
  useSession: () => ({
    session: {
      id: 'lender-1',
      username: 'canbo1',
      fullName: 'Cán bộ Lưu trữ',
      role: 'COORDINATOR',
    },
  }),
}))

const mockUsers: UserDto[] = [
  {
    id: 'user-1',
    username: 'thamphan.a',
    fullName: 'Nguyễn Văn A',
    unit: 'Tòa Hình sự',
    role: 'VIEWER',
    status: true,
  },
  {
    id: 'user-2',
    username: 'thuky.b',
    fullName: 'Trần Thị B',
    unit: 'Tòa Dân sự',
    role: 'VIEWER',
    status: true,
  },
]

const mockFile: FileDto = {
  id: 'file-1',
  code: 'HS-2026-001',
  title: 'Vụ án hình sự 001',
  type: 'Hình sự',
  datetime: '2026-01-01T00:00:00.000Z',
  year: 2026,
  status: 'IN_STOCK',
  isLocked: false,
}

describe('BorrowForm External Borrower Support', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiFetch.mockImplementation((url: string) => {
      if (url.startsWith('/api/users')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockUsers,
        })
      }
      if (url.startsWith('/api/files')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ files: [mockFile] }),
        })
      }
      if (url === '/api/borrow') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, slipId: 'slip-123' }),
        })
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true }),
      })
    })
  })

  it('allows entering a custom external borrower name and submitting successfully', async () => {
    const onSuccess = vi.fn()
    render(<BorrowForm initialFiles={[mockFile]} onSuccess={onSuccess} />)

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/api/users?purpose=borrower'))

    const borrowerNameInput = screen.getByLabelText(/Người mượn/i)
    fireEvent.change(borrowerNameInput, { target: { value: 'Luật sư Lê Văn C' } })

    const borrowerUnitInput = screen.getByLabelText(/Đơn vị \/ Phòng ban/i)
    fireEvent.change(borrowerUnitInput, { target: { value: 'Đoàn Luật sư TP.HCM' } })

    const submitBtn = screen.getByRole('button', { name: /Lưu phiếu mượn/i })
    expect(submitBtn).not.toBeDisabled()

    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/api/borrow', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"borrowerName":"Luật sư Lê Văn C"'),
      }))
    })

    expect(toastSuccess).toHaveBeenCalledWith('Thành công', expect.anything())
    expect(onSuccess).toHaveBeenCalled()
  })

  it('auto-fills unit when selecting an internal user from suggestions', async () => {
    render(<BorrowForm initialFiles={[mockFile]} />)

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/api/users?purpose=borrower'))

    const borrowerNameInput = screen.getByLabelText(/Người mượn/i)
    fireEvent.focus(borrowerNameInput)
    fireEvent.change(borrowerNameInput, { target: { value: 'Nguyễn Văn A' } })

    const suggestionItem = await screen.findByText(/Nguyễn Văn A - Tòa Hình sự/i)
    fireEvent.click(suggestionItem)

    expect(borrowerNameInput).toHaveValue('Nguyễn Văn A')
    const borrowerUnitInput = screen.getByLabelText(/Đơn vị \/ Phòng ban/i)
    expect(borrowerUnitInput).toHaveValue('Tòa Hình sự')
  })

  it('loads initialData correctly for external borrowers in edit mode', async () => {
    const initialData = {
      id: 'slip-999',
      code: 'PM-2026-999',
      borrowerName: 'Khách ngoài Nguyễn Văn X',
      borrowerUnit: 'Viện Kiểm sát',
      borrowerTitle: 'Kiểm sát viên',
      reason: 'Nghiên cứu hồ sơ',
      borrowDate: '2026-08-20T00:00:00.000Z',
      dueDate: '2026-08-27T00:00:00.000Z',
      status: 'PENDING_APPROVAL',
      lenderId: 'lender-1',
      lender: { id: 'lender-1', username: 'canbo1', fullName: 'Cán bộ 1', role: 'COORDINATOR' as const, status: true },
      items: [{ id: 'item-1', borrowSlipId: 'slip-999', fileId: 'file-1', status: 'REQUESTED', file: mockFile }],
    }

    render(<BorrowForm slipId="slip-999" initialData={initialData} />)

    const borrowerNameInput = screen.getByLabelText(/Người mượn/i)
    expect(borrowerNameInput).toHaveValue('Khách ngoài Nguyễn Văn X')

    const borrowerUnitInput = screen.getByLabelText(/Đơn vị \/ Phòng ban/i)
    expect(borrowerUnitInput).toHaveValue('Viện Kiểm sát')

    const borrowerTitleInput = screen.getByLabelText(/Chức danh/i)
    expect(borrowerTitleInput).toHaveValue('Kiểm sát viên')
  })
})
