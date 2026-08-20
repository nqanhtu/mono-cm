import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BatchAssignBoxDialog } from './batch-assign-box-dialog'
import type { FileWithBox } from '@/components/files/columns'
import type { StorageBoxDto } from '@/lib/api/types'

const apiFetchMock = vi.hoisted(() => vi.fn())
const toastSuccessMock = vi.hoisted(() => vi.fn())
const toastErrorMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api/client', () => ({
  apiFetch: apiFetchMock,
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}))

const mockBoxes: StorageBoxDto[] = [
  {
    id: 'box-1',
    code: 'BOX-001',
    warehouse: 'Kho A',
    line: 'Dãy 1',
    shelf: 'Kệ 1',
    slot: 'Ô 1',
    boxNumber: '001',
    caseType: 'Hình sự',
    year: 2026,
    retention: 'Vĩnh viễn',
    agency: { id: 'a1', name: 'Phông TAND', startDate: '2026-01-01' },
    _count: { files: 3 },
  } as StorageBoxDto,
]

vi.mock('@/lib/hooks/use-storage-boxes', () => ({
  useStorageBoxes: () => ({
    boxes: mockBoxes,
    isLoading: false,
    isError: null,
  }),
}))

Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  configurable: true,
  value: vi.fn(),
})

describe('BatchAssignBoxDialog', () => {
  const selectedFiles = [
    { id: 'file-1', code: 'HS-001', title: 'Hồ sơ 1' },
    { id: 'file-2', code: 'HS-002', title: 'Hồ sơ 2' },
  ] as unknown as FileWithBox[]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders dialog with selected files count and allows picking a box and submitting', async () => {
    const onClose = vi.fn()
    const onSuccess = vi.fn()

    apiFetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, count: 2, message: 'Thành công' }),
    })

    render(
      <BatchAssignBoxDialog
        isOpen={true}
        onClose={onClose}
        selectedFiles={selectedFiles}
        onSuccess={onSuccess}
      />
    )

    expect(screen.getByText(/Chuyển 2 hồ sơ vào hộp lưu trữ/i)).toBeInTheDocument()

    // Pick box-1
    const selectTrigger = screen.getByRole('combobox')
    fireEvent.click(selectTrigger)

    const option = await screen.findByText(/BOX-001/i)
    fireEvent.click(option)

    // Verify box info card is displayed
    expect(screen.getByText('Thông tin hộp')).toBeInTheDocument()
    expect(screen.getByText(/Đang có: 3 hồ sơ/i)).toBeInTheDocument()
    expect(screen.getByText(/Thời hạn: Vĩnh viễn/i)).toBeInTheDocument()

    // Click confirm button
    const submitBtn = screen.getByRole('button', { name: /Xác nhận chuyển/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith('/api/files/batch-assign-box', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileIds: ['file-1', 'file-2'],
          boxId: 'box-1',
        }),
      })
      expect(toastSuccessMock).toHaveBeenCalled()
      expect(onSuccess).toHaveBeenCalled()
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('shows error toast on api error', async () => {
    const onClose = vi.fn()

    apiFetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ success: false, message: 'Lỗi chuyển hộp' }),
    })

    render(
      <BatchAssignBoxDialog
        isOpen={true}
        onClose={onClose}
        selectedFiles={selectedFiles}
      />
    )

    // Pick box-1
    const selectTrigger = screen.getByRole('combobox')
    fireEvent.click(selectTrigger)

    const option = await screen.findByText(/BOX-001/i)
    fireEvent.click(option)

    // Wait for selectedBox info card to appear
    expect(await screen.findByText('Thông tin hộp')).toBeInTheDocument()

    // Submit
    const submitBtn = screen.getByRole('button', { name: /Xác nhận chuyển/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith('Lỗi chuyển hộp')
    })
  })

  it('handles cancel button click to close dialog', () => {
    const onClose = vi.fn()

    render(
      <BatchAssignBoxDialog
        isOpen={true}
        onClose={onClose}
        selectedFiles={selectedFiles}
      />
    )

    const cancelBtn = screen.getByRole('button', { name: /Hủy/i })
    fireEvent.click(cancelBtn)

    expect(onClose).toHaveBeenCalled()
  })

  it('renders list of selected files with current box and allows removing a file', async () => {
    const onClose = vi.fn()
    const onRemoveFile = vi.fn()

    const files = [
      { id: 'file-1', code: 'HS-001', title: 'Vụ án trộm cắp', box: { code: 'BOX-OLD' } },
      { id: 'file-2', code: 'HS-002', title: 'Vụ án lừa đảo', box: null },
    ] as unknown as FileWithBox[]

    render(
      <BatchAssignBoxDialog
        isOpen={true}
        onClose={onClose}
        selectedFiles={files}
        onRemoveFile={onRemoveFile}
      />
    )

    // Check files are listed
    expect(screen.getByText('HS-001')).toBeInTheDocument()
    expect(screen.getByText('Vụ án trộm cắp')).toBeInTheDocument()
    expect(screen.getByText('BOX-OLD')).toBeInTheDocument()
    expect(screen.getByText('HS-002')).toBeInTheDocument()
    expect(screen.getByText('Chưa vào hộp')).toBeInTheDocument()

    // Click remove button for file-1
    const removeButtons = screen.getAllByRole('button', { name: /Loại bỏ/i })
    fireEvent.click(removeButtons[0])

    expect(onRemoveFile).toHaveBeenCalledWith('file-1')
  })

  it('renders empty message when no files are selected and hides remove button when onRemoveFile is not provided', () => {
    const onClose = vi.fn()

    render(
      <BatchAssignBoxDialog
        isOpen={true}
        onClose={onClose}
        selectedFiles={[]}
      />
    )

    expect(screen.getByText('Chưa có hồ sơ nào được chọn')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Loại bỏ/i })).not.toBeInTheDocument()
  })
})
