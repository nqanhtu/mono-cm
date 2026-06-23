import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { CaseFileForm, type CaseFileFormState } from '@/components/forms/case-file-form'

const apiFetch = vi.hoisted(() => vi.fn())
const toastError = vi.hoisted(() => vi.fn())
const toastSuccess = vi.hoisted(() => vi.fn())

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

vi.mock('sonner', () => ({
  toast: {
    error: toastError,
    success: toastSuccess,
  },
}))

const draftKey = 'case-file-entry-draft:v1:user-1'

function createDraft(data: Partial<CaseFileFormState> = {}) {
  return {
    version: 1,
    savedAt: '2026-06-16T04:23:00.000Z',
    data: {
      code: '',
      title: '',
      type: '',
      year: 2026,
      retention: '10 năm',
      note: '',
      judgmentNumber: '',
      judgmentDate: '',
      pageCount: 0,
      defendants: '',
      plaintiffs: '',
      civilDefendants: '',
      boxId: '',
      ...data,
    },
  }
}

function mockApiFetchForBoxes() {
  apiFetch.mockImplementation((url: string) => {
    if (url.startsWith('/api/admin/boxes')) {
      return Promise.resolve({
        ok: true,
        json: async () => [],
      })
    }

    return Promise.resolve({
      ok: true,
      json: async () => ({ success: true, file: { id: 'file-1' } }),
    })
  })
}

function renderForm(overrides: Partial<React.ComponentProps<typeof CaseFileForm>> = {}) {
  const props = {
    onSuccess: vi.fn(),
    onCancel: vi.fn(),
    isDirty: false,
    setIsDirty: vi.fn(),
    draftOwnerId: 'user-1',
    ...overrides,
  }

  render(<CaseFileForm {...props} />)
  return props
}

describe('CaseFileForm drafts', () => {
  beforeEach(() => {
    localStorage.clear()
    apiFetch.mockReset()
    toastError.mockReset()
    toastSuccess.mockReset()
    mockApiFetchForBoxes()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('autosaves typed profile fields to localStorage', () => {
    vi.useFakeTimers()
    renderForm()

    fireEvent.change(screen.getByLabelText(/Mã hồ sơ/), { target: { value: 'HS-001' } })

    act(() => {
      vi.advanceTimersByTime(500)
    })

    const rawDraft = localStorage.getItem(draftKey)
    expect(rawDraft).not.toBeNull()
    expect(JSON.parse(rawDraft!).data.code).toBe('HS-001')
  })

  it('shows a restore prompt when a valid draft exists', async () => {
    localStorage.setItem(draftKey, JSON.stringify(createDraft({ code: 'HS-DRAFT' })))

    renderForm()

    expect(await screen.findByText(/Có bản nháp được lưu/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Khôi phục bản nháp' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xóa bản nháp' })).toBeInTheDocument()
  })

  it('restores a selected draft and marks the form dirty', async () => {
    const setIsDirty = vi.fn()
    localStorage.setItem(draftKey, JSON.stringify(createDraft({
      code: 'HS-DRAFT',
      title: 'Hồ sơ đang nhập',
    })))

    renderForm({ setIsDirty })
    fireEvent.click(await screen.findByRole('button', { name: 'Khôi phục bản nháp' }))

    expect(screen.getByLabelText(/Mã hồ sơ/)).toHaveValue('HS-DRAFT')
    expect(screen.getByLabelText(/Tiêu đề \/ Trích yếu/)).toHaveValue('Hồ sơ đang nhập')
    expect(setIsDirty).toHaveBeenCalledWith(true)
  })

  it('discards a draft and keeps the empty form', async () => {
    localStorage.setItem(draftKey, JSON.stringify(createDraft({ code: 'HS-DRAFT' })))

    renderForm()
    fireEvent.click(await screen.findByRole('button', { name: 'Xóa bản nháp' }))

    expect(localStorage.getItem(draftKey)).toBeNull()
    expect(screen.getByLabelText(/Mã hồ sơ/)).toHaveValue('')
  })

  it('clears the draft after a successful create', async () => {
    localStorage.setItem(draftKey, JSON.stringify(createDraft({ code: 'HS-DRAFT' })))

    renderForm()
    fireEvent.click(await screen.findByRole('button', { name: 'Khôi phục bản nháp' }))
    fireEvent.change(screen.getByLabelText(/Tiêu đề \/ Trích yếu/), { target: { value: 'Hồ sơ hoàn tất' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }))

    await waitFor(() => expect(localStorage.getItem(draftKey)).toBeNull())
  })

  it('keeps the draft when submission fails due to a network error', async () => {
    apiFetch.mockImplementation((url: string) => {
      if (url.startsWith('/api/admin/boxes')) {
        return Promise.resolve({
          ok: true,
          json: async () => [],
        })
      }

      return Promise.reject(new Error('offline'))
    })
    localStorage.setItem(draftKey, JSON.stringify(createDraft({
      code: 'HS-DRAFT',
      title: 'Hồ sơ chưa gửi',
    })))

    renderForm()
    fireEvent.click(await screen.findByRole('button', { name: 'Khôi phục bản nháp' }))
    fireEvent.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }))

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Có lỗi xảy ra. Bản nháp vẫn được lưu trên thiết bị này.'))
    expect(localStorage.getItem(draftKey)).not.toBeNull()
  })

  it('ignores malformed draft data', async () => {
    localStorage.setItem(draftKey, '{bad-json')

    renderForm()

    await waitFor(() => expect(localStorage.getItem(draftKey)).toBeNull())
    expect(screen.queryByText(/Có bản nháp được lưu/)).not.toBeInTheDocument()
  })
})
