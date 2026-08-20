import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FileTable } from '@/components/files/file-table'
import type { FileWithBox } from '@/components/files/columns'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

function createMockFile(id: string, code: string, title: string): FileWithBox {
  return {
    id,
    code,
    title,
    type: 'HÌNH SỰ',
    year: 2026,
    status: 'STORED',
    boxId: null,
    box: null,
    pageCount: 10,
    judgmentNumber: '01/2026/HS-ST',
    defendants: ['Nguyễn Văn A'],
    plaintiffs: [],
    civilDefendants: [],
    note: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: { id: 'u1', username: 'admin', fullName: 'Quản trị viên' },
    updatedBy: null,
  } as unknown as FileWithBox
}

function renderFileTable(props: React.ComponentProps<typeof FileTable>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <FileTable {...props} />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('FileTable row selection', () => {
  it('does not select rows on new page when changing pages after selecting rows on page 1', () => {
    const page1Files = [
      createMockFile('file-1', 'HS-001', 'Hồ sơ 1'),
      createMockFile('file-2', 'HS-002', 'Hồ sơ 2'),
    ]
    const page2Files = [
      createMockFile('file-3', 'HS-003', 'Hồ sơ 3'),
      createMockFile('file-4', 'HS-004', 'Hồ sơ 4'),
    ]

    const onPaginationChange = vi.fn()

    const { rerender } = renderFileTable({
      files: page1Files,
      total: 4,
      page: 1,
      pageSize: 2,
      onPaginationChange,
    })

    // Select all row checkboxes available on page 1
    const rowCheckboxes = screen.getAllByRole('checkbox', { name: /select row/i })
    expect(rowCheckboxes).toHaveLength(2)

    // Select the first row (file-1)
    fireEvent.click(rowCheckboxes[0])
    expect(rowCheckboxes[0]).toBeChecked()
    expect(rowCheckboxes[1]).not.toBeChecked()

    // Verify selection bar is visible
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('hồ sơ đã chọn')).toBeInTheDocument()

    // Simulate switching to page 2
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })

    rerender(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <FileTable
            files={page2Files}
            total={4}
            page={2}
            pageSize={2}
            onPaginationChange={onPaginationChange}
          />
        </MemoryRouter>
      </QueryClientProvider>
    )

    // On page 2, verify rows are file-3 and file-4 and none of them are checked
    const newRowCheckboxes = screen.getAllByRole('checkbox', { name: /select row/i })
    expect(newRowCheckboxes).toHaveLength(2)
    expect(newRowCheckboxes[0]).not.toBeChecked()
    expect(newRowCheckboxes[1]).not.toBeChecked()
  })

  it('shows "Chuyển vào hộp" button when files are selected and canManageFiles is true', () => {
    const files = [
      createMockFile('file-1', 'HS-001', 'Hồ sơ 1'),
    ]

    renderFileTable({
      files,
      total: 1,
      page: 1,
      pageSize: 10,
      canManageFiles: true,
    })

    // Initially no bulk action bar
    expect(screen.queryByRole('button', { name: /Chuyển vào hộp/i })).not.toBeInTheDocument()

    // Select row
    const checkbox = screen.getByRole('checkbox', { name: /select row/i })
    fireEvent.click(checkbox)

    // "Chuyển vào hộp" button should appear
    expect(screen.getByRole('button', { name: /Chuyển vào hộp/i })).toBeInTheDocument()
  })

  it('does not show "Chuyển vào hộp" button when files are selected and canManageFiles is false', () => {
    const files = [
      createMockFile('file-1', 'HS-001', 'Hồ sơ 1'),
    ]

    renderFileTable({
      files,
      total: 1,
      page: 1,
      pageSize: 10,
      canManageFiles: false,
    })

    const checkbox = screen.getByRole('checkbox', { name: /select row/i })
    fireEvent.click(checkbox)

    expect(screen.queryByRole('button', { name: /Chuyển vào hộp/i })).not.toBeInTheDocument()
  })
})

