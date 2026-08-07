# Excel Box Patch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the backend API endpoint (`POST /api/upload/excel/patch-boxes`) and frontend UI component (`ExcelBoxPatchDialog`) to patch missing `boxId` on existing `File` records from Excel files by linking ONLY to pre-existing `StorageBox` records in the database.

**Architecture:** The backend endpoint parses Excel file rows, queries existing `File` and `StorageBox` records from Postgres DB via Prisma, updates matching files whose boxes exist in DB, and returns patch statistics with warnings for missing boxes. The frontend UI provides a modal dialog on the `/upload` page with dropzone, stats badges, and warning table.

**Tech Stack:** Bun, Elysia, Prisma PG, React 19, Lucide React, Radix UI Dialog, TailwindCSS.

## Global Constraints

- Never auto-create missing `StorageBox` records during patch.
- Must verify user session (`sessionOrDenied` with `manageFiles`).
- Must log audit event (`action: 'UPDATE'`, `target: 'File'`).

---

### Task 1: Backend Endpoint `POST /api/upload/excel/patch-boxes`

**Files:**
- Modify: `server/api-routes/upload.routes.ts`
- Test: `server/contracts/upload.contract.test.ts`

**Interfaces:**
- Produces: `POST /api/upload/excel/patch-boxes` returning `{ success: boolean, stats: { scanned: number, matchedFiles: number, patched: number, missingBoxCount: number }, missingBoxes: string[], issues: string[] }`

- [ ] **Step 1: Write failing contract test for patch-boxes API**

```typescript
// server/contracts/upload.contract.test.ts
test('POST /api/upload/excel/patch-boxes requires session auth', async () => {
  const req = new Request('http://localhost:3001/api/upload/excel/patch-boxes', {
    method: 'POST',
  })
  const res = await app.handle(req)
  expect(res.status).toBe(401)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test server/contracts/upload.contract.test.ts`
Expected: FAIL (404 Not Found)

- [ ] **Step 3: Implement `POST /api/upload/excel/patch-boxes` in `upload.routes.ts`**

```typescript
.post('/api/upload/excel/patch-boxes', async ({ request, set }) => {
  const { session, denied } = await sessionOrDenied({ request, set }, 'manageFiles')
  if (denied) return denied

  const formData = await request.formData()
  const file = formData.get('file')
  if (!isUploadedFile(file)) return apiError(set, 'Vui lòng chọn file Excel', 400)

  const payload = await parseExcelUpload(file)
  const fileCodes = Array.from(new Set(payload.files.map((f) => normalizeCode(f.code)).filter(Boolean)))
  const boxCodes = Array.from(new Set(payload.files.map((f) => normalizeCode(f.boxCode)).filter(Boolean)))

  const existingFiles = await db.file.findMany({
    where: { code: { in: fileCodes } },
    select: { id: true, code: true, boxId: true },
  })
  const fileMap = new Map(existingFiles.map((f) => [f.code, f]))

  const existingBoxes = await db.storageBox.findMany({
    where: {
      OR: [
        { code: { in: boxCodes } },
        { boxNumber: { in: boxCodes } },
        { code: { in: boxCodes.map((c) => `H${c}`) } },
        { boxNumber: { in: boxCodes.map((c) => `H${c}`) } },
      ],
    },
    select: { id: true, code: true, boxNumber: true },
  })

  const boxMap = new Map<string, string>()
  for (const b of existingBoxes) {
    boxMap.set(b.code, b.id)
    boxMap.set(b.boxNumber, b.id)
    if (b.boxNumber.startsWith('H')) boxMap.set(b.boxNumber.slice(1), b.id)
  }

  let patchedCount = 0
  const missingBoxesSet = new Set<string>()
  const issues: string[] = []

  for (const item of payload.files) {
    const code = normalizeCode(item.code)
    const boxCode = normalizeCode(item.boxCode)
    const file = fileMap.get(code)

    if (!file) {
      issues.push(`Hồ sơ số ${code} không tồn tại trong hệ thống`)
      continue
    }

    if (!boxCode) {
      issues.push(`Hồ sơ ${code} không có Hộp số trong Excel`)
      continue
    }

    const boxId = boxMap.get(boxCode) || boxMap.get(`H${boxCode}`)
    if (!boxId) {
      missingBoxesSet.add(boxCode)
      issues.push(`Hộp ${boxCode} của hồ sơ ${code} chưa tồn tại trong cơ sở dữ liệu`)
      continue
    }

    await db.file.update({
      where: { id: file.id },
      data: { boxId },
    })
    patchedCount += 1
  }

  await createAuditLog({
    action: 'UPDATE',
    target: 'File',
    userId: session?.id,
    ipAddress: getClientIp(request),
    detail: { action: 'Excel Box Patch', patchedCount, missingBoxes: Array.from(missingBoxesSet) },
  })

  return {
    success: true,
    stats: {
      scanned: payload.files.length,
      matchedFiles: existingFiles.length,
      patched: patchedCount,
      missingBoxCount: missingBoxesSet.size,
    },
    missingBoxes: Array.from(missingBoxesSet),
    issues,
  }
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test server/contracts/upload.contract.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/api-routes/upload.routes.ts server/contracts/upload.contract.test.ts
git commit -m "feat: add POST /api/upload/excel/patch-boxes endpoint"
```

---

### Task 2: UI Component `ExcelBoxPatchDialog` & Form Integration

**Files:**
- Create: `components/forms/excel-box-patch-dialog.tsx`
- Modify: `components/forms/excel-upload-form.tsx`

**Interfaces:**
- Consumes: `POST /api/upload/excel/patch-boxes`
- Produces: `ExcelBoxPatchDialog` component with trigger button on `/upload` page.

- [ ] **Step 1: Create `components/forms/excel-box-patch-dialog.tsx`**

```tsx
import { useState } from 'react'
import { apiFetch } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertCircle, CheckCircle2, FileSpreadsheet, Loader2, Wrench } from 'lucide-react'
import { toast } from 'sonner'

export function ExcelBoxPatchDialog() {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [patchResult, setPatchResult] = useState<{
    stats: { scanned: number; matchedFiles: number; patched: number; missingBoxCount: number }
    missingBoxes: string[]
    issues: string[]
  } | null>(null)

  const handlePatch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return toast.error('Vui lòng chọn file Excel')

    setIsLoading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await apiFetch('/api/upload/excel/patch-boxes', { method: 'POST', body: formData })
      const data = await res.json()

      if (res.ok && data.success) {
        setPatchResult(data)
        toast.success(`Đã vá thành công ${data.stats.patched} hồ sơ`)
      } else {
        toast.error(data.message || 'Thao tác vá dữ liệu thất bại')
      }
    } catch {
      toast.error('Có lỗi xảy ra khi vá Hộp số')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 h-9 rounded-lg border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10">
          <Wrench className="h-4 w-4 text-amber-600" />
          Vá Hộp số từ Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">Vá liên kết Hộp lưu trữ từ Excel</DialogTitle>
          <DialogDescription className="text-xs">
            Rà soát và bổ sung Hộp số cho các hồ sơ cũ trong DB. Chỉ liên kết vào các Hộp ĐÃ TỒN TẠI sẵn trong hệ thống.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handlePatch} className="space-y-4 py-2">
          <input
            type="file"
            accept=".xlsx, .xls"
            onChange={(e) => {
              setFile(e.target.files?.[0] || null)
              setPatchResult(null)
            }}
            className="text-xs block w-full border rounded-lg p-2"
          />

          {patchResult && (
            <div className="space-y-3 rounded-xl border p-3.5 bg-muted/20 text-xs">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Quét: {patchResult.stats.scanned} dòng</Badge>
                <Badge variant="secondary">Khớp: {patchResult.stats.matchedFiles} HS</Badge>
                <Badge className="bg-emerald-600 text-white">Đã vá: {patchResult.stats.patched} HS</Badge>
              </div>

              {patchResult.missingBoxes.length > 0 && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-700 dark:text-amber-400 space-y-1">
                  <p className="font-semibold flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Cảnh báo Hộp chưa có trong CSDL ({patchResult.missingBoxes.length}):
                  </p>
                  <p className="text-[11px]">{patchResult.missingBoxes.map((b) => `Hộp ${b}`).join(', ')}</p>
                  <p className="text-[10px] text-muted-foreground">Vui lòng tạo trước các Hộp này trong hệ thống rồi thực hiện vá lại.</p>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Đóng</Button>
            <Button type="submit" disabled={!file || isLoading} className="bg-primary text-primary-foreground">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
              Bắt đầu vá
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Add `ExcelBoxPatchDialog` to `ExcelUploadForm` header in `components/forms/excel-upload-form.tsx`**

```tsx
import { ExcelBoxPatchDialog } from './excel-box-patch-dialog'

// Render ExcelBoxPatchDialog button inside ExcelUploadForm action area
```

- [ ] **Step 3: Run full server & UI tests**

Run: `bun run test:server`
Expected: 100% PASS

- [ ] **Step 4: Commit**

```bash
git add components/forms/excel-box-patch-dialog.tsx components/forms/excel-upload-form.tsx
git commit -m "feat: add ExcelBoxPatchDialog component and integrate into upload form"
```
