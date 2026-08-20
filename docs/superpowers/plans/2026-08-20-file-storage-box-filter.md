# Implementation Plan: Bộ lọc Hồ sơ theo Hộp lưu trữ (Chưa có hộp / Đã có hộp)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm bộ lọc hồ sơ theo tình trạng hộp lưu trữ (`hasBox`: "Chưa có hộp" hoặc "Đã có hộp") trên cả Backend API và Frontend Toolbar.

**Architecture:** Mở rộng endpoint `GET /api/files` để hỗ trợ lọc theo trường quan hệ `boxId` (`boxId: null` khi `hasBox=false`, `{ not: null }` khi `hasBox=true`). Cập nhật `useFiles` hook và tích hợp bộ lọc `DataTableFacetedFilter` trên `FileTableToolbar`.

**Tech Stack:** Next.js / React 19, TypeScript, Bun Test, Elysia, Prisma ORM, TanStack Table, Tailwind CSS, Radix UI.

## Global Constraints
- Naming: Tham số truy vấn `hasBox` nhận giá trị `'true'`, `'false'`, hoặc `'all'`.
- Giao diện: Nhãn hiển thị là "Hộp lưu trữ", các tùy chọn là "Chưa có hộp" (`value: "false"`) và "Đã có hộp" (`value: "true"`).
- Vị trí: Đặt trên thanh toolbar chính (Row 2), kế tiếp bộ lọc "Trạng thái".

---

### Task 1: Backend Filter Implementation & Contract Tests

**Files:**
- Modify: `server/api-routes/files.routes.ts`
- Test: `server/contracts/files.contract.test.ts`

**Interfaces:**
- Consumes: Query string param `hasBox` from `GET /api/files`
- Produces: Filtered file list and total count matching `boxId: null` or `boxId: { not: null }`

- [ ] **Step 1: Write the failing contract tests for `hasBox` query param**

In `server/contracts/files.contract.test.ts`, add test cases:
```ts
    test('GET /api/files?hasBox=false queries files with boxId null', async () => {
      const app = createTestApp()
      const findManyCalls: unknown[] = []
      const countCalls: unknown[] = []

      setDbForTesting({
        file: {
          findMany: async (args: unknown) => {
            findManyCalls.push(args)
            return []
          },
          count: async (args: unknown) => {
            countCalls.push(args)
            return 0
          },
        },
      })

      const response = await app.handle(jsonRequest('/api/files?hasBox=false', {
        headers: { cookie: await sessionCookie('ADMIN') },
      }))

      expect(response.status).toBe(200)
      expect(findManyCalls).toHaveLength(1)
      expect(findManyCalls[0]).toMatchObject({
        where: {
          AND: expect.arrayContaining([{ boxId: null }]),
        },
      })
    })

    test('GET /api/files?hasBox=true queries files with boxId not null', async () => {
      const app = createTestApp()
      const findManyCalls: unknown[] = []

      setDbForTesting({
        file: {
          findMany: async (args: unknown) => {
            findManyCalls.push(args)
            return []
          },
          count: async () => 0,
        },
      })

      const response = await app.handle(jsonRequest('/api/files?hasBox=true', {
        headers: { cookie: await sessionCookie('ADMIN') },
      }))

      expect(response.status).toBe(200)
      expect(findManyCalls).toHaveLength(1)
      expect(findManyCalls[0]).toMatchObject({
        where: {
          AND: expect.arrayContaining([{ boxId: { not: null } }]),
        },
      })
    })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test server/contracts/files.contract.test.ts`
Expected: FAIL (where condition does not contain `{ boxId: null }`)

- [ ] **Step 3: Update `server/api-routes/files.routes.ts` to support `hasBox`**

Extract `const hasBox = query.hasBox || undefined` and add condition to Prisma `where.AND`:
```ts
        hasBox === 'false' ? { boxId: null } : {},
        hasBox === 'true' ? { boxId: { not: null } } : {},
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test server/contracts/files.contract.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/api-routes/files.routes.ts server/contracts/files.contract.test.ts
git commit -m "feat(api): support hasBox filter in GET /api/files"
```

---

### Task 2: Client Hooks & Toolbar Faceted Filter UI

**Files:**
- Modify: `lib/hooks/use-files.ts`
- Modify: `components/files/file-list-section.tsx`
- Modify: `components/files/file-table-toolbar.tsx`

**Interfaces:**
- Consumes: URL query param `hasBox`
- Produces: `DataTableFacetedFilter` for storage box status, synchronization with URL search params and reset handler

- [ ] **Step 1: Update `lib/hooks/use-files.ts`**

Add `hasBox?: string` to `SearchParams` interface and append to `getFilesQueryString`:
```ts
export interface SearchParams {
    query?: string
    type?: string
    year?: number
    status?: string
    hasBox?: string
    // ...
}

export function getFilesQueryString(params: SearchParams) {
    // ...
    if (params.hasBox && params.hasBox !== 'all') queryString.set('hasBox', params.hasBox)
    // ...
}
```

- [ ] **Step 2: Update `components/files/file-list-section.tsx`**

Read `hasBox` from `searchParams` and pass to `useFiles`:
```ts
const hasBox = searchParams.get('hasBox') || undefined
// ...
const { files, total, isLoading, mutate } = useFiles({
    query: q,
    type,
    status,
    hasBox,
    // ...
})
```

- [ ] **Step 3: Update `components/files/file-table-toolbar.tsx`**

1. Define `storageBoxStatusOptions`:
```ts
const storageBoxStatusOptions = [
  { value: "false", label: "Chưa có hộp" },
  { value: "true", label: "Đã có hộp" },
];
```

2. Add `"hasBox"` to `isFiltered`:
```ts
  const isFiltered = [
    "q",
    "type",
    "status",
    "hasBox",
    ...advancedFilterKeys,
    "createdById",
  ].some((key) => !!searchParams.get(key)) || table.getState().columnFilters.length > 0;
```

3. Add `hasBox` to `activeFilters`:
```ts
searchParams.get("hasBox") ? {
  key: "hasBox",
  label: "Hộp lưu trữ",
  value: storageBoxStatusOptions.find((o) => o.value === searchParams.get("hasBox"))?.label || searchParams.get("hasBox")!
} : null,
```

4. Add `DataTableFacetedFilter` in Row 2:
```tsx
        <DataTableFacetedFilter
          title="Hộp lưu trữ"
          options={storageBoxStatusOptions}
          value={searchParams.get("hasBox") ? [searchParams.get("hasBox")!] : []}
          onFilter={(values) => setUrlParam("hasBox", values?.[0] || "all")}
        />
```

5. Add `"hasBox"` to reset keys in `handleReset`:
```ts
    [
      "q",
      "type",
      "status",
      "hasBox",
      "year",
      "judgmentNumber",
      "party",
      "warehouse",
      "line",
      "shelf",
      "slot",
      "createdById",
    ].forEach((key) => params.delete(key));
```

- [ ] **Step 4: Verify with tests and build**

Run: `bun test`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/hooks/use-files.ts components/files/file-list-section.tsx components/files/file-table-toolbar.tsx
git commit -m "feat(ui): add storage box faceted filter to files table toolbar"
```
