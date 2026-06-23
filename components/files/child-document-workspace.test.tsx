import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'

import { ChildDocumentWorkspace, type ChildDocumentDraft } from '@/components/files/child-document-workspace'
import type { DocumentDto } from '@/lib/api/types'

const apiFetch = vi.hoisted(() => vi.fn())
const printChildDocumentList = vi.hoisted(() => vi.fn())
const toastError = vi.hoisted(() => vi.fn())
const toastSuccess = vi.hoisted(() => vi.fn())
const toastWarning = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api/client', () => ({
  apiFetch,
}))

vi.mock('@/lib/hooks/use-autocomplete-suggestions', () => ({
  useAutocompleteSuggestions: () => ({
    suggestions: { types: [], retentions: [], titles: [], documentTitles: [] },
    isLoading: false,
    isError: null,
  }),
}))

vi.mock('@/lib/files/print-child-documents', () => ({
  printChildDocumentList,
}))

vi.mock('sonner', () => ({
  toast: {
    error: toastError,
    success: toastSuccess,
    warning: toastWarning,
  },
}))

const draftKey = 'child-document-entry-draft:v1:file-1'
const scrollIntoView = vi.fn()

Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  configurable: true,
  value: scrollIntoView,
})

function createDraft(data: Partial<ChildDocumentDraft> = {}) {
  return {
    version: 1,
    savedAt: '2026-06-16T04:23:00.000Z',
    data: {
      fileId: 'file-1',
      title: '',
      code: '',
      contentIndex: '',
      year: 2026,
      pageCount: 0,
      order: 1,
      preservationTime: '',
      note: '',
      ...data,
    },
  }
}

function mockApiFetchSuccess() {
  apiFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, document: { id: 'doc-1' } }),
  })
}

function createDocument(overrides: Partial<DocumentDto> = {}): DocumentDto {
  return {
    id: 'doc-1',
    fileId: 'file-1',
    title: 'Bản án sơ thẩm',
    pageCount: 12,
    order: 1,
    note: 'Bản chính',
    ...overrides,
  }
}

function renderWorkspace(overrides: Partial<ComponentProps<typeof ChildDocumentWorkspace>> = {}) {
  const props = {
    fileId: 'file-1',
    parentFileCode: '02/HS/DH',
    parentFileTitle: 'Hồ sơ vụ án',
    parentYear: 2026,
    parentRetention: '10 năm',
    documents: [],
    canManage: true,
    onMutate: vi.fn(),
    entryMode: 'idle' as const,
    ...overrides,
  }

  render(<ChildDocumentWorkspace {...props} />)
  return props
}

function startCreate() {
  fireEvent.click(screen.getAllByRole('button', { name: /Thêm văn bản/ })[0])
}

describe('ChildDocumentWorkspace drafts', () => {
  beforeEach(() => {
    localStorage.clear()
    apiFetch.mockReset()
    toastError.mockReset()
    toastSuccess.mockReset()
    toastWarning.mockReset()
    printChildDocumentList.mockReset()
    printChildDocumentList.mockReturnValue(true)
    scrollIntoView.mockReset()
    mockApiFetchSuccess()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('autosaves typed child profile fields to localStorage', () => {
    vi.useFakeTimers()
    renderWorkspace()

    startCreate()
    fireEvent.change(screen.getByLabelText(/Trích yếu \/ Tên văn bản/), { target: { value: 'Văn bản đang nhập' } })

    act(() => {
      vi.advanceTimersByTime(500)
    })

    const rawDraft = localStorage.getItem(draftKey)
    expect(rawDraft).not.toBeNull()
    expect(JSON.parse(rawDraft!).data.title).toBe('Văn bản đang nhập')
  })

  it('shows a restore prompt when a valid child profile draft exists', async () => {
    localStorage.setItem(draftKey, JSON.stringify(createDraft({ title: 'Văn bản nháp' })))

    renderWorkspace()

    expect(await screen.findByText(/Có bản nháp hồ sơ con được lưu/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Khôi phục bản nháp' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xóa bản nháp' })).toBeInTheDocument()
  })

  it('restores a selected child profile draft', async () => {
    localStorage.setItem(draftKey, JSON.stringify(createDraft({
      title: 'Văn bản nháp',
      code: 'VB-001',
    })))

    renderWorkspace()
    fireEvent.click(await screen.findByRole('button', { name: 'Khôi phục bản nháp' }))

    expect(screen.getByLabelText(/Trích yếu \/ Tên văn bản/)).toHaveValue('Văn bản nháp')
  })

  it('discards a child profile draft and keeps the workspace idle', async () => {
    localStorage.setItem(draftKey, JSON.stringify(createDraft({ title: 'Văn bản nháp' })))

    renderWorkspace()
    fireEvent.click(await screen.findByRole('button', { name: 'Xóa bản nháp' }))

    expect(localStorage.getItem(draftKey)).toBeNull()
    expect(screen.queryByLabelText(/Trích yếu \/ Tên văn bản/)).not.toBeInTheDocument()
  })

  it('clears the child profile draft after a successful create', async () => {
    localStorage.setItem(draftKey, JSON.stringify(createDraft({ title: 'Văn bản nháp' })))

    renderWorkspace()
    fireEvent.click(await screen.findByRole('button', { name: 'Khôi phục bản nháp' }))
    fireEvent.click(screen.getByRole('button', { name: /Lưu & đóng/ }))

    await waitFor(() => expect(localStorage.getItem(draftKey)).toBeNull())
  })

  it('keeps the child profile draft when submission fails due to a network error', async () => {
    apiFetch.mockRejectedValue(new Error('offline'))
    localStorage.setItem(draftKey, JSON.stringify(createDraft({ title: 'Văn bản nháp' })))

    renderWorkspace()
    fireEvent.click(await screen.findByRole('button', { name: 'Khôi phục bản nháp' }))
    fireEvent.click(screen.getByRole('button', { name: /Lưu & đóng/ }))

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Có lỗi xảy ra khi lưu tài liệu. Bản nháp vẫn được lưu trên thiết bị này.'))
    expect(localStorage.getItem(draftKey)).not.toBeNull()
  })

  it('ignores malformed child profile draft data', async () => {
    localStorage.setItem(draftKey, '{bad-json')

    renderWorkspace()

    await waitFor(() => expect(localStorage.getItem(draftKey)).toBeNull())
    expect(screen.queryByText(/Có bản nháp hồ sơ con được lưu/)).not.toBeInTheDocument()
  })

  it('shows a disabled print list button when there are no child documents', () => {
    renderWorkspace()

    expect(screen.getByRole('button', { name: /In danh sách/ })).toBeDisabled()
  })

  it('prints all child documents with parent file information', () => {
    const documents = [
      createDocument({ id: 'doc-1', title: 'Văn bản 1' }),
      createDocument({ id: 'doc-2', title: 'Văn bản 2', order: 2 }),
    ]
    renderWorkspace({ documents, canManage: false })

    fireEvent.click(screen.getByRole('button', { name: /In danh sách/ }))

    expect(printChildDocumentList).toHaveBeenCalledWith(
      { code: '02/HS/DH', title: 'Hồ sơ vụ án' },
      documents
    )
  })

  it('shows a clear error when the print popup is blocked', () => {
    printChildDocumentList.mockReturnValue(false)
    renderWorkspace({ documents: [createDocument()] })

    fireEvent.click(screen.getByRole('button', { name: /In danh sách/ }))

    expect(toastError).toHaveBeenCalledWith('Không thể mở cửa sổ in. Vui lòng cho phép trình duyệt mở popup.')
  })

  it('renders "Nhập từ Excel" button when user can manage and workspace is idle', () => {
    renderWorkspace({ canManage: true, entryMode: 'idle' })
    expect(screen.getAllByRole('button', { name: /Nhập từ Excel/ })[0]).toBeInTheDocument()
  })

  it('hides "Nhập từ Excel" button when user cannot manage', () => {
    renderWorkspace({ canManage: false })
    expect(screen.queryByRole('button', { name: /Nhập từ Excel/ })).not.toBeInTheDocument()
  })

  it('hides "Nhập từ Excel" button when workspace is active (creating or editing)', () => {
    renderWorkspace({ canManage: true, entryMode: 'create' })
    expect(screen.queryByRole('button', { name: /Nhập từ Excel/ })).not.toBeInTheDocument()
  })
})
