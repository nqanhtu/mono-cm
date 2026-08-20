# Case Statistics Matrix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm tính năng "Thống kê hồ sơ án" vào phân hệ Báo cáo & Thống kê (`/reports`) cho phép thống kê số lượng hồ sơ án dạng ma trận đa chiều (Loại án x Năm), biểu đồ cột trực quan, tính năng drill-down xem danh sách hồ sơ khi click vào ô số liệu, và xuất file Excel ma trận.

**Architecture:** Mở rộng backend Elysia `reportRoutes` với endpoint `/api/reports/cases-matrix`, `/api/reports/cases-matrix/drilldown`, và hỗ trợ xuất Excel `type=case-matrix`. Phía frontend sử dụng TanStack Query (`useCaseStatsMatrix`, `useCaseDrilldown`), Recharts cho biểu đồ cột đa loại án, giao diện ma trận cố định cột với khả năng tương tác drill-down dialog và xuất báo cáo.

**Tech Stack:** Bun, Elysia, Prisma ORM, React 19, Tailwind CSS, TanStack React Query, Recharts, Lucide Icons, xlsx.

## Global Constraints
- Preserve existing report features (Borrows transaction dashboard, User contributions).
- Follow permissions convention using `sessionOrDenied` with `viewReports`.
- Strictly adhere to Vietnam Court terminology (Án Dân sự sơ thẩm, Án Hình sự sơ thẩm, Hôn nhân gia đình, Hành chính, Lao động, KDTM, Phúc thẩm...).
- Ensure responsive UI with sticky column for matrix view on smaller viewports.

---

### Task 1: Backend API `GET /api/reports/cases-matrix` & Contract Test

**Files:**
- Create: `server/contracts/cases-reports.contract.test.ts`
- Modify: `server/api-routes/reports.routes.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface CaseMatrixItem {
    type: string
    countsByYear: Record<number, number>
    total: number
  }
  export interface CaseMatrixResponse {
    years: number[]
    types: string[]
    matrix: CaseMatrixItem[]
    yearTotals: Record<number, number>
    grandTotal: number
    topType: { type: string; count: number } | null
    peakYear: { year: number; count: number } | null
    totalFiles: number
  }
  ```

- [ ] **Step 1: Write failing contract test for `GET /api/reports/cases-matrix`**

```ts
// server/contracts/cases-reports.contract.test.ts
import { describe, expect, test } from 'bun:test'
import { createTestApp, jsonRequest, sessionCookie, setDbForTesting } from './helpers'

describe('cases reports contract', () => {
  test('GET /api/reports/cases-matrix aggregates files by type and year correctly', async () => {
    const app = createTestApp()
    const mockFiles = [
      { type: 'Dân sự sơ thẩm', year: 2014 },
      { type: 'Dân sự sơ thẩm', year: 2014 },
      { type: 'Dân sự sơ thẩm', year: 2015 },
      { type: 'Hình sự sơ thẩm', year: 2014 },
      { type: 'Hình sự sơ thẩm', year: 2016 },
    ]

    setDbForTesting({
      file: {
        findMany: async () => mockFiles,
      },
    })

    const response = await app.handle(jsonRequest('/api/reports/cases-matrix?fromYear=2014&toYear=2016', {
      headers: { cookie: await sessionCookie('VIEWER') },
    }))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.years).toEqual([2014, 2015, 2016])
    expect(body.types).toContain('Dân sự sơ thẩm')
    expect(body.types).toContain('Hình sự sơ thẩm')
    expect(body.grandTotal).toBe(5)
    expect(body.yearTotals[2014]).toBe(3)
    expect(body.yearTotals[2015]).toBe(1)
    expect(body.yearTotals[2016]).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test server/contracts/cases-reports.contract.test.ts`
Expected: FAIL (404 or route not defined)

- [ ] **Step 3: Implement `GET /api/reports/cases-matrix` route in `server/api-routes/reports.routes.ts`**

Implement aggregation query handling `fromYear`, `toYear`, and computing matrix, yearTotals, topType, peakYear, and grandTotal.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test server/contracts/cases-reports.contract.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/contracts/cases-reports.contract.test.ts server/api-routes/reports.routes.ts
git commit -m "feat(reports): add cases matrix statistics API endpoint"
```

---

### Task 2: Backend Drill-down & Excel Export for Case Matrix

**Files:**
- Modify: `server/contracts/cases-reports.contract.test.ts`
- Modify: `server/api-routes/reports.routes.ts`

**Interfaces:**
- Produces:
  - `GET /api/reports/cases-matrix/drilldown?year=2014&type=...` returning list of `File` items with `box`.
  - `GET /api/reports/export?type=case-matrix&format=xlsx` returning multi-column Excel matrix.

- [ ] **Step 1: Write failing contract test for drilldown and excel export**

```ts
test('GET /api/reports/cases-matrix/drilldown returns matching case files', async () => {
  const app = createTestApp()
  const mockFiles = [
    { id: 'f-1', code: '01/2014/DS-ST', title: 'Tranh chấp đất đai', type: 'Dân sự sơ thẩm', year: 2014, status: 'IN_STOCK', box: { code: 'HOP-01' } },
  ]
  setDbForTesting({
    file: {
      findMany: async () => mockFiles,
    },
  })

  const response = await app.handle(jsonRequest('/api/reports/cases-matrix/drilldown?year=2014&type=Dân%20sự%20sơ%20thẩm', {
    headers: { cookie: await sessionCookie('VIEWER') },
  }))

  expect(response.status).toBe(200)
  const body = await response.json()
  expect(body.files).toHaveLength(1)
  expect(body.files[0].code).toBe('01/2014/DS-ST')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test server/contracts/cases-reports.contract.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement drilldown and case-matrix Excel export**

In `server/api-routes/reports.routes.ts`:
- Add `.get('/api/reports/cases-matrix/drilldown', ...)`
- Add `case-matrix` export logic in `/api/reports/export` to generate matrix rows (`{ 'Loại hồ sơ án': type, '2014': 45, ..., 'Tổng cộng': 109 }`).

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test server/contracts/cases-reports.contract.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/contracts/cases-reports.contract.test.ts server/api-routes/reports.routes.ts
git commit -m "feat(reports): add case matrix drilldown and excel export handler"
```

---

### Task 3: Client Types, Query Keys & React Query Hooks

**Files:**
- Modify: `lib/api/types.ts`
- Modify: `src/lib/query-keys.ts`
- Modify: `lib/hooks/use-reports.ts`

**Interfaces:**
- Produces:
  - `CaseMatrixResponse`, `CaseMatrixItem`, `CaseDrilldownResponse` types
  - `queryKeys.reports.caseMatrix(params)`
  - `useCaseMatrix({ fromYear, toYear })`
  - `useCaseDrilldown({ year, type, enabled })`

- [ ] **Step 1: Update `lib/api/types.ts` with case matrix response interfaces**
- [ ] **Step 2: Update `src/lib/query-keys.ts` with `reports.caseMatrix` and `reports.caseDrilldown`**
- [ ] **Step 3: Add `useCaseMatrix` and `useCaseDrilldown` in `lib/hooks/use-reports.ts`**
- [ ] **Step 4: Run typecheck / test**

Run: `bun test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/api/types.ts src/lib/query-keys.ts lib/hooks/use-reports.ts
git commit -m "feat(reports): add case matrix react query hooks and api types"
```

---

### Task 4: Drill-Down Dialog Component

**Files:**
- Create: `components/reports/case-drilldown-dialog.tsx`

**Interfaces:**
- Consumes: `useCaseDrilldown` from `@/lib/hooks/use-reports`
- Props: `open: boolean`, `onOpenChange: (open: boolean) => void`, `year: number | null`, `type: string | null`

- [ ] **Step 1: Create `components/reports/case-drilldown-dialog.tsx`**
  - Renders a clean Dialog showing title: "Danh sách hồ sơ: [Loại án] - Năm [Năm]".
  - Table displaying: Mã hồ sơ, Tiêu đề, Ngày thụ lý/xét xử, Trạng thái (StatusBadge), Hộp lưu trữ.
  - Link/Button to view detail or navigate to file jacket.

- [ ] **Step 2: Commit**

```bash
git add components/reports/case-drilldown-dialog.tsx
git commit -m "feat(reports): add case drilldown modal component"
```

---

### Task 5: Case Statistics Matrix Report View Component

**Files:**
- Create: `components/reports/case-stats-report.tsx`

**Interfaces:**
- Consumes: `useCaseMatrix` from `@/lib/hooks/use-reports`, Recharts components, `CaseDrilldownDialog`.
- Renders:
  1. Year range selector (From Year, To Year dropdowns, Quick presets: Tất cả, 5 năm, 10 năm).
  2. 4 KPI cards (Tổng số án, Loại án phổ biến, Năm cao điểm, Tổng số tập/trang).
  3. Recharts Bar Chart (grouped/stacked by case type across years).
  4. Interactive Pivot Matrix Table with sticky columns and clickable numbers.
  5. Export Excel action button for the matrix.

- [ ] **Step 1: Create `components/reports/case-stats-report.tsx`**
- [ ] **Step 2: Connect with `CaseDrilldownDialog` on cell click**
- [ ] **Step 3: Commit**

```bash
git add components/reports/case-stats-report.tsx
git commit -m "feat(reports): add case stats matrix dashboard component"
```

---

### Task 6: Integrate Case Stats Tab into Reports Page & Verification

**Files:**
- Modify: `src/routes/reports/reports-page.tsx`

- [ ] **Step 1: Add "Thống kê hồ sơ án" tab to `src/routes/reports/reports-page.tsx`**
  - Tab value: `case-stats`
  - Render `CaseStatsReport` inside TabsContent.
- [ ] **Step 2: Run full test suite and build verification**

Run: `bun test`
Run: `bun run build` (or vite build check)

- [ ] **Step 3: Commit**

```bash
git add src/routes/reports/reports-page.tsx
git commit -m "feat(reports): integrate case statistics tab into reports page"
```
