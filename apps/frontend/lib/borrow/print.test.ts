import { printBorrowSlip } from '@/lib/borrow/print'
import { printStorageBoxLabels } from '@/lib/storage-box/print-labels'

describe('print helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns false when borrow slip popup is blocked', () => {
    vi.spyOn(window, 'open').mockReturnValue(null)

    const result = printBorrowSlip({
      id: 'slip-1',
      code: 'PM-001',
      borrowerName: 'Nguyễn Văn A',
      borrowDate: '2026-05-22',
      dueDate: '2026-05-29',
      status: 'PENDING_APPROVAL',
      lenderId: 'user-1',
      lender: { id: 'user-1', username: 'admin', fullName: 'Admin', role: 'SUPER_ADMIN', status: true },
      items: [],
    })

    expect(result).toBe(false)
  })

  it('returns false when storage box label popup is blocked', () => {
    vi.spyOn(window, 'open').mockReturnValue(null)

    const result = printStorageBoxLabels([], 'grid')

    expect(result).toBe(false)
  })

  it('writes storage box label HTML when popup opens', () => {
    const write = vi.fn()
    const close = vi.fn()
    const focus = vi.fn()
    vi.spyOn(window, 'open').mockReturnValue({
      document: { write, close },
      focus,
    } as unknown as Window)

    const result = printStorageBoxLabels([
      {
        qrDataUrl: 'data:image/png;base64,qr',
        qrUrl: 'https://example.test/qr/boxes/box-1',
        box: {
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
          _count: { files: 3 },
        },
      },
    ], 'single')

    expect(result).toBe(true)
    expect(write).toHaveBeenCalledWith(expect.stringContaining('BOX-001'))
    expect(write).toHaveBeenCalledWith(expect.stringContaining('data:image/png;base64,qr'))
    expect(close).toHaveBeenCalled()
    expect(focus).toHaveBeenCalled()
  })
})
