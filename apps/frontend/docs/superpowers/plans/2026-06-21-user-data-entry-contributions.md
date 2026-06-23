# Thống kê đóng góp nhập liệu theo ngày (Daily Data Entry Contributions) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a daily tracking dashboard tab on the Reports page showing the count of records (Files) and sub-records (Documents) created by day for a selected user, with appropriate authorization controls (admins can select anyone, others are locked to themselves) and a Recharts bar chart showing trends.

**Architecture:** Add `createdAt`/`updatedAt` fields to the `Document` DB schema, run a Prisma migration, backfill existing document timestamps using the parent File's `updatedAt`, add a backend endpoint to aggregate and merge File and Document creation events by user and day in memory, and implement a responsive frontend UI tab on the Reports page.

**Tech Stack:** React 19, Vite, Tailwind CSS v4, Lucide React icons, Recharts, Bun + Elysia backend, Prisma client, PostgreSQL database.

## Global Constraints
- Write code in Vietnamese language for user-facing UI labels, headers, and tooltips.
- Backend code must run under Bun and Elysia framework.
- Queries must enforce correct security access: Viewer/Coordinator/Basic Viewer roles can only access their own user statistics.

---

### Task 1: Database Schema Modification & Migration

**Files:**
- Modify: `court-management-api/prisma/schema.prisma`
- Create: `court-management-api/prisma/migrations/<timestamp>_add_document_timestamps/migration.sql` (generated and edited)

**Interfaces:**
- Consumes: Existing DB models
- Produces: Updated database schema where the `Document` model has `createdAt` and `updatedAt` timestamps.

- [ ] **Step 1: Modify schema.prisma**
  Open `court-management-api/prisma/schema.prisma` and add `createdAt` and `updatedAt` fields to the `Document` model:
  ```prisma
  model Document {
    id        String  @id @default(uuid(7))
    // ... existing fields ...
    fileId    String
    file      File    @relation(fields: [fileId], references: [id], onDelete: Cascade)

    createdById String?
    createdBy   User?   @relation("DocumentCreator", fields: [createdById], references: [id])
    updatedById String?
    updatedBy   User?   @relation("DocumentUpdater", fields: [updatedById], references: [id])

    // Add these fields
    createdAt   DateTime @default(now())
    updatedAt   DateTime @updatedAt
  }
  ```

- [ ] **Step 2: Generate DB Migration file without executing it**
  Run command in workspace root (or parent directory `/Users/anhtu/Projects/court-management-api`):
  ```bash
  cd ../court-management-api && npx prisma migrate dev --name add_document_timestamps --create-only
  ```
  Expected output: A new folder under `prisma/migrations/` is created containing `migration.sql`.

- [ ] **Step 3: Edit migration.sql to add custom backfilling script**
  Find the newly generated `migration.sql` file (under `prisma/migrations/<timestamp>_add_document_timestamps/migration.sql`) and edit it to update older `Document` records' `createdAt` and `updatedAt` from their parent `File`'s `updatedAt` before making fields non-nullable. Replace the contents of that file with:
  ```sql
  -- AlterTable: Add columns as nullable first
  ALTER TABLE "Document" ADD COLUMN "createdAt" TIMESTAMP(3);
  ALTER TABLE "Document" ADD COLUMN "updatedAt" TIMESTAMP(3);

  -- Backfill older records using parent File's updatedAt
  UPDATE "Document" d
  SET "createdAt" = f."updatedAt", "updatedAt" = f."updatedAt"
  FROM "File" f
  WHERE d."fileId" = f.id;

  -- If any documents are left without a date (e.g. orphaned), fallback to current_timestamp
  UPDATE "Document"
  SET "createdAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
  WHERE "createdAt" IS NULL;

  -- Set defaults and add NOT NULL constraints
  ALTER TABLE "Document" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;
  ALTER TABLE "Document" ALTER COLUMN "createdAt" SET NOT NULL;
  ALTER TABLE "Document" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
  ALTER TABLE "Document" ALTER COLUMN "updatedAt" SET NOT NULL;
  ```

- [ ] **Step 4: Execute the migration and regenerate Prisma client**
  Run command in `/Users/anhtu/Projects/court-management-api`:
  ```bash
  cd ../court-management-api && npx prisma migrate dev
  ```
  Expected output: The migration runs successfully and outputs "The database is now in sync with your schema". Prisma Client is generated.

- [ ] **Step 5: Verify migration schema**
  Verify by checking the database schema or running tests.
  Run:
  ```bash
  cd ../court-management-api && bun test src/contracts/documents.contract.test.ts
  ```
  Expected: All tests pass.

- [ ] **Step 6: Commit**
  Run:
  ```bash
  git add ../court-management-api/prisma/schema.prisma ../court-management-api/prisma/migrations/
  git commit -m "db: add createdAt and updatedAt to Document and backfill from File"
  ```

---

### Task 2: Backend API Route implementation

**Files:**
- Modify: `court-management-api/src/api-routes/reports.routes.ts`
- Create: `court-management-api/src/contracts/contributions-reports.contract.test.ts`

**Interfaces:**
- Consumes: Database schema from Task 1
- Produces: `GET /api/reports/contributions` API endpoint returning daily counts.

- [ ] **Step 1: Write a contract test for the new endpoint**
  Create `court-management-api/src/contracts/contributions-reports.contract.test.ts` to test authorization rules and data merging logic.
  ```typescript
  import { describe, expect, test } from 'bun:test'
  import { createTestApp, jsonRequest, sessionCookie, setDbForTesting } from './helpers'

  describe('contributions reports contract', () => {
      test('GET /api/reports/contributions - regular user cannot query another user', async () => {
        const app = createTestApp()
        const response = await app.handle(jsonRequest('/api/reports/contributions?userId=some-other-user-uuid', {
          headers: { cookie: await sessionCookie('VIEWER', 'my-user-uuid') },
        }))
        expect(response.status).toBe(200)
        const body = await response.json()
        expect(body.userId).toBe('my-user-uuid') // should override target userId to self
      })

      test('GET /api/reports/contributions - admin can query another user and data merges correctly', async () => {
        const app = createTestApp()
        const mockFilesGroup = [
          { createdAt: new Date('2026-06-20T10:00:00Z'), _count: { id: 2 } },
          { createdAt: new Date('2026-06-21T12:00:00Z'), _count: { id: 1 } },
        ]
        const mockDocsGroup = [
          { createdAt: new Date('2026-06-21T14:00:00Z'), _count: { id: 5 } },
        ]

        setDbForTesting({
          file: {
            groupBy: async () => mockFilesGroup,
          },
          document: {
            groupBy: async () => mockDocsGroup,
          },
          user: {
            findUnique: async () => ({ id: 'target-user', fullName: 'Target User' }),
          }
        })

        const response = await app.handle(jsonRequest('/api/reports/contributions?userId=target-user&from=2026-06-20&to=2026-06-21', {
          headers: { cookie: await sessionCookie('ADMIN') },
        }))

        expect(response.status).toBe(200)
        const body = await response.json()
        expect(body.userId).toBe('target-user')
        expect(body.contributions).toHaveLength(2)
        expect(body.contributions[0]).toEqual({ date: '2026-06-20', files: 2, documents: 0, total: 2 })
        expect(body.contributions[1]).toEqual({ date: '2026-06-21', files: 1, documents: 5, total: 6 })
      })
  })
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run:
  ```bash
  cd ../court-management-api && bun test src/contracts/contributions-reports.contract.test.ts
  ```
  Expected: Fail (since route doesn't exist yet).

- [ ] **Step 3: Implement endpoint in reports.routes.ts**
  Open `court-management-api/src/api-routes/reports.routes.ts`. Add the route handler logic to the `reportRoutes` instance:
  ```typescript
  // Add this inside reportRoutes chain:
  .get('/api/reports/contributions', async ({ request, set, query }) => {
    try {
      const { session, denied } = await sessionOrDenied({ request, set }, 'viewReports')
      if (denied) return denied

      let targetUserId = session!.id
      if (['SUPER_ADMIN', 'ADMIN'].includes(session!.role) && query.userId) {
        targetUserId = String(query.userId)
      }

      const fromStr = query.from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const toStr = query.to || new Date().toISOString().split('T')[0]

      const fromDate = new Date(`${fromStr}T00:00:00.000Z`)
      const toDate = new Date(`${toStr}T23:59:59.999Z`)

      // Get target user details
      const user = await db.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, fullName: true, username: true }
      })
      if (!user) {
        set.status = 404
        return { error: 'Không tìm thấy người dùng' }
      }

      // Group Files created by user by day
      const filesGroup = await db.file.groupBy({
        by: ['createdAt'],
        where: {
          createdById: targetUserId,
          createdAt: { gte: fromDate, lte: toDate },
        },
        _count: { id: true },
      })

      // Group Documents created by user by day
      const docsGroup = await db.document.groupBy({
        by: ['createdAt'],
        where: {
          createdById: targetUserId,
          createdAt: { gte: fromDate, lte: toDate },
        },
        _count: { id: true },
      })

      // Aggregate counts by local YYYY-MM-DD key
      const dailyMap: Record<string, { files: number; documents: number }> = {}

      filesGroup.forEach((group) => {
        const dateKey = new Date(group.createdAt).toISOString().split('T')[0]
        if (!dailyMap[dateKey]) dailyMap[dateKey] = { files: 0, documents: 0 }
        dailyMap[dateKey].files += group._count.id
      })

      docsGroup.forEach((group) => {
        const dateKey = new Date(group.createdAt).toISOString().split('T')[0]
        if (!dailyMap[dateKey]) dailyMap[dateKey] = { files: 0, documents: 0 }
        dailyMap[dateKey].documents += group._count.id
      })

      // Generate a continuous list of dates from start to end
      const contributions: { date: string; files: number; documents: number; total: number }[] = []
      const current = new Date(fromDate)
      const end = new Date(toDate)

      while (current <= end) {
        const dateKey = current.toISOString().split('T')[0]
        const counts = dailyMap[dateKey] || { files: 0, documents: 0 }
        contributions.push({
          date: dateKey,
          files: counts.files,
          documents: counts.documents,
          total: counts.files + counts.documents,
        })
        current.setDate(current.getDate() + 1)
      }

      return {
        userId: user.id,
        fullName: user.fullName,
        username: user.username,
        contributions,
      }
    } catch (error) {
      console.error('Error fetching contributions stats:', error)
      set.status = 500
      return { error: 'Internal Server Error' }
    }
  })
  ```

- [ ] **Step 4: Run the test again to verify it passes**
  Run:
  ```bash
  cd ../court-management-api && bun test src/contracts/contributions-reports.contract.test.ts
  ```
  Expected: PASS.

- [ ] **Step 5: Commit changes**
  Run:
  ```bash
  git add ../court-management-api/src/api-routes/reports.routes.ts ../court-management-api/src/contracts/contributions-reports.contract.test.ts
  git commit -m "feat: implement GET /api/reports/contributions backend API and tests"
  ```

---

### Task 3: Frontend API Client & Hook

**Files:**
- Modify: `lib/api/types.ts`
- Modify: `src/lib/query-keys.ts`
- Modify: `lib/hooks/use-reports.ts`

**Interfaces:**
- Consumes: Backend API
- Produces: `useUserContributions` react hook and TypeScript types.

- [ ] **Step 1: Add types to lib/api/types.ts**
  Open `lib/api/types.ts` and add these types at the end of the file:
  ```typescript
  export type DailyContribution = {
    date: string
    files: number
    documents: number
    total: number
  }

  export type UserContributionsResponse = {
    userId: string
    fullName: string
    username: string
    contributions: DailyContribution[]
  }
  ```

- [ ] **Step 2: Add query key to src/lib/query-keys.ts**
  Open `src/lib/query-keys.ts` and update the `reports` section:
  ```typescript
  // Modify queryKeys.reports object:
  reports: {
    stats: ['reports', 'stats'] as const,
    files: (params?: string) => ['reports', 'files', params || ''] as const,
    contributions: (params: { userId?: string; from?: string; to?: string }) => 
      ['reports', 'contributions', params.userId || '', params.from || '', params.to || ''] as const,
  },
  ```

- [ ] **Step 3: Implement useUserContributions hook**
  Open `lib/hooks/use-reports.ts` and add:
  ```typescript
  import type { UserContributionsResponse } from '@/lib/api/types'

  export function useUserContributions(params: { userId?: string; from?: string; to?: string }) {
    // build query string
    const searchParams = new URLSearchParams()
    if (params.userId) searchParams.append('userId', params.userId)
    if (params.from) searchParams.append('from', params.from)
    if (params.to) searchParams.append('to', params.to)

    const query = useQuery({
      queryKey: queryKeys.reports.contributions(params),
      queryFn: () => apiJson<UserContributionsResponse>(`/api/reports/contributions?${searchParams.toString()}`),
    })

    return {
      data: query.data,
      isLoading: query.isLoading,
      isError: query.error,
      refetch: query.refetch,
    }
  }
  ```

- [ ] **Step 4: Commit**
  Run:
  ```bash
  git add lib/api/types.ts src/lib/query-keys.ts lib/hooks/use-reports.ts
  git commit -m "feat: add useUserContributions frontend query hook"
  ```

---

### Task 4: Frontend UI Component & Tab Integration

**Files:**
- Create: `components/reports/user-contributions-report.tsx`
- Modify: `components/reports/report-dashboard.tsx`
- Modify: `src/routes/reports/reports-page.tsx`

**Interfaces:**
- Consumes: `useUserContributions` and `useUsers` hooks.
- Produces: The "Thống kê đóng góp" tab view on the Reports page.

- [ ] **Step 1: Create user-contributions-report.tsx**
  Create `/Users/anhtu/Projects/court-management/components/reports/user-contributions-report.tsx` with selectors, summary cards, Recharts chart, and detailed list:
  ```tsx
  'use client'

  import { useState, useMemo } from 'react'
  import { useSession } from '@/lib/hooks/use-auth'
  import { useUsers } from '@/lib/hooks/use-users'
  import { useUserContributions } from '@/lib/hooks/use-reports'
  import { format, subDays, startOfMonth } from 'date-fns'
  import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
  import { Card, CardContent } from '@/components/ui/card'
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
  import { CalendarRange, Loader2, Award, FileText, ClipboardList } from 'lucide-react'

  export function UserContributionsReport() {
    const { session } = useSession()
    const { users } = useUsers()
    
    const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(session?.role || '')

    // State filters
    const [selectedUserId, setSelectedUserId] = useState<string>(session?.id || '')
    const [dateRangePreset, setDateRangePreset] = useState<'7' | '30' | 'month'>('30')

    const dateFilters = useMemo(() => {
      const to = new Date()
      let from = subDays(to, 30)

      if (dateRangePreset === '7') {
        from = subDays(to, 7)
      } else if (dateRangePreset === 'month') {
        from = startOfMonth(to)
      }

      return {
        from: format(from, 'yyyy-MM-dd'),
        to: format(to, 'yyyy-MM-dd'),
      }
    }, [dateRangePreset])

    const { data, isLoading } = useUserContributions({
      userId: selectedUserId,
      from: dateFilters.from,
      to: dateFilters.to,
    })

    const contributionsList = data?.contributions || []

    // Totals calculations
    const stats = useMemo(() => {
      let totalFiles = 0
      let totalDocs = 0
      contributionsList.forEach((c) => {
        totalFiles += c.files
        totalDocs += c.documents
      })
      const totalDays = contributionsList.filter(c => c.total > 0).length
      const avgDaily = totalDays > 0 ? Math.round((totalFiles + totalDocs) / totalDays) : 0

      return { totalFiles, totalDocs, total: totalFiles + totalDocs, avgDaily }
    }, [contributionsList])

    // Format chart date
    const chartData = useMemo(() => {
      return contributionsList.map((c) => ({
        ...c,
        formattedDate: format(new Date(c.date), 'dd/MM'),
      }))
    }, [contributionsList])

    // Filter active users to list
    const activeUsers = useMemo(() => users.filter(u => u.status), [users])

    return (
      <div className="flex flex-col gap-4">
        {/* Filters Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between border-b pb-3 mb-1">
          <div className="flex items-center gap-2">
            <CalendarRange className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground">Bộ lọc thống kê đóng đóng góp</span>
          </div>

          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            {isAdmin && (
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="w-[200px] h-9">
                  <SelectValue placeholder="Chọn cán bộ" />
                </SelectTrigger>
                <SelectContent>
                  {activeUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.fullName} ({user.username})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            <div className="flex border rounded-md overflow-hidden h-9">
              {[
                { label: '7 ngày qua', value: '7' },
                { label: '30 ngày qua', value: '30' },
                { label: 'Tháng này', value: 'month' },
              ].map((preset) => (
                <button
                  key={preset.value}
                  className={`px-3 text-xs font-medium border-r last:border-r-0 ${
                    dateRangePreset === preset.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background hover:bg-muted'
                  }`}
                  onClick={() => setDateRangePreset(preset.value as any)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        )}

        {!isLoading && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Tổng hồ sơ đã tạo", value: stats.totalFiles, icon: FileText, className: "border-blue-200/70 bg-blue-50/70 text-blue-900 dark:border-blue-900/70 dark:bg-blue-950/20 dark:text-blue-100" },
                { label: "Tổng văn bản đã tạo", value: stats.totalDocs, icon: ClipboardList, className: "border-emerald-200/70 bg-emerald-50/70 text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-100" },
                { label: "Tổng lượt đóng góp", value: stats.total, icon: Award, className: "border-amber-200/70 bg-amber-50/70 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-100" },
                { label: "Trung bình ngày hoạt động", value: stats.avgDaily, icon: CalendarRange, className: "border-purple-200/70 bg-purple-50/70 text-purple-900 dark:border-purple-900/70 dark:bg-purple-950/20 dark:text-purple-100" },
              ].map((stat, i) => (
                <div key={i} className={`flex min-h-12 items-center gap-3 rounded-lg border px-3 py-2 ${stat.className}`}>
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-white/70 shadow-xs dark:bg-white/10">
                    <stat.icon className="size-3.5" />
                  </span>
                  <div>
                    <div className="text-[10px] font-semibold">{stat.label}</div>
                    <p className="mt-0.5 text-lg font-semibold leading-none tabular-nums">{stat.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Recharts Bar Chart */}
            <Card className="p-4 border rounded-lg bg-card text-card-foreground">
              <h3 className="text-sm font-semibold mb-4">Biểu đồ đóng góp nhập dữ liệu</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <XAxis dataKey="formattedDate" fontSize={11} stroke="#888888" tickLine={false} />
                    <YAxis fontSize={11} stroke="#888888" tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                    <Bar name="Hồ sơ mới" dataKey="files" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                    <Bar name="Văn bản mới" dataKey="documents" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Detailed Table */}
            <Card className="border rounded-lg bg-card">
              <div className="px-4 py-3 border-b">
                <h3 className="text-sm font-semibold">Bảng thống kê chi tiết</h3>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/3">Ngày</TableHead>
                    <TableHead className="text-center">Số hồ sơ</TableHead>
                    <TableHead className="text-center">Số văn bản</TableHead>
                    <TableHead className="text-right">Tổng cộng</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contributionsList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground text-sm">
                        Không có dữ liệu trong khoảng thời gian này.
                      </TableCell>
                    </TableRow>
                  ) : (
                    [...contributionsList].reverse().map((row) => (
                      <TableRow key={row.date} className={row.total > 0 ? '' : 'opacity-60'}>
                        <TableCell className="font-medium">
                          {format(new Date(row.date), 'dd/MM/yyyy')}
                        </TableCell>
                        <TableCell className="text-center tabular-nums">{row.files}</TableCell>
                        <TableCell className="text-center tabular-nums">{row.documents}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{row.total}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </>
        )}
      </div>
    )
  }
  ```

- [ ] **Step 2: Modify reports-page.tsx to support tab routing**
  Open `src/routes/reports/reports-page.tsx`. Implement tab controls using Shadcn `Tabs` to switch between `ReportDashboard` (recent borrows) and the new `UserContributionsReport` component.
  ```tsx
  // Modify src/routes/reports/reports-page.tsx:
  import { useState } from "react";
  import { Download, Loader2 } from "lucide-react";
  import { Button } from "@/components/ui/button";
  import { ReportDashboard } from "@/components/reports/report-dashboard";
  import { UserContributionsReport } from "@/components/reports/user-contributions-report";
  import { apiFetch } from "@/lib/api/client";
  import { toast } from "sonner";
  import { PrintActionButton } from "@/components/common/print-action-button";
  import { DataPageShell } from "@/components/common/data-page-shell";
  import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

  export default function Reports() {
    const [isExporting, setIsExporting] = useState(false);
    const [activeTab, setActiveTab] = useState<string>("borrows");

    const exportReport = async (format: "xlsx" | "csv") => {
      setIsExporting(true);
      try {
        const response = await apiFetch(`/api/reports/export?type=files&format=${format}`);
        if (!response.ok) throw new Error("Không thể kết xuất báo cáo");
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = getDownloadFilename(response.headers.get("content-disposition"), `files-report.${format}`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        toast.success("Đã kết xuất báo cáo");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Lỗi kết nối");
      } finally {
        setIsExporting(false);
      }
    };

    return (
      <DataPageShell
        toolbar={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between w-full">
            <div>
              <h1 className="text-xl font-bold text-foreground">Báo cáo & Thống kê</h1>
              <p className="text-xs text-muted-foreground">Theo dõi hiệu suất hoạt động kho hồ sơ.</p>
            </div>
            {activeTab === "borrows" && (
              <div className="flex items-center gap-2">
                <PrintActionButton onClick={() => window.print()} />
                <Button variant="outline" className="h-9" onClick={() => exportReport("csv")} disabled={isExporting}>
                  {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  CSV
                </Button>
                <Button variant="outline" className="h-9" onClick={() => exportReport("xlsx")} disabled={isExporting}>
                  {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Excel
                </Button>
              </div>
            )}
          </div>
        }
      >
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col gap-4">
          <TabsList className="grid grid-cols-2 max-w-[400px]">
            <TabsTrigger value="borrows">Giao dịch Mượn trả</TabsTrigger>
            <TabsTrigger value="contributions">Thống kê đóng góp</TabsTrigger>
          </TabsList>
          <TabsContent value="borrows" className="mt-0">
            <ReportDashboard />
          </TabsContent>
          <TabsContent value="contributions" className="mt-0">
            <UserContributionsReport />
          </TabsContent>
        </Tabs>
      </DataPageShell>
    );
  }

  function getDownloadFilename(contentDisposition: string | null, fallback: string) {
    if (!contentDisposition) return fallback;
    const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
    return filenameMatch?.[1] || fallback;
  }
  ```

- [ ] **Step 3: Validate frontend build and TypeScript types**
  Run:
  ```bash
  npm run build
  ```
  Expected output: Build completes successfully without typescript compilation errors.

- [ ] **Step 4: Commit frontend changes**
  Run:
  ```bash
  git add components/reports/user-contributions-report.tsx src/routes/reports/reports-page.tsx
  git commit -m "feat: implement UserContributionsReport frontend component and integrate into Reports page tabs"
  ```
