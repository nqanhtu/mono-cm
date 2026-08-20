# Cho Phép Người Không Có Username Mượn Hồ Sơ - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép cán bộ lưu trữ lập và sửa phiếu mượn hồ sơ cho người mượn tự do/bên ngoài (không có tài khoản/username hệ thống), đồng thời duy trì tính năng gợi ý và tự điền khi chọn người dùng nội bộ.

**Architecture:** Nâng cấp `BorrowForm` từ việc phụ thuộc vào `selectedUserId` (chọn từ danh sách cố định) sang quản lý trực tiếp các trường văn bản `borrowerName`, `borrowerUnit`, `borrowerTitle` với ô autocomplete/gợi ý người dùng nội bộ, cập nhật validation, print draft và các test case tương ứng.

**Tech Stack:** React 19, TypeScript, Lucide React, Tailwind CSS, Vitest, Testing Library.

## Global Constraints

- Không làm thay đổi schema database hay contract của API `/api/borrow` (API và database vốn đã hỗ trợ text string cho `borrowerName`, `borrowerUnit`, `borrowerTitle`).
- Giữ nguyên các chức năng in phiếu dự thảo (`handlePrintDraft`) và in phiếu mượn.
- Phải hỗ trợ hiển thị và cập nhật chính xác cả khi sửa phiếu mượn của người mượn ngoài (`initialData`).
- Ngôn ngữ giao diện và thông báo: Tiếng Việt.

---

### Task 1: Tạo Component Test cho `BorrowForm` với người mượn ngoài và người dùng nội bộ

**Files:**
- Create: `components/borrow/borrow-form.test.tsx`
- Modify: None
- Test: `components/borrow/borrow-form.test.tsx`

**Interfaces:**
- Consumes: `components/borrow/borrow-form.tsx`
- Produces: Test suite kiểm thử tự động cho `BorrowForm` gồm các case:
  - Nhập tên người mượn tự do (không có tài khoản) và submit thành công.
  - Chọn người mượn từ danh sách gợi ý hệ thống và tự điền đơn vị.
  - Validation: Báo lỗi khi tên người mượn bị để trống.
  - In phiếu dự thảo hoạt động khi nhập tên người mượn ngoài.
  - Chế độ chỉnh sửa (`initialData`) nạp đúng tên và đơn vị của người mượn ngoài.

- [ ] **Step 1: Viết test suite kiểm thử thất bại (hoặc test các hành vi mới)**

Tạo file `components/borrow/borrow-form.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Chạy kiểm thử để xác nhận thất bại (do `BorrowForm` chưa cập nhật)**

Run: `bun run test:frontend components/borrow/borrow-form.test.tsx`
Expected: FAIL (vì chưa có input Người mượn dạng textbox/label Đơn vị).

- [ ] **Step 3: Commit file test**

```bash
git add components/borrow/borrow-form.test.tsx
git commit -m "test: add test suite for borrow form external borrower"
```

---

### Task 2: Nâng cấp `BorrowForm` hỗ trợ nhập tên người mượn tự do và gợi ý người dùng

**Files:**
- Modify: `components/borrow/borrow-form.tsx`
- Test: `components/borrow/borrow-form.test.tsx`

**Interfaces:**
- Consumes: `lib/api/types.ts`, `lib/borrow/print.ts`, `/api/users?purpose=borrower`
- Produces: `BorrowForm` component với tính năng Combobox/Autocomplete người mượn, nhập đơn vị tự do, validation và print draft theo dữ liệu text.

- [ ] **Step 1: Triển khai cập nhật `BorrowForm`**

Cập nhật `components/borrow/borrow-form.tsx`:
1. Thay đổi state:
   - `borrowerName`: `useState(initialData?.borrowerName || "")`
   - `borrowerUnit`: `useState(initialData?.borrowerUnit || "")`
   - `borrowerTitle`: `useState(initialData?.borrowerTitle || "")`
   - `showUserSuggestions`: `useState(false)`
2. Xây dựng autocomplete dropdown khi focus hoặc gõ vào `borrowerName`. Dropdown lọc danh sách `users` theo tên, username hoặc đơn vị. Khi click vào 1 user:
   - Cập nhật `borrowerName = user.fullName`
   - Cập nhật `borrowerUnit = user.unit || ""`
   - Đóng dropdown
3. Thêm trường input "Đơn vị / Phòng ban (Optional)" (`borrowerUnit`).
4. Cập nhật `handlePrintDraft`:
   - Kiểm tra `!borrowerName.trim() || selectedFiles.length === 0`.
   - Sử dụng `borrowerName`, `borrowerUnit`, `borrowerTitle` từ state.
5. Cập nhật `handleSubmit`:
   - Kiểm tra `!borrowerName.trim()`.
   - Gửi payload `{ id: slipId, borrowerName: borrowerName.trim(), borrowerUnit: borrowerUnit.trim(), borrowerTitle: borrowerTitle.trim(), reason, dueDate, fileIds }`.
6. Cập nhật disable button:
   - Submit: `disabled={isSubmitting || selectedFiles.length === 0 || !borrowerName.trim()}`
   - Print: `disabled={!borrowerName.trim() || selectedFiles.length === 0}`

- [ ] **Step 2: Chạy kiểm thử frontend**

Run: `bun run test:frontend components/borrow/borrow-form.test.tsx`
Expected: PASS (all 3 tests pass).

- [ ] **Step 3: Chạy toàn bộ test frontend và server để đảm bảo không có regression**

Run: `bun run test:frontend && bun run test:server`
Expected: All tests PASS.

- [ ] **Step 4: Commit code**

```bash
git add components/borrow/borrow-form.tsx
git commit -m "feat: allow external borrowers without username in borrow form"
```

---

### Task 3: Đồng bộ và kiểm tra toàn diện quy trình mượn trả

**Files:**
- Modify (nếu cần): `src/routes/borrow/create-borrow-page.tsx`
- Test: `components/borrow/borrow-form.test.tsx`, `server/contracts/borrow.contract.test.ts`

**Interfaces:**
- Consumes: `components/borrow/borrow-list-section.tsx`, `src/routes/borrow/create-borrow-page.tsx`
- Produces: Quy trình tạo/sửa phiếu mượn hoàn chỉnh cho cả người nội bộ và người ngoài.

- [ ] **Step 1: Kiểm tra `src/routes/borrow/create-borrow-page.tsx`**

Đảm bảo trang `/borrow/create` (trang lập phiếu mượn từ danh sách hồ sơ) cũng có trải nghiệm nhất quán, nhãn rõ ràng và hỗ trợ đầy đủ các trường `borrowerName`, `borrowerUnit`, `borrowerTitle`.

- [ ] **Step 2: Chạy kiểm thử hợp đồng backend**

Run: `bun test server/contracts/borrow.contract.test.ts`
Expected: PASS.

- [ ] **Step 3: Chạy linter & build check**

Run: `bun run lint && bun run build`
Expected: Không có lỗi TypeScript hay build error.

- [ ] **Step 4: Commit**

```bash
git add src/routes/borrow/create-borrow-page.tsx
git commit -m "chore: ensure consistent borrower fields across all borrow pages"
```
