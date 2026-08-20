# Design Spec: Bộ lọc Hồ sơ theo Hộp lưu trữ (Chưa có hộp / Đã có hộp)

**Author**: Antigravity  
**Date**: 2026-08-20  
**Status**: Approved  

---

## 1. Goal & Context

Trong hệ thống quản lý hồ sơ vụ án, hồ sơ (`File`) có thể đã được xếp vào hộp lưu trữ (`StorageBox`, liên kết qua `boxId`) hoặc chưa được xếp vào hộp nào (`boxId: null`).

Người dùng cần một bộ lọc nhanh để:
- Tìm các **hồ sơ chưa có hộp lưu trữ** (`Chưa có hộp`) để tiến hành gom, phân loại và đóng hộp.
- Hoặc tìm các **hồ sơ đã có hộp lưu trữ** (`Đã có hộp`) khi cần tra cứu các hồ sơ đã hoàn tất quy trình lưu trữ.

---

## 2. Technical Design

### A. Backend API (`server/api-routes/files.routes.ts`)
- **Query Parameter**: Thêm tham số `hasBox` (`'true'` | `'false'` | `'all'` | `undefined`).
- **Prisma Filter Query**:
  ```ts
  const hasBox = query.hasBox || undefined;

  // Trong Prisma where AND condition:
  hasBox === 'false' ? { boxId: null } : {},
  hasBox === 'true' ? { boxId: { not: null } } : {},
  ```
- Khi `hasBox` không truyền hoặc là `'all'`, không lọc theo điều kiện `boxId`.

### B. Client Hook & Router (`lib/hooks/use-files.ts` & `components/files/file-list-section.tsx`)
1. Cập nhật `SearchParams` interface trong `lib/hooks/use-files.ts`:
   ```ts
   export interface SearchParams {
     // ...
     hasBox?: string;
   }
   ```
2. Cập nhật `getFilesQueryString(params: SearchParams)`:
   ```ts
   if (params.hasBox && params.hasBox !== 'all') queryString.set('hasBox', params.hasBox)
   ```
3. Cập nhật `FileListSection` (`components/files/file-list-section.tsx`):
   - Đọc `hasBox = searchParams.get('hasBox') || undefined`
   - Truyền `hasBox` vào `useFiles({ ..., hasBox })`

### C. UI Component: `FileTableToolbar` (`components/files/file-table-toolbar.tsx`)
1. **Định nghĩa danh sách tùy chọn lọc Hộp lưu trữ**:
   ```ts
   const storageBoxStatusOptions = [
     { value: "false", label: "Chưa có hộp" },
     { value: "true", label: "Đã có hộp" },
   ];
   ```
2. **Thêm `DataTableFacetedFilter` vào Row 2 Toolbar**:
   - Vị trí: Đặt liền sau bộ lọc "Trạng thái".
   - `title="Hộp lưu trữ"`
   - `options={storageBoxStatusOptions}`
   - `value={searchParams.get("hasBox") ? [searchParams.get("hasBox")!] : []}`
   - `onFilter={(values) => setUrlParam("hasBox", values?.[0] || "all")}`
3. **Cập nhật trạng thái `isFiltered`**:
   - Thêm `"hasBox"` vào mảng kiểm tra filter đang kích hoạt.
4. **Cập nhật danh sách `activeFilters` badge chips**:
   - Thêm chip hiển thị khi `searchParams.get("hasBox")`:
     ```ts
     searchParams.get("hasBox") ? {
       key: "hasBox",
       label: "Hộp lưu trữ",
       value: storageBoxStatusOptions.find(o => o.value === searchParams.get("hasBox"))?.label || searchParams.get("hasBox")!
     } : null
     ```
5. **Cập nhật hàm `handleReset`**:
   - Xóa key `"hasBox"` khỏi URL search params khi bấm "Đặt lại".

---

## 3. Verification Plan

### Automated Tests
- Cập nhật và bổ sung test cases trong `server/contracts/files.contract.test.ts`:
  - Test `GET /api/files?hasBox=false` gửi đúng `{ boxId: null }` tới Prisma `findMany` và `count`.
  - Test `GET /api/files?hasBox=true` gửi đúng `{ boxId: { not: null } }` tới Prisma.
- Chạy toàn bộ test suite bằng `bun test`.

### Manual Verification
- Mở trang Danh sách hồ sơ trên trình duyệt:
  - Chọn lọc "Hộp lưu trữ" -> "Chưa có hộp". Kiểm tra cột "Hộp số" hiển thị `-` (chưa có hộp).
  - Chọn lọc "Hộp lưu trữ" -> "Đã có hộp". Kiểm tra danh sách chỉ gồm các hồ sơ đã có mã hộp.
  - Kiểm tra badge chip "Hộp lưu trữ: Chưa có hộp" hiển thị ở hàng "Đang lọc:" và nút `X` trên chip hoạt động chính xác.
  - Bấm "Đặt lại" để xác nhận tất cả bộ lọc quay về mặc định.
