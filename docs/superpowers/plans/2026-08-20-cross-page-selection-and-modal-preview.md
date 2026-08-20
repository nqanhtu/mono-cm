# Kế hoạch Triển khai: Chọn hồ sơ đa trang & Danh sách kiểm tra trong Modal chuyển hộp

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hỗ trợ lưu trữ và tích lũy các hồ sơ đã chọn xuyên suốt nhiều trang trong `FileTable`, đồng thời hiển thị danh sách kiểm tra các hồ sơ được chuyển (kèm nút xóa loại bớt) trong `BatchAssignBoxDialog`.

**Architecture:** Quản lý `selectedFilesMap` (`Record<string, FileWithBox>`) trong `FileTable` để duy trì các object hồ sơ từ mọi trang; đồng bộ `rowSelection` của `@tanstack/react-table`; mở rộng `BatchAssignBoxDialog` với danh sách cuộn hiển thị chi tiết các hồ sơ và hỗ trợ `onRemoveFile`.

**Tech Stack:** React 19, `@tanstack/react-table`, `@tanstack/react-query`, Lucide icons, Vitest / `@testing-library/react`.

## Global Constraints

- Không làm mất hồ sơ đã chọn ở trang cũ khi chuyển sang trang mới.
- Bỏ chọn ("Bỏ chọn" hoặc xóa hồ sơ) phải đồng bộ xóa khỏi cả danh sách lẫn dấu checkbox trên bảng.
- Hiển thị đầy đủ thông tin hồ sơ trong modal: Mã hồ sơ, Tiêu đề, Hộp hiện tại (hoặc "Chưa vào hộp").

---

### Task 1: Thêm Danh sách kiểm tra & Nút loại bớt hồ sơ vào `BatchAssignBoxDialog`

**Files:**
- Modify: `components/files/batch-assign-box-dialog.tsx`
- Modify: `components/files/batch-assign-box-dialog.test.tsx`

**Interfaces:**
- Consumes: `selectedFiles: FileWithBox[]`, `onRemoveFile?: (fileId: string) => void`
- Produces: UI danh sách hồ sơ dạng cuộn trong modal, cho phép bấm `X` để loại bớt hồ sơ khỏi danh sách chuyển

- [ ] **Step 1: Viết failing test kiểm tra danh sách hồ sơ và chức năng xóa hồ sơ trong `BatchAssignBoxDialog`**

Cập nhật `components/files/batch-assign-box-dialog.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại**

Run: `bun run test:frontend components/files/batch-assign-box-dialog.test.tsx`  
Expected: FAIL (không tìm thấy các phần tử danh sách hồ sơ / nút loại bỏ).

- [ ] **Step 3: Cài đặt hiển thị danh sách hồ sơ & nút loại bỏ trong `components/files/batch-assign-box-dialog.tsx`**

Cập nhật `components/files/batch-assign-box-dialog.tsx`:
1. Thêm `onRemoveFile?: (fileId: string) => void` vào `BatchAssignBoxDialogProps`.
2. Thêm icon `X`, `FileText`, `Package` từ `lucide-react`.
3. Thêm khu vực hiển thị danh sách hồ sơ:
```tsx
        {/* Danh sách hồ sơ sẽ chuyển */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground">
              Danh sách hồ sơ ({selectedFiles.length})
            </span>
            <span className="text-muted-foreground text-[11px]">
              Bấm <span className="font-semibold text-destructive">✕</span> để loại bớt hồ sơ
            </span>
          </div>
          <div className="max-h-40 overflow-y-auto rounded-lg border bg-slate-50/50 p-1.5 space-y-1 dark:bg-slate-900/40 dark:border-slate-800">
            {selectedFiles.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Chưa có hồ sơ nào được chọn</p>
            ) : (
              selectedFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between gap-2 rounded-md border bg-background px-2.5 py-1.5 text-xs shadow-2xs dark:border-slate-800"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="font-mono font-bold text-primary shrink-0">
                      {file.code || 'Chưa có mã'}
                    </span>
                    <span className="truncate text-slate-700 dark:text-slate-300">
                      {file.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground">
                      {file.box?.code ? `Hộp: ${file.box.code}` : 'Chưa vào hộp'}
                    </Badge>
                    {onRemoveFile && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Loại bỏ ${file.code || file.title}`}
                        onClick={() => onRemoveFile(file.id)}
                        className="size-5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                      >
                        <X className="size-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
```

- [ ] **Step 4: Chạy test xác nhận PASS**

Run: `bun run test:frontend components/files/batch-assign-box-dialog.test.tsx`  
Expected: PASS.

- [ ] **Step 5: Commit task 1**

```bash
git add components/files/batch-assign-box-dialog.tsx components/files/batch-assign-box-dialog.test.tsx
git commit -m "feat(ui): add dossier verification list with remove action in BatchAssignBoxDialog"
```

---

### Task 2: Quản lý chọn hồ sơ xuyên suốt nhiều trang trong `FileTable`

**Files:**
- Modify: `components/files/file-table.tsx`
- Modify: `components/files/file-table.test.tsx`

**Interfaces:**
- Consumes: `files: FileWithBox[]`, `useReactTable`
- Produces: Multi-page selection persistence in `FileTable` using `selectedFilesMap: Record<string, FileWithBox>`

- [ ] **Step 1: Viết failing test cho chọn hồ sơ đa trang trong `components/files/file-table.test.tsx`**

Cập nhật `components/files/file-table.test.tsx`:

```tsx
  it('persists selected files across multiple pages and accumulates count and selected items', () => {
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
      canManageFiles: true,
    })

    // Select file-1 on page 1
    const p1Checkboxes = screen.getAllByRole('checkbox', { name: /select row/i })
    fireEvent.click(p1Checkboxes[0])
    expect(p1Checkboxes[0]).toBeChecked()
    expect(screen.getByText('1')).toBeInTheDocument()

    // Switch to page 2
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
            canManageFiles={true}
          />
        </MemoryRouter>
      </QueryClientProvider>
    )

    // On page 2: toolbar should still show "1 hồ sơ đã chọn" from page 1
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('hồ sơ đã chọn')).toBeInTheDocument()

    // Select file-3 on page 2
    const p2Checkboxes = screen.getAllByRole('checkbox', { name: /select row/i })
    expect(p2Checkboxes[0]).not.toBeChecked()
    fireEvent.click(p2Checkboxes[0])
    expect(p2Checkboxes[0]).toBeChecked()

    // Total count should now be 2
    expect(screen.getByText('2')).toBeInTheDocument()

    // Switch back to page 1
    rerender(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <FileTable
            files={page1Files}
            total={4}
            page={1}
            pageSize={2}
            onPaginationChange={onPaginationChange}
            canManageFiles={true}
          />
        </MemoryRouter>
      </QueryClientProvider>
    )

    // file-1 should still be checked and total count still 2
    const p1CheckboxesBack = screen.getAllByRole('checkbox', { name: /select row/i })
    expect(p1CheckboxesBack[0]).toBeChecked()
    expect(p1CheckboxesBack[1]).not.toBeChecked()
    expect(screen.getByText('2')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại**

Run: `bun run test:frontend components/files/file-table.test.tsx`  
Expected: FAIL (toolbar bị ẩn trên trang 2 hoặc số lượng không tích lũy).

- [ ] **Step 3: Cài đặt quản lý `selectedFilesMap` trong `components/files/file-table.tsx`**

Trong `components/files/file-table.tsx`:
1. Thay đổi state lưu trữ:
```tsx
  const [selectedFilesMap, setSelectedFilesMap] = React.useState<Record<string, FileWithBox>>({})
```
2. Đồng bộ `rowSelection` từ `selectedFilesMap`:
```tsx
  const rowSelection = React.useMemo(() => {
    const sel: Record<string, boolean> = {}
    for (const id of Object.keys(selectedFilesMap)) {
      sel[id] = true
    }
    return sel
  }, [selectedFilesMap])
```
3. Xử lý cập nhật `onRowSelectionChange`:
```tsx
  const handleRowSelectionChange: OnChangeFn<RowSelectionState> = React.useCallback(
    (updater) => {
      const nextSelection = typeof updater === 'function' ? updater(rowSelection) : updater
      setSelectedFilesMap((prev) => {
        const next = { ...prev }
        // Cập nhật cho các hồ sơ của trang hiện tại
        for (const file of files) {
          if (nextSelection[file.id]) {
            next[file.id] = file
          } else {
            delete next[file.id]
          }
        }
        return next
      })
    },
    [files, rowSelection]
  )
```
4. `selectedFiles`:
```tsx
  const selectedFiles = React.useMemo(() => Object.values(selectedFilesMap), [selectedFilesMap])
  const selectedCount = selectedFiles.length
```
5. Hàm bỏ chọn từng file:
```tsx
  const handleRemoveSelectedFile = React.useCallback((fileId: string) => {
    setSelectedFilesMap((prev) => {
      const next = { ...prev }
      delete next[fileId]
      return next
    })
  }, [])
```
6. Cập nhật reset: `setSelectedFilesMap({})` khi bấm "Bỏ chọn" hoặc sau các thao tác thành công.
7. Truyền `onRemoveFile={handleRemoveSelectedFile}` vào `BatchAssignBoxDialog`.

- [ ] **Step 4: Chạy test xác nhận PASS**

Run: `bun run test:frontend components/files/file-table.test.tsx`  
Expected: PASS.

- [ ] **Step 5: Commit task 2**

```bash
git add components/files/file-table.tsx components/files/file-table.test.tsx
git commit -m "feat(files): support cross-page selection in FileTable"
```

---

### Task 3: Kiểm thử hồi quy toàn diện

**Files:**
- Test: All frontend & server test suites

- [ ] **Step 1: Chạy toàn bộ frontend test suite**

Run: `bun run test:frontend`  
Expected: All test suites pass.

- [ ] **Step 2: Chạy toàn bộ server test suite**

Run: `bun run test:server`  
Expected: All test suites pass.

- [ ] **Step 3: Commit bất kỳ điều chỉnh hoàn thiện nếu có**
