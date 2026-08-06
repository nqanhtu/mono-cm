# Design Spec: Auto-Validation & Fix Guidance for Excel Upload

**Date:** 2026-08-06  
**Status:** Approved  
**Target File:** `components/forms/excel-upload-form.tsx`  

---

## 1. Overview & Goal

Currently on `/upload?mode=excel`, when users upload or drag-and-drop an Excel file, the file is set in state but validation (`preview`) is not automatically executed. The "Xác nhận nhập" (Confirm Import) button remains disabled until the user manually clicks "Kiểm tra file" (Check File). Users often mistake the disabled button for a failed upload.

### Solution
- Remove the manual "Kiểm tra file" button.
- Automatically trigger file validation (`preview`) immediately upon file selection or drop.
- Provide a loading indicator inside the dropzone and step bar during validation.
- If validation succeeds (0 errors), automatically activate the "Xác nhận nhập" button.
- If validation finds errors, display a prominent **Fix Guidance Card** explaining how to resolve common Excel errors, alongside a detailed table of specific line/column/code issues, and a quick re-upload button.

---

## 2. Component Architecture & State Flow

### State Changes in `ExcelUploadForm`:
- `file: File | null`
- `isPreviewing: boolean`
- `isCommitting: boolean`
- `preview: ExcelImportPreview | null`

### Event & Data Flow:

```
[User Selects / Drops File]
           │
           ▼
  setFile(selectedFile)
  setPreview(null)
  runPreview(selectedFile)  <── Automatic Trigger
           │
           ├──► [isPreviewing = true] ──► Dropzone shows loading spinner & status text
           │
           ▼
  [API /api/upload/excel/preview]
           │
           ├──► Success (0 errors):
           │      - Step 1: Complete (Green)
           │      - Step 2: Complete (Green)
           │      - Step 3: Active (Green)
           │      - "Xác nhận nhập" Button: ENABLED
           │      - Summary badges: Ready to import
           │
           └──► Has Errors (> 0 errors):
                  - Step 1: Complete (Green)
                  - Step 2: Error (Red)
                  - Step 3: Disabled (Muted)
                  - "Xác nhận nhập" Button: DISABLED
                  - Render: Fix Guidance Card + Error List Table + "Chọn file khác để thử lại"
```

---

## 3. Detailed UI Components & Enhancements

### 3.1 Dropzone & Auto-Validation Loading State
- When `isPreviewing` is true:
  - Replace default upload icon with `Loader2` spinner.
  - Display helper text: `"Đang tự động rà soát dữ liệu file Excel..."`.
  - Disable dropzone interaction during preview.

### 3.2 Step Indicator Updates
- **Step 1 (Chọn file)**: Active when no file, turns green when file is selected.
- **Step 2 (Kiểm tra)**:
  - Loading: Yellow/blue pulse or spinner during `isPreviewing`.
  - Error: Red border & text if `preview.summary.errors > 0`.
  - Success: Green border & text if `preview.summary.errors === 0`.
- **Step 3 (Xác nhận nhập)**:
  - Disabled until `preview` is present and `errors === 0`.
  - Active & highlighted green when ready.

### 3.3 Fix Guidance Card (`preview.summary.errors > 0`)
A dedicated banner above/next to the issue table displaying:
- **Title**: `File Excel có {errors} lỗi cần xử lý trước khi nhập`
- **Common Fix Checklist**:
  1. **Thiếu dữ liệu**: Kiểm tra các ô trống tại cột *Hồ sơ số*, *Tiêu đề / Trích yếu*, *Loại án*.
  2. **Mã hồ sơ bị trùng**: Mã hồ sơ trùng lặp trong file Excel hoặc đã tồn tại trong hệ thống.
  3. **Năm không hợp lệ**: Năm phải là số nguyên từ 1900 đến 2200.
- **Action**: Quick action button `"Sửa file và tải lên lại"`.

---

## 4. Error Handling & Edge Cases

| Case | Handling |
|------|----------|
| Invalid file extension | Toast error `"Chỉ hỗ trợ định dạng file .xlsx, .xls"`, reset file input. |
| API preview network failure | Set `isPreviewing = false`, display Toast error + inline warning card with `"Thử rà soát lại"`. |
| User selects a new file while previewing | Cancel previous request or overwrite state with new file preview. |
| Zero files in Excel | API preview returns 0 files; display warning issue asking for populated sheet. |

---

## 5. Verification Plan

1. **Automated Verification**:
   - Run typecheck (`tsc --noEmit`) and linter to verify TypeScript compliance.
   - Run existing component tests or contract tests (`npm test` / Vitest).
2. **Manual Verification**:
   - Upload valid Excel template -> verify instant preview, green status, enabled "Xác nhận nhập" button.
   - Upload Excel with missing title / duplicate code -> verify instant preview, red status, Fix Guidance Card display, disabled "Xác nhận nhập" button.
   - Click "Chọn file khác" -> upload corrected file -> verify status updates cleanly.
