# Design Spec: Case Files Server-side Sorting & Child Documents Client-side Sorting

**Author**: Antigravity
**Date**: 2026-07-06
**Status**: Approved

## 1. Goal & Context

The Case Files application manages dossiers (Hồ sơ) and their associated child documents (Văn bản). Sorting is essential for users to quickly organize and locate documents.
Currently:
1. The main Case Files list table at `/` (homepage) does not have interactive column headers for sorting, and the backend has a hardcoded sort of `{ createdAt: 'desc' }`. Because pagination is server-side, sorting must be performed on the server side to be accurate across all records.
2. The Child Documents list table on the case file details page `/files/:id` is a static HTML table and does not support sorting. Since all child documents are loaded together, sorting can be handled purely on the client side.

This specification details the technical changes to implement:
- Dynamic server-side sorting on the main Case Files list table, synchronized via URL parameters.
- Dynamic client-side sorting on the Child Documents list table.

---

## 2. Detailed Technical Design

### A. Backend Route & Client Hook (Server-side Sorting)

We will update [files.routes.ts](file:///Users/anhtu/Projects/mono-cm/server/api-routes/files.routes.ts) and [use-files.ts](file:///Users/anhtu/Projects/mono-cm/lib/hooks/use-files.ts) to accept and process sort parameters.

#### 1. Backend Route Change
- In GET `/api/files`, parse `sortField` and `sortOrder` query parameters.
- Safe list of sortable fields on `File` model: `['code', 'title', 'type', 'year', 'pageCount', 'status', 'createdAt', 'updatedAt', 'note', 'judgmentNumber', 'judgmentDate']`.
- Map virtual columns to database fields:
  - `defendants_civil` -> sort by `defendants` (string array).
  - `plaintiffs_victims` -> sort by `plaintiffs` (string array).
- Build the `orderBy` object dynamically:
  ```typescript
  let orderBy: Prisma.FileOrderByWithRelationInput = { createdAt: 'desc' };
  if (sortField) {
    if (sortField === 'defendants_civil') {
      orderBy = { defendants: sortOrder };
    } else if (sortField === 'plaintiffs_victims') {
      orderBy = { plaintiffs: sortOrder };
    } else if (validFields.includes(sortField)) {
      orderBy = { [sortField]: sortOrder };
    }
  }
  ```

#### 2. Client Hook Change
- In `SearchParams` interface and `getFilesQueryString` in `lib/hooks/use-files.ts`, support optional `sortField?: string` and `sortOrder?: 'asc' | 'desc'`.

---

### B. Case Files Table (Frontend Implementation)

We will wrap column headers in `columns.tsx` using `DataTableColumnHeader`, make `FileTable` controlled with respect to sorting, and wire up `FileListSection` to sync with URL parameters.

#### 1. Columns Update
In [columns.tsx](file:///Users/anhtu/Projects/mono-cm/components/files/columns.tsx):
- Wrap headers with `<DataTableColumnHeader column={column} title="..." />`.
- Use `accessorFn` for computed/custom columns (`defendants_civil`, `plaintiffs_victims`, `createdBy`, `updatedBy`) so TanStack Table can identify column IDs.

#### 2. Table Component Update
In [file-table.tsx](file:///Users/anhtu/Projects/mono-cm/components/files/file-table.tsx):
- Add controlled sorting props: `sorting?: SortingState`, `onSortingChange?: (sorting: SortingState) => void`.
- Enable `manualSorting: true` in `useReactTable` settings.

#### 3. List Section Update
In [file-list-section.tsx](file:///Users/anhtu/Projects/mono-cm/components/files/file-list-section.tsx):
- Read `sortField` and `sortOrder` from URL search params.
- Map them to `SortingState` and pass to `FileTable`.
- Pass a callback `onSortingChange` to synchronize changes back to the URL search params and reset the page to 1.

---

### C. Child Documents Table (Client-side Sorting)

In [child-document-workspace.tsx](file:///Users/anhtu/Projects/mono-cm/components/files/child-document-workspace.tsx), we will implement a client-side sorting hook/state:

- Add sorting states:
  ```typescript
  const [sortField, setSortField] = useState<'order' | 'title' | 'code' | 'year' | 'pageCount' | 'note' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  ```
- Sort the `documents` array before rendering:
  ```typescript
  const sortedDocuments = useMemo(() => {
      if (!sortField) return documents;
      return [...documents].sort((a, b) => {
          let valA = a[sortField];
          let valB = b[sortField];
          
          if (sortField === 'order') {
              valA = a.order ?? 0;
              valB = b.order ?? 0;
          } else if (sortField === 'pageCount') {
              valA = a.pageCount ?? 0;
              valB = b.pageCount ?? 0;
          } else {
              valA = (valA as string || '').toLowerCase();
              valB = (valB as string || '').toLowerCase();
          }
          
          if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
          if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
          return 0;
      });
  }, [documents, sortField, sortDirection]);
  ```
- Add hover cursor (`cursor-pointer`) and interactive sorting arrow icons to headers (using `ArrowUp`, `ArrowDown`, `ChevronsUpDown` from `lucide-react`).

---

## 3. Verification Plan

### Automated Tests
- Run `bun run test:frontend` to verify that modified components do not break existing test suites.

### Manual Verification
1. **Case Files List (Trang chủ):**
   - Click column headers (Mã VB / MLHS, Trích yếu, Trạng thái, Thời gian, Số tờ).
   - Observe URL change (e.g. `/?sortField=code&sortOrder=asc`).
   - Verify records are sorted properly across pages (server-side).
2. **Child Documents List (Trang chi tiết hồ sơ):**
   - Navigate to `/files/:fileId`.
   - Click document headers (TT, Trích yếu / Tên văn bản, Mã VB, Thời gian, Số tờ, Ghi chú).
   - Verify documents sort properly in ascending/descending order (client-side) and sort icons update correctly.
