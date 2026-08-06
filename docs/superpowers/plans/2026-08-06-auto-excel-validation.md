# Auto Excel Validation & Fix Guidance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically trigger file validation (`preview`) immediately upon selecting/dropping an Excel file on `/upload?mode=excel`, display interactive fix guidance if errors exist, and activate "Xác nhận nhập" only when 0 errors remain.

**Architecture:** Refactor `ExcelUploadForm` component to auto-trigger `handlePreview` whenever a file is set or dropped, update loading states in the Dropzone & Step Bar, render a Fix Guidance Card on validation errors, and remove the manual "Kiểm tra file" button.

**Tech Stack:** React 19 / Next.js Client Component, Tailwind CSS, Lucide Icons, Shadcn UI (`Button`, `Badge`, `Table`), TypeScript.

## Global Constraints

- **File Path**: `components/forms/excel-upload-form.tsx`
- **Design Spec**: `docs/superpowers/specs/2026-08-06-auto-excel-validation-design.md`
- **Supported extensions**: `.xlsx`, `.xls`
- **Commit button behavior**: Disabled while `!preview`, `isPreviewing`, `isCommitting`, or `preview.summary.errors > 0`.

---

### Task 1: Refactor `ExcelUploadForm` to Auto-Validate Files & Remove Manual Check Button

**Files:**
- Modify: `components/forms/excel-upload-form.tsx:1-416`

**Interfaces:**
- Consumes: `/api/upload/excel/preview` endpoint (POST FormData)
- Produces: `ExcelUploadForm` component with automatic preview execution on file pick/drop

- [ ] **Step 1: Update `handlePreview` to accept an explicit `targetFile` parameter**

Update `handlePreview` function signature and implementation so it can be called programmatically with a `File` object:

```tsx
const handlePreview = async (fileToPreview: File) => {
  setIsPreviewing(true)
  setPreview(null)

  const formData = new FormData()
  formData.append('file', fileToPreview)

  try {
    const response = await apiFetch('/api/upload/excel/preview', {
      method: 'POST',
      body: formData,
    })
    const result: ApiResult<ExcelImportPreview> = await response.json()

    if (response.ok && result.success && result.data) {
      setPreview(result.data)
      if (result.data.summary.errors > 0) {
        toast.warning(`File có ${result.data.summary.errors} lỗi cần xử lý trước khi nhập`)
      } else if (result.data.summary.warnings > 0) {
        toast.warning(`File có ${result.data.summary.warnings} cảnh báo, vui lòng kiểm tra trước khi nhập`)
      } else {
        toast.success('File hợp lệ, có thể nhập dữ liệu')
      }
      return
    }

    toast.error(result.message || 'Không thể kiểm tra file Excel')
  } catch {
    toast.error('Có lỗi xảy ra khi kiểm tra file')
  } finally {
    setIsPreviewing(false)
  }
}
```

- [ ] **Step 2: Connect file pick/drop events to trigger `handlePreview` automatically**

In `handleDrop` and `<input onChange={...}>`:
When a valid `.xlsx`/`.xls` file is received:
1. `setFile(droppedFile)`
2. `handlePreview(droppedFile)`

```tsx
const handleFileSelect = (selectedFile: File) => {
  const fileExt = selectedFile.name.split('.').pop()?.toLowerCase()
  if (fileExt === 'xlsx' || fileExt === 'xls') {
    setFile(selectedFile)
    setPreview(null)
    handlePreview(selectedFile)
  } else {
    toast.error('Chỉ hỗ trợ định dạng file .xlsx, .xls')
  }
}
```

- [ ] **Step 3: Update Dropzone UI for loading state (`isPreviewing`)**

When `isPreviewing` is `true`:
Show `Loader2` spinning icon and `"Đang tự động rà soát dữ liệu file Excel..."` text in the dropzone card.

- [ ] **Step 4: Remove manual "Kiểm tra file" button from form footer**

Remove the `<Button type="submit">Kiểm tra file</Button>` button so only `"Xác nhận nhập"` remains as the primary action.

- [ ] **Step 5: Verify build & typecheck**

Run: `npx tsc --noEmit`  
Expected: 0 errors.

- [ ] **Step 6: Commit Task 1**

```bash
git add components/forms/excel-upload-form.tsx
git commit -m "feat(upload): auto-trigger excel validation on file selection and remove manual check button"
```

---

### Task 2: Enhance Fix Guidance UI & Step Bar Indicators

**Files:**
- Modify: `components/forms/excel-upload-form.tsx`

**Interfaces:**
- Consumes: `ExcelImportPreview` (`issues`, `summary`)

- [ ] **Step 1: Update `getStepStyle` logic for Step Indicators**

Ensure Step 2 shows loading styling when `isPreviewing` is `true`, error styling when `preview.summary.errors > 0`, and green styling when `preview.summary.errors === 0`.
Step 3 becomes active & green when `preview && preview.summary.errors === 0`.

- [ ] **Step 2: Render Fix Guidance Card when errors exist**

When `preview.summary.errors > 0`, render a Fix Guidance Banner above the issue table:

```tsx
{preview.summary.errors > 0 && (
  <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-3">
    <div className="flex items-center gap-2 text-destructive font-bold text-sm">
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span>File Excel có {preview.summary.errors} lỗi cần sửa đổi trước khi nhập</span>
    </div>
    <div className="text-xs text-muted-foreground space-y-1.5 pl-6 list-disc">
      <p><strong className="text-foreground">Thiếu thông tin bắt buộc:</strong> Rà soát các ô trống tại cột Hồ sơ số, Tiêu đề / Trích yếu, hoặc Loại án.</p>
      <p><strong className="text-foreground">Mã hồ sơ bị trùng:</strong> Kiểm tra các mã bị lặp lại trong file Excel hoặc đã có trên hệ thống.</p>
      <p><strong className="text-foreground">Năm không hợp lệ:</strong> Năm mở hồ sơ phải là số nguyên (từ 1900 đến 2200).</p>
    </div>
    <div className="pt-1 flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        className="h-8 text-xs font-semibold border-red-500/30 text-destructive hover:bg-red-500/10"
      >
        <UploadCloud className="h-3.5 w-3.5 mr-1.5" />
        Sửa file & Tải lại
      </Button>
    </div>
  </div>
)}
```

- [ ] **Step 3: Add helper explanation text for disabled "Xác nhận nhập" button**

Below the action buttons, if `preview && preview.summary.errors > 0`, display a subtle notice:
`<p className="text-[11px] text-destructive text-right">(*) Nút Xác nhận nhập sẽ được kích hoạt sau khi file hết lỗi nghiêm trọng.</p>`

- [ ] **Step 4: Verify build & typecheck**

Run: `npx tsc --noEmit`  
Expected: 0 errors.

- [ ] **Step 5: Commit Task 2**

```bash
git add components/forms/excel-upload-form.tsx
git commit -m "feat(upload): add fix guidance card and step bar indicators for excel upload validation"
```

---

## Plan Self-Review

1. **Spec coverage:** 
   - Auto-trigger on file pick/drop: covered in Task 1.
   - Remove manual button: covered in Task 1.
   - Loading indicator in dropzone & steps: covered in Task 1 & 2.
   - Fix guidance UI banner + issue list: covered in Task 2.
   - Enable "Xác nhận nhập" button on 0 errors: covered in Task 1 & 2.
2. **Placeholder scan:** No TBD, TODO, or vague statements.
3. **Type consistency:** All property names match existing `ExcelImportPreview` schema.
