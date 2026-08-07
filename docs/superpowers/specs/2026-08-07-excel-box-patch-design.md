# Excel Box Patch Feature Design

**Date**: 2026-08-07  
**Goal**: Provide a dedicated UI button and backend endpoint ("Vá Hộp số từ Excel") to patch and link existing `File` records (which have missing `boxId`) to pre-existing `StorageBox` records in the database based on uploaded Excel files (e.g. `mau-ho-so-me 2011.xlsx`), WITHOUT auto-creating new boxes in the database.

---

## 1. Requirements & Business Rules

1. **Match Existing Files**:
   - Match `File` records in DB by `code` (Hồ sơ số).
2. **Lookup Pre-existing StorageBoxes Only**:
   - Find matching `StorageBox` records in DB by `code` or `boxNumber` (e.g. `H1888` or `1888`).
   - If the `StorageBox` exists in DB, update `File.boxId`.
   - **STRICT RULE**: If the `StorageBox` does NOT exist in DB, DO NOT create a new box automatically. Keep `File.boxId` as-is and report a warning message listing the missing box code/number.
3. **User Access**:
   - Authorized roles: `SUPER_ADMIN`, `ADMIN`, `COORDINATOR`.
4. **Audit Logging**:
   - Log the patch operation in `AuditLog` with details of patched count, missing boxes, and errors.

---

## 2. API Endpoint Specification

### `POST /api/upload/excel/patch-boxes`

- **Content-Type**: `multipart/form-data`
- **Payload**: `file` (Excel file `.xlsx` or `.xls`)
- **Response Format**:
```json
{
  "success": true,
  "stats": {
    "scanned": 336,
    "matchedFiles": 336,
    "patched": 336,
    "missingBoxCount": 0
  },
  "missingBoxes": [],
  "issues": []
}
```
- **Error / Warning Handling**:
  - If a file code in Excel is not found in DB: record issue.
  - If a box code in Excel is not found in DB: list box code in `missingBoxes` array with human-readable warning ("Hộp 1888 chưa tồn tại trong CSDL, vui lòng tạo Hộp trước").

---

## 3. UI Component Specification

### `components/forms/excel-box-patch-dialog.tsx`
- Modal Component triggered by **"Vá Hộp số từ Excel"** button on the Upload page (`/upload`).
- Features:
  - File Dropzone for `.xlsx` / `.xls`.
  - Preview & Patch Execution button.
  - Clear summary badges for Scanned, Matched, Patched, and Missing Box Warnings.
  - Interactive table of warnings/missing boxes if any boxes are not found in DB.

---

## 4. Verification Plan

- **Contract Unit Test**: `server/contracts/upload.contract.test.ts`
  - Verify `POST /api/upload/excel/patch-boxes` authentication check.
  - Verify patching matching files with existing storage box in DB.
  - Verify non-existent boxes are NOT created and warnings are returned.
