# Case Files & Documents Sorting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable server-side sorting on the main Case Files table synchronized via URL parameters, and client-side sorting on the Child Documents table on the dossier details page.

**Architecture:** Modify the backend Elysia API to support dynamic sorting with Prisma; update the React UI (columns, table, and route section) to synchronize TanStack sorting state with URL query parameters using controlled props and `manualSorting: true`; implement a React custom sorting memo hook for the HTML-based Child Documents table.

**Tech Stack:** Elysia, Prisma, React, React Router DOM, TanStack Table, Lucide React, TypeScript.

## Global Constraints

- Touch only the specified files.
- Follow existing codebase patterns (using `DataTableColumnHeader` for sortable TanStack headers).
- Preserve existing styling and truncation logic.

---

### Task 1: Backend API & Client Hook Updates

**Files:**
- Modify: `server/api-routes/files.routes.ts`
- Modify: `lib/hooks/use-files.ts`

**Interfaces:**
- Consumes: Query string parameters `sortField` and `sortOrder`.
- Produces: API response for `/api/files` sorted dynamically using Prisma.

- [ ] **Step 1: Update API query params handling in files.routes.ts**
  Open [files.routes.ts](file:///Users/anhtu/Projects/mono-cm/server/api-routes/files.routes.ts) and locate the `/api/files` GET route. Read `sortField` and `sortOrder` from query params:
  ```typescript
      const sortField = query.sortField || undefined
      const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc'
  ```

- [ ] **Step 2: Build dynamic Prisma orderBy clause in files.routes.ts**
  In [files.routes.ts](file:///Users/anhtu/Projects/mono-cm/server/api-routes/files.routes.ts) under the query parsing block, construct a valid `orderBy` object:
  ```typescript
      const validFields = ['code', 'title', 'type', 'year', 'pageCount', 'status', 'createdAt', 'updatedAt', 'note', 'judgmentNumber', 'judgmentDate']
      let orderBy: Prisma.FileOrderByWithRelationInput = { createdAt: 'desc' }
      if (sortField) {
        if (sortField === 'defendants_civil') {
          orderBy = { defendants: sortOrder }
        } else if (sortField === 'plaintiffs_victims') {
          orderBy = { plaintiffs: sortOrder }
        } else if (validFields.includes(sortField)) {
          orderBy = { [sortField]: sortOrder }
        }
      }
  ```
  Pass `orderBy` to `db.file.findMany` instead of the hardcoded `orderBy: { createdAt: 'desc' }`.

- [ ] **Step 3: Update SearchParams and getFilesQueryString in use-files.ts**
  Open [use-files.ts](file:///Users/anhtu/Projects/mono-cm/lib/hooks/use-files.ts) and modify `SearchParams` interface:
  ```typescript
  export interface SearchParams {
      query?: string
      type?: string
      year?: number
      status?: string
      judgmentNumber?: string
      party?: string
      warehouse?: string
      line?: string
      shelf?: string
      slot?: string
      limit?: number
      offset?: number
      createdById?: string
      sortField?: string
      sortOrder?: 'asc' | 'desc'
  }
  ```
  And update `getFilesQueryString`:
  ```typescript
      if (params.sortField) queryString.set('sortField', params.sortField)
      if (params.sortOrder) queryString.set('sortOrder', params.sortOrder)
  ```

- [ ] **Step 4: Verify backend tests still pass**
  Run: `bun run test:server`
  Expected: All server tests pass successfully.

- [ ] **Step 5: Commit changes**
  Run:
  ```bash
  git add server/api-routes/files.routes.ts lib/hooks/use-files.ts
  git commit -m "feat: add server-side sorting logic to files API and client hook"
  ```

---

### Task 2: Case Files Columns Updates

**Files:**
- Modify: `components/files/columns.tsx`

**Interfaces:**
- Consumes: TanStack Table Column Definitions.
- Produces: Column definitions for `FileDocument` with `DataTableColumnHeader` headers and proper `accessorFn` fields.

- [ ] **Step 1: Import DataTableColumnHeader in columns.tsx**
  Add the following import at the top of [columns.tsx](file:///Users/anhtu/Projects/mono-cm/components/files/columns.tsx):
  ```typescript
  import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
  ```

- [ ] **Step 2: Update sortable columns to use headers**
  For the columns `code`, `title`, `status`, `year`, `pageCount`, `createdBy`, `updatedBy`, `note`, `defendants_civil`, and `plaintiffs_victims`, update the `header` attribute to use `DataTableColumnHeader`.
  Specifically:
  - `code`:
    ```typescript
      accessorKey: "code",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Mã VB / MLHS" />
      ),
    ```
  - `title`:
    ```typescript
      accessorKey: "title",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Trích yếu / Tên văn bản" />
      ),
    ```
  - `status`:
    ```typescript
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Trạng thái" />
      ),
    ```
  - `defendants_civil`:
    ```typescript
      id: "defendants_civil",
      accessorFn: (row) => [
        ...(row.defendants || []),
        ...(row.civilDefendants || [])
      ].join(", "),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Bị cáo / Bị đơn" />
      ),
    ```
  - `plaintiffs_victims`:
    ```typescript
      id: "plaintiffs_victims",
      accessorFn: (row) => (row.plaintiffs || []).join(", "),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Nguyên đơn / Bị hại" />
      ),
    ```
  - `year`:
    ```typescript
      accessorKey: "year",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Thời gian" />
      ),
    ```
  - `pageCount`:
    ```typescript
      accessorKey: "pageCount",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Số tờ" className="justify-end" />
      ),
    ```
  - `createdBy`:
    ```typescript
      id: "createdBy",
      accessorFn: (row) => row.createdBy?.fullName || row.createdBy?.username || "",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Người tạo" />
      ),
    ```
  - `updatedBy`:
    ```typescript
      id: "updatedBy",
      accessorFn: (row) => row.updatedBy?.fullName || row.updatedBy?.username || "",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Người cập nhật" />
      ),
    ```
  - `note`:
    ```typescript
      accessorKey: "note",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Ghi chú" />
      ),
    ```

- [ ] **Step 3: Commit changes**
  Run:
  ```bash
  git add components/files/columns.tsx
  git commit -m "feat: add DataTableColumnHeader and accessorFns to files columns definition"
  ```

---

### Task 3: Controlled Table Component Updates

**Files:**
- Modify: `components/files/file-table.tsx`

**Interfaces:**
- Consumes: `sorting` and `onSortingChange` as props.
- Produces: Controlled table component with `manualSorting: true`.

- [ ] **Step 1: Add controlled props to FileTableProps**
  In [file-table.tsx](file:///Users/anhtu/Projects/mono-cm/components/files/file-table.tsx), add:
  ```typescript
  interface FileTableProps {
    ...
    sorting?: SortingState
    onSortingChange?: (sorting: SortingState) => void
  }
  ```

- [ ] **Step 2: Update local sorting state initialization and handler**
  At the beginning of `FileTable` component, read props:
  ```typescript
  export function FileTable({
    ...
    sorting,
    onSortingChange,
  }: FileTableProps) {
    ...
    const [localSorting, setLocalSorting] = React.useState<SortingState>([])
    const activeSorting = sorting !== undefined ? sorting : localSorting
    const handleSortingChange = onSortingChange !== undefined ? onSortingChange : setLocalSorting
  ```

- [ ] **Step 3: Update TanStack Table instantiation**
  In `useReactTable` config inside `FileTable`:
  - Set `manualSorting: true`
  - Bind `sorting: activeSorting`
  - Connect `onSortingChange` handler:
    ```typescript
    onSortingChange: (updater) => {
      const nextSorting = typeof updater === 'function' ? updater(activeSorting) : updater
      handleSortingChange(nextSorting)
    },
    ```

- [ ] **Step 4: Commit changes**
  Run:
  ```bash
  git add components/files/file-table.tsx
  git commit -m "feat: update FileTable to support manual controlled sorting"
  ```

---

### Task 4: List Section URL Sync Updates

**Files:**
- Modify: `components/files/file-list-section.tsx`

**Interfaces:**
- Consumes: URL `sortField` and `sortOrder` query parameters.
- Produces: State passed to `FileTable` and dynamic refetch via URL change.

- [ ] **Step 1: Read sort fields from URL**
  In [file-list-section.tsx](file:///Users/anhtu/Projects/mono-cm/components/files/file-list-section.tsx), extract query parameters:
  ```typescript
      const sortField = searchParams.get('sortField') || undefined
      const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || undefined
  ```

- [ ] **Step 2: Pass sort params to useFiles hook**
  In the `useFiles` hook call inside `FileListSection`, add `sortField` and `sortOrder`:
  ```typescript
      const { files, total, isLoading, mutate } = useFiles({
          ...
          sortField,
          sortOrder,
      })
  ```

- [ ] **Step 3: Define handleSortingChange callback**
  Convert the search parameters back to a `SortingState` array and define `handleSortingChange`:
  ```typescript
      const activeSorting = React.useMemo<SortingState>(() => {
          if (sortField && sortOrder) {
              return [{ id: sortField, desc: sortOrder === 'desc' }]
          }
          return []
      }, [sortField, sortOrder])

      const handleSortingChange = (sortingState: SortingState) => {
          const params = new URLSearchParams(searchParams.toString())
          if (sortingState.length > 0) {
              params.set('sortField', sortingState[0].id)
              params.set('sortOrder', sortingState[0].desc ? 'desc' : 'asc')
          } else {
              params.delete('sortField')
              params.delete('sortOrder')
          }
          params.set('page', '1') // Reset to page 1 on sorting change
          router.replace(`/?${params.toString()}`)
      }
  ```

- [ ] **Step 4: Pass sorting props to FileTable**
  Inside JSX of `FileListSection`, pass `sorting` and `onSortingChange` to `FileTable`:
  ```tsx
              <FileTable
                  ...
                  sorting={activeSorting}
                  onSortingChange={handleSortingChange}
              />
  ```

- [ ] **Step 5: Commit changes**
  Run:
  ```bash
  git add components/files/file-list-section.tsx
  git commit -m "feat: synchronize file list sorting with URL parameters in FileListSection"
  ```

---

### Task 5: Child Document Table Client-side Sorting

**Files:**
- Modify: `components/files/child-document-workspace.tsx`

**Interfaces:**
- Consumes: `documents: DocumentDto[]` array.
- Produces: Sortable HTML table rows with sorting visual indicators.

- [ ] **Step 1: Import Arrow icons in child-document-workspace.tsx**
  Ensure the following icons are imported from `lucide-react` at the top of the file:
  ```typescript
  import { ArrowDown, ArrowUp, ChevronsUpDown, Pencil } from 'lucide-react';
  ```

- [ ] **Step 2: Add sorting state and useMemo sort logic in ChildDocumentTable**
  Inside `ChildDocumentTable` component:
  ```typescript
      const [sortField, setSortField] = useState<'order' | 'title' | 'code' | 'year' | 'pageCount' | 'note' | null>(null);
      const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

      const sortedDocuments = useMemo(() => {
          if (!sortField) return documents;
          return [...documents].sort((a, b) => {
              let valA: any = a[sortField];
              let valB: any = b[sortField];
              
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

- [ ] **Step 3: Define handleSort and renderSortIcon helpers**
  Inside `ChildDocumentTable`:
  ```typescript
      const handleSort = (field: 'order' | 'title' | 'code' | 'year' | 'pageCount' | 'note') => {
          if (sortField === field) {
              setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
          } else {
              setSortField(field);
              setSortDirection('asc');
          }
      };

      const renderSortIcon = (field: 'order' | 'title' | 'code' | 'year' | 'pageCount' | 'note') => {
          if (sortField !== field) {
              return <ChevronsUpDown className="ml-1 h-3.5 w-3.5 inline text-muted-foreground/50" />;
          }
          return sortDirection === 'asc' 
              ? <ArrowUp className="ml-1 h-3.5 w-3.5 inline text-foreground" />
              : <ArrowDown className="ml-1 h-3.5 w-3.5 inline text-foreground" />;
      };
  ```

- [ ] **Step 4: Update TableHeader to be clickable**
  In the `ChildDocumentTable` JSX, change the `<TableHead>` elements to support clicking:
  ```tsx
                  <TableHeader className="bg-muted/30">
                      <TableRow className="hover:bg-transparent">
                          <TableHead 
                              className="w-[70px] text-xs font-semibold text-foreground py-2.5 cursor-pointer select-none hover:bg-muted/40"
                              onClick={() => handleSort('order')}
                          >
                              TT {renderSortIcon('order')}
                          </TableHead>
                          <TableHead 
                              className="w-[320px] max-w-[320px] text-xs font-semibold text-foreground py-2.5 cursor-pointer select-none hover:bg-muted/40"
                              onClick={() => handleSort('title')}
                          >
                              Trích yếu / Tên văn bản {renderSortIcon('title')}
                          </TableHead>
                          <TableHead 
                              className="text-xs font-semibold text-foreground py-2.5 cursor-pointer select-none hover:bg-muted/40"
                              onClick={() => handleSort('code')}
                          >
                              Mã VB {renderSortIcon('code')}
                          </TableHead>
                          <TableHead 
                              className="text-xs font-semibold text-foreground py-2.5 cursor-pointer select-none hover:bg-muted/40"
                              onClick={() => handleSort('year')}
                          >
                              Thời gian {renderSortIcon('year')}
                          </TableHead>
                          <TableHead 
                              className="text-right text-xs font-semibold text-foreground py-2.5 cursor-pointer select-none hover:bg-muted/40"
                              onClick={() => handleSort('pageCount')}
                          >
                              <span className="flex items-center justify-end">
                                  Số tờ {renderSortIcon('pageCount')}
                              </span>
                          </TableHead>
                          <TableHead 
                              className="text-xs font-semibold text-foreground py-2.5 cursor-pointer select-none hover:bg-muted/40"
                              onClick={() => handleSort('note')}
                          >
                              Ghi chú {renderSortIcon('note')}
                          </TableHead>
                          {canManage && <TableHead className="w-[80px] py-2.5"></TableHead>}
                      </TableRow>
                  </TableHeader>
  ```

- [ ] **Step 5: Map over sortedDocuments instead of documents**
  Change the `TableBody` mapping to:
  ```tsx
                  <TableBody>
                      {sortedDocuments.map((doc, index) => {
                          ...
  ```

- [ ] **Step 6: Verify frontend tests pass**
  Run: `bun run test:frontend`
  Expected: All frontend tests pass successfully.

- [ ] **Step 7: Commit changes**
  Run:
  ```bash
  git add components/files/child-document-workspace.tsx
  git commit -m "feat: implement client-side sorting on ChildDocumentTable"
  ```
