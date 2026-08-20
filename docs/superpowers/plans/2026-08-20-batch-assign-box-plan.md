# Kế hoạch Triển khai: Chuyển hàng loạt hồ sơ vào hộp lưu trữ

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm tính năng cho phép người dùng (`SUPER_ADMIN`, `ADMIN`) chọn nhiều hồ sơ cùng lúc và chuyển toàn bộ vào 1 hộp lưu trữ, đồng thời tự động đồng bộ thời hạn bảo quản của các hồ sơ theo hộp lưu trữ đó.

**Architecture:** Bổ sung endpoint backend `POST /api/files/batch-assign-box` cập nhật hàng loạt hồ sơ và ghi audit log; tạo dialog component `BatchAssignBoxDialog` hỗ trợ tìm kiếm và xem trước thông tin hộp lưu trữ; tích hợp nút "Chuyển vào hộp" vào thanh công cụ thao tác hàng loạt của `FileTable`.

**Tech Stack:** Bun, Elysia, Prisma, React 19, `@tanstack/react-table`, `@tanstack/react-query`, Lucide icons, Vitest / `@testing-library/react`.

## Global Constraints

- Phân quyền: Yêu cầu quyền `manageFiles` (`SUPER_ADMIN`, `ADMIN`).
- Đồng bộ `retention`: Nếu hộp có `retention` khác rỗng/null, cập nhật `retention` của tất cả hồ sơ theo hộp.
- Không để sót placeholder hay TODO trong code.
- Mỗi task đều có test case riêng biệt và pass trước khi commit.

---

### Task 1: Backend Endpoint `POST /api/files/batch-assign-box`

**Files:**
- Modify: `server/api-routes/files.routes.ts`
- Test: `server/contracts/files.contract.test.ts`

**Interfaces:**
- Consumes: Prisma `db.file`, `db.storageBox`, `sessionOrDenied({ request, set }, 'manageFiles')`, `createAuditLog`
- Produces: API endpoint `POST /api/files/batch-assign-box` accepting `{ fileIds: string[], boxId: string }` and returning `{ success: boolean, message: string, count: number }`

- [ ] **Step 1: Viết failing contract tests cho endpoint `POST /api/files/batch-assign-box`**

Thêm các test cases vào `server/contracts/files.contract.test.ts`:

```typescript
    test('POST /api/files/batch-assign-box succeeds with SUPER_ADMIN and updates boxId and retention', async () => {
      const app = createTestApp()
      const box = {
        id: 'box-1',
        code: 'BOX-001',
        retention: 'Vĩnh viễn',
      }
      let updateManyArgs: unknown = null
      let auditLogArgs: unknown = null

      setDbForTesting({
        storageBox: {
          findUnique: async (args: { where: { id: string } }) => {
            if (args.where.id === 'box-1') return box
            return null
          },
        },
        file: {
          updateMany: async (args: unknown) => {
            updateManyArgs = args
            return { count: 2 }
          },
        },
        auditLog: {
          create: async (args: unknown) => {
            auditLogArgs = args
            return { id: 'audit-1' }
          },
        },
      })

      const response = await app.handle(postJson('/api/files/batch-assign-box', {
        fileIds: ['file-1', 'file-2'],
        boxId: 'box-1',
      }, {
        headers: { cookie: await sessionCookie('SUPER_ADMIN') },
      }))

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toEqual({
        success: true,
        message: 'Đã chuyển thành công 2 hồ sơ vào hộp BOX-001',
        count: 2,
      })
      expect(updateManyArgs).toMatchObject({
        where: { id: { in: ['file-1', 'file-2'] } },
        data: {
          boxId: 'box-1',
          retention: 'Vĩnh viễn',
        },
      })
    })

    test('POST /api/files/batch-assign-box rejects non-admin users with 403', async () => {
      const app = createTestApp()
      const response = await app.handle(postJson('/api/files/batch-assign-box', {
        fileIds: ['file-1'],
        boxId: 'box-1',
      }, {
        headers: { cookie: await sessionCookie('VIEWER') },
      }))
      expect(response.status).toBe(403)
    })

    test('POST /api/files/batch-assign-box returns 400 when fileIds is empty or missing', async () => {
      const app = createTestApp()
      const response = await app.handle(postJson('/api/files/batch-assign-box', {
        fileIds: [],
        boxId: 'box-1',
      }, {
        headers: { cookie: await sessionCookie('ADMIN') },
      }))
      expect(response.status).toBe(400)
    })

    test('POST /api/files/batch-assign-box returns 404 when boxId does not exist', async () => {
      const app = createTestApp()
      setDbForTesting({
        storageBox: {
          findUnique: async () => null,
        },
      })
      const response = await app.handle(postJson('/api/files/batch-assign-box', {
        fileIds: ['file-1'],
        boxId: 'box-nonexistent',
      }, {
        headers: { cookie: await sessionCookie('ADMIN') },
      }))
      expect(response.status).toBe(404)
    })
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại**

Run: `bun test server/contracts/files.contract.test.ts`  
Expected: FAIL (404 Not Found do endpoint chưa tồn tại).

- [ ] **Step 3: Cài đặt endpoint `POST /api/files/batch-assign-box` trong `server/api-routes/files.routes.ts`**

Thêm route vào `server/api-routes/files.routes.ts`:

```typescript
  .post('/api/files/batch-assign-box', async ({ request, set }) => {
    try {
      const { session, denied } = await sessionOrDenied({ request, set }, 'manageFiles')
      if (denied) return denied

      const body = await request.json() as { fileIds?: string[]; boxId?: string }
      const fileIds = Array.isArray(body?.fileIds) ? body.fileIds.filter(id => typeof id === 'string' && id.trim()) : []
      const boxId = typeof body?.boxId === 'string' ? body.boxId.trim() : ''

      if (fileIds.length === 0) {
        return apiError(set, 'Vui lòng chọn ít nhất một hồ sơ', 400)
      }
      if (!boxId) {
        return apiError(set, 'Vui lòng chọn hộp lưu trữ đích', 400)
      }

      const box = await db.storageBox.findUnique({
        where: { id: boxId },
        select: { id: true, code: true, retention: true },
      })
      if (!box) {
        return apiError(set, 'Hộp lưu trữ không tồn tại', 404)
      }

      const updateData: Record<string, any> = {
        boxId: box.id,
        updatedById: session!.id,
      }
      if (box.retention) {
        updateData.retention = box.retention
      }

      const result = await db.file.updateMany({
        where: { id: { in: fileIds } },
        data: updateData,
      })

      await createAuditLog({
        action: 'UPDATE',
        target: 'File',
        targetId: 'batch_assign_box',
        userId: session!.id,
        ipAddress: getClientIp(request),
        detail: {
          boxId: box.id,
          boxCode: box.code,
          count: result.count,
          fileIds,
        },
      })

      return {
        success: true,
        message: `Đã chuyển thành công ${result.count} hồ sơ vào hộp ${box.code}`,
        count: result.count,
      }
    } catch (error) {
      console.error('Error in batch assign box:', error)
      return apiError(set, 'Không thể chuyển hồ sơ vào hộp lưu trữ', 500)
    }
  }, {
    detail: {
      tags: ['Files'],
      summary: 'Batch assign files to a storage box',
    },
  })
```

- [ ] **Step 4: Chạy test xác nhận tất cả test đều PASS**

Run: `bun test server/contracts/files.contract.test.ts`  
Expected: PASS (24 pass, 0 fail).

- [ ] **Step 5: Commit task 1**

```bash
git add server/api-routes/files.routes.ts server/contracts/files.contract.test.ts
git commit -m "feat(api): add batch assign box endpoint POST /api/files/batch-assign-box"
```

---

### Task 2: Component `BatchAssignBoxDialog`

**Files:**
- Create: `components/files/batch-assign-box-dialog.tsx`
- Create: `components/files/batch-assign-box-dialog.test.tsx`

**Interfaces:**
- Consumes: `useStorageBoxes` from `@/lib/hooks/use-storage-boxes`, `apiFetch` from `@/lib/api/client`, `toast` from `sonner`
- Produces: `BatchAssignBoxDialog` component with props `{ isOpen: boolean; onClose: () => void; selectedFiles: FileWithBox[]; onSuccess?: () => void }`

- [ ] **Step 1: Viết failing test cho `BatchAssignBoxDialog`**

Tạo `components/files/batch-assign-box-dialog.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
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

describe('BatchAssignBoxDialog', () => {
  const selectedFiles = [
    { id: 'file-1', code: 'HS-001', title: 'Hồ sơ 1' },
    { id: 'file-2', code: 'HS-002', title: 'Hồ sơ 2' },
  ] as unknown as FileWithBox[]

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
    expect(screen.getByText('Kho A')).toBeInTheDocument()
    expect(screen.getByText(/Vĩnh viễn/i)).toBeInTheDocument()

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
})
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại**

Run: `bun test:frontend components/files/batch-assign-box-dialog.test.tsx`  
Expected: FAIL (module not found).

- [ ] **Step 3: Cài đặt component `BatchAssignBoxDialog` trong `components/files/batch-assign-box-dialog.tsx`**

Tạo `components/files/batch-assign-box-dialog.tsx`:

```tsx
import * as React from 'react'
import { Archive, Check, ChevronsUpDown, Loader2, MapPin, Clock, FolderArchive, Layers } from 'lucide-react'
import { toast } from 'sonner'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { apiFetch } from '@/lib/api/client'
import { useStorageBoxes } from '@/lib/hooks/use-storage-boxes'
import type { FileWithBox } from '@/components/files/columns'
import type { StorageBoxDto } from '@/lib/api/types'
import { cn } from '@/lib/utils'

interface BatchAssignBoxDialogProps {
  isOpen: boolean
  onClose: () => void
  selectedFiles: FileWithBox[]
  onSuccess?: () => void
}

export function BatchAssignBoxDialog({
  isOpen,
  onClose,
  selectedFiles,
  onSuccess,
}: BatchAssignBoxDialogProps) {
  const [selectedBoxId, setSelectedBoxId] = React.useState<string>('')
  const [isComboboxOpen, setIsComboboxOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const { boxes, isLoading: isLoadingBoxes } = useStorageBoxes({}, isOpen)

  // Reset state when opening/closing
  React.useEffect(() => {
    if (!isOpen) {
      setSelectedBoxId('')
      setIsComboboxOpen(false)
      setIsSubmitting(false)
    }
  }, [isOpen])

  const selectedBox = React.useMemo<StorageBoxDto | undefined>(
    () => boxes.find((box) => box.id === selectedBoxId),
    [boxes, selectedBoxId]
  )

  const handleConfirm = async () => {
    if (!selectedBoxId) {
      toast.error('Vui lòng chọn hộp lưu trữ đích')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await apiFetch('/api/files/batch-assign-box', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileIds: selectedFiles.map((f) => f.id),
          boxId: selectedBoxId,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || 'Không thể chuyển hồ sơ vào hộp')
      }

      toast.success(data.message || `Đã chuyển ${selectedFiles.length} hồ sơ vào hộp thành công`)
      onSuccess?.()
      onClose()
    } catch (error) {
      console.error('Batch assign box error:', error)
      toast.error(error instanceof Error ? error.message : 'Có lỗi xảy ra khi chuyển hồ sơ')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSubmitting && !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Archive className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                Chuyển {selectedFiles.length} hồ sơ vào hộp lưu trữ
              </DialogTitle>
              <DialogDescription className="text-xs">
                Chọn hộp lưu trữ đích để xếp tất cả hồ sơ đã chọn vào.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Hộp lưu trữ đích <span className="text-destructive">*</span>
            </label>
            <Popover open={isComboboxOpen} onOpenChange={setIsComboboxOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={isComboboxOpen}
                  className="w-full justify-between font-normal text-sm h-10"
                  disabled={isSubmitting || isLoadingBoxes}
                >
                  {selectedBox ? (
                    <span className="flex items-center gap-2 truncate">
                      <span className="font-semibold font-mono">{selectedBox.code}</span>
                      <span className="text-muted-foreground text-xs">
                        ({selectedBox.warehouse} - {selectedBox.line} - {selectedBox.shelf})
                      </span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      {isLoadingBoxes ? 'Đang tải danh sách hộp...' : 'Tìm kiếm và chọn hộp lưu trữ...'}
                    </span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Gõ mã hộp, kho, kệ, loại án..." />
                  <CommandList className="max-h-60">
                    <CommandEmpty>Không tìm thấy hộp lưu trữ phù hợp.</CommandEmpty>
                    <CommandGroup>
                      {boxes.map((box) => (
                        <CommandItem
                          key={box.id}
                          value={`${box.code} ${box.boxNumber} ${box.warehouse} ${box.line} ${box.shelf} ${box.slot} ${box.caseType || ''} ${box.agency?.name || ''}`}
                          onSelect={() => {
                            setSelectedBoxId(box.id)
                            setIsComboboxOpen(false)
                          }}
                          className="flex items-center justify-between py-2 cursor-pointer"
                        >
                          <div className="flex flex-col gap-0.5 min-w-0 pr-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold font-mono text-sm">{box.code}</span>
                              {box.caseType && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {box.caseType}
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground truncate">
                              {box.warehouse} &bull; {box.line} &bull; {box.shelf} {box.slot ? `&bull; ${box.slot}` : ''}
                            </span>
                          </div>
                          <Check
                            className={cn(
                              "h-4 w-4 shrink-0 text-primary",
                              selectedBoxId === box.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {selectedBox && (
            <div className="rounded-lg border bg-slate-50/80 p-3 text-xs space-y-2 dark:bg-slate-900/50 dark:border-slate-800">
              <div className="flex items-center justify-between border-b pb-2 dark:border-slate-800">
                <span className="font-semibold text-slate-700 dark:text-slate-200">Thông tin hộp</span>
                <Badge variant="outline" className="font-mono bg-background">
                  {selectedBox.code}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <MapPin className="size-3.5 shrink-0 text-slate-500" />
                  <span className="truncate">
                    {selectedBox.warehouse} - {selectedBox.line} - {selectedBox.shelf} {selectedBox.slot ? `- ${selectedBox.slot}` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <FolderArchive className="size-3.5 shrink-0 text-slate-500" />
                  <span className="truncate">Đang có: {selectedBox._count?.files ?? 0} hồ sơ</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Layers className="size-3.5 shrink-0 text-slate-500" />
                  <span className="truncate">{selectedBox.caseType || 'Chưa phân loại'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="size-3.5 shrink-0 text-slate-500" />
                  <span className="truncate">Thời hạn: {selectedBox.retention || 'Không khóa'}</span>
                </div>
              </div>
              {selectedBox.retention && (
                <div className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-1.5 rounded border border-amber-200/50 dark:border-amber-900/50">
                  Thời hạn bảo quản của các hồ sơ được chọn sẽ tự động đồng bộ theo hộp (<strong>{selectedBox.retention}</strong>).
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-xs h-8"
          >
            Hủy
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting || !selectedBoxId}
            className="text-xs h-8 gap-1.5"
          >
            {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Xác nhận chuyển
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Chạy test xác nhận PASS**

Run: `bun test:frontend components/files/batch-assign-box-dialog.test.tsx`  
Expected: PASS.

- [ ] **Step 5: Commit task 2**

```bash
git add components/files/batch-assign-box-dialog.tsx components/files/batch-assign-box-dialog.test.tsx
git commit -m "feat(ui): create BatchAssignBoxDialog component"
```

---

### Task 3: Tích hợp vào `FileTable` toolbar & Kiểm thử toàn diện

**Files:**
- Modify: `components/files/file-table.tsx`
- Modify: `components/files/file-table.test.tsx`

**Interfaces:**
- Consumes: `BatchAssignBoxDialog` in `FileTable`
- Produces: Integrated button "Chuyển vào hộp" when `selectedRows.length > 0 && canManageFiles`

- [ ] **Step 1: Cập nhật `components/files/file-table.tsx`**

1. Import `BatchAssignBoxDialog` và icon `Archive` (hoặc `PackageOpen`).
2. Thêm state `const [isAssignBoxModalOpen, setIsAssignBoxModalOpen] = React.useState(false)`.
3. Thêm nút "Chuyển vào hộp" vào toolbar hành động:
```tsx
                  {canManageFiles && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsAssignBoxModalOpen(true)}
                      className="h-7 rounded-md bg-background text-xs font-semibold"
                    >
                      <Archive className="mr-1.5 size-3.5" />
                      Chuyển vào hộp
                    </Button>
                  )}
```
4. Render `<BatchAssignBoxDialog />`:
```tsx
      <BatchAssignBoxDialog
        isOpen={isAssignBoxModalOpen}
        onClose={() => setIsAssignBoxModalOpen(false)}
        selectedFiles={selectedFiles}
        onSuccess={() => {
          table.resetRowSelection()
          queryClient.invalidateQueries({ queryKey: queryKeys.files.all })
          queryClient.invalidateQueries({ queryKey: queryKeys.files.stats })
          queryClient.invalidateQueries({ queryKey: queryKeys.boxes.all })
          onRefresh?.()
        }}
      />
```

- [ ] **Step 2: Thêm unit test vào `components/files/file-table.test.tsx`**

Bổ sung test case kiểm tra nút "Chuyển vào hộp" xuất hiện khi chọn dòng và `canManageFiles={true}`:

```tsx
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
```

- [ ] **Step 3: Chạy toàn bộ frontend tests**

Run: `bun run test:frontend`  
Expected: All tests pass.

- [ ] **Step 4: Chạy server tests**

Run: `bun test server/contracts/files.contract.test.ts`  
Expected: All tests pass.

- [ ] **Step 5: Commit task 3**

```bash
git add components/files/file-table.tsx components/files/file-table.test.tsx
git commit -m "feat(files): integrate batch assign box dialog into file table toolbar"
```
