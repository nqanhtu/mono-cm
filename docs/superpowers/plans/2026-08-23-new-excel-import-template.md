# Triển Khai Mẫu Import Excel Hồ Sơ Mới (12 Cột) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển đổi parser, import service, template mẫu và test suite sang định dạng Excel 12 cột mới (`mau-ho-so-me 2011 (3).xlsx`) không duy trì tương thích ngược cột chuỗi cũ.

**Architecture:** Refactor `server/lib/excel-parser.ts` để trích xuất trực tiếp 12 cột rõ ràng từ Sheet 1 và 8 cột từ Sheet 2, hỗ trợ parse đa định dạng ngày tháng và danh sách nguyên đơn/bị cáo; cập nhật `excel-import.ts`, script tạo file mẫu `generate-sample-excel.ts`, và bộ test unit/contract.

**Tech Stack:** TypeScript, Node.js / Bun, `xlsx`, Prisma, PostgreSQL, Bun Test.

## Global Constraints

- File Excel gồm 2 Sheet: `Thông tin hồ sơ` (12 cột) và `Mục lục văn bản` (8 cột).
- Sheet 1 gồm 12 cột: `Hộp số`, `Hồ sơ số`, `Số bản án/ quyết định`, `Ngày bản án/ quyết định`, `Tiêu đề`, `Nguyên đơn/ người bị hại`, `Bị cáo/ bị đơn`, `Số tờ`, `Loại án`, `Thời gian`, `THBQ`, `Ghi chú`.
- Sheet 2 gồm 8 cột: `Hồ sơ số`, `Mục lục văn bản`, `Tiêu đề`, `Loại án`, `Thời gian`, `Số tờ`, `Thời hạn bảo quản`, `Ghi chú`.
- Loại bỏ hoàn toàn hàm `parseDetails()` và cột `:` / `Chi tiết`.
- Đảm bảo toàn bộ test runner `bun test` pass 100%.

---

### Task 1: Tạo Unit Test cho Excel Parser với Mẫu Mới

**Files:**
- Create: `server/lib/excel-parser.test.ts`
- Test: `server/lib/excel-parser.test.ts`

**Interfaces:**
- Consumes: `parseExcelFile(buffer: ArrayBuffer): Promise<ImportData>` từ `server/lib/excel-parser.ts`
- Produces: Bộ unit test kiểm tra việc đọc file mẫu `mau-ho-so-me 2011 (3).xlsx` và buffer tự sinh.

- [ ] **Step 1: Viết test case đọc file mẫu mới và kiểm tra các trường dữ liệu**

```typescript
import { describe, expect, test } from 'bun:test'
import * as fs from 'fs'
import * as path from 'path'
import * as XLSX from 'xlsx'
import { parseExcelFile } from './excel-parser'

describe('excel-parser with new 12-column format', () => {
  test('parses new format excel buffer correctly', async () => {
    const wb = XLSX.utils.book_new()
    const sheet1Data = [
      {
        'Hộp số': 'H01',
        'Hồ sơ số': '2024/HS-ST/01',
        'Số bản án/ quyết định': '45/2024/HS-ST',
        'Ngày bản án/ quyết định': '15/04/2024',
        'Tiêu đề': 'Vụ án trộm cắp tài sản',
        'Nguyên đơn/ người bị hại': 'Nguyễn Văn Bị Hại',
        'Bị cáo/ bị đơn': 'Trần Văn Bị Cáo 1, Lê Văn Bị Cáo 2',
        'Số tờ': 120,
        'Loại án': 'Hình sự',
        'Thời gian': 2024,
        'THBQ': 'Vĩnh viễn',
        'Ghi chú': 'Án điểm',
      },
    ]
    const sheet2Data = [
      {
        'Hồ sơ số': '2024/HS-ST/01',
        'Mục lục văn bản': 'VB-01',
        'Tiêu đề': 'Cáo trạng',
        'Loại án': 'Hình sự',
        'Thời gian': 2024,
        'Số tờ': 10,
        'Thời hạn bảo quản': 'Vĩnh viễn',
        'Ghi chú': 'Bản chính',
      },
    ]

    const ws1 = XLSX.utils.json_to_sheet(sheet1Data)
    const ws2 = XLSX.utils.json_to_sheet(sheet2Data)
    XLSX.utils.book_append_sheet(wb, ws1, 'Thông tin hồ sơ')
    XLSX.utils.book_append_sheet(wb, ws2, 'Mục lục văn bản')
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })

    const result = await parseExcelFile(buffer)
    expect(result.files.length).toBe(1)
    const file = result.files[0]
    expect(file.code).toBe('2024/HS-ST/01')
    expect(file.boxCode).toBe('H01')
    expect(file.judgmentNumber).toBe('45/2024/HS-ST')
    expect(file.title).toBe('Vụ án trộm cắp tài sản')
    expect(file.plaintiffs).toEqual(['Nguyễn Văn Bị Hại'])
    expect(file.defendants).toEqual(['Trần Văn Bị Cáo 1', 'Lê Văn Bị Cáo 2'])
    expect(file.pageCount).toBe(120)
    expect(file.type).toBe('Hình sự')
    expect(file.year).toBe(2024)
    expect(file.retention).toBe('Vĩnh viễn')
    expect(file.note).toBe('Án điểm')
    expect(file.startDate).toBeDefined()

    expect(result.documents.length).toBe(1)
    expect(result.documents[0].fileCode).toBe('2024/HS-ST/01')
    expect(result.documents[0].title).toBe('Cáo trạng')
  })
})
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại trước khi refactor**

Run: `bun test server/lib/excel-parser.test.ts`
Expected: FAIL do parser cũ chưa trích xuất các cột mới hoặc thiếu trường `plaintiffs`/`defendants`/`judgmentNumber` trực tiếp.

- [ ] **Step 3: Commit file test**

```bash
git add server/lib/excel-parser.test.ts
git commit -m "test: add unit test for new 12-column excel parser"
```

---

### Task 2: Refactor `server/lib/excel-parser.ts` & Excel Types

**Files:**
- Modify: `server/lib/excel-parser.ts`
- Modify: `server/lib/types/excel.ts`
- Modify: `lib/types/excel.ts`
- Test: `server/lib/excel-parser.test.ts`

**Interfaces:**
- Consumes: Raw Excel Sheet data
- Produces: `parseExcelFile(buffer: ArrayBuffer): Promise<ImportData>` chuẩn hóa 12 cột.

- [ ] **Step 1: Cập nhật interface `ExtractedFile` trong `server/lib/types/excel.ts` và `lib/types/excel.ts`**

Đảm bảo `ExtractedFile` có đầy đủ các trường:
```typescript
export interface ExtractedFile {
    code: string
    title: string
    type: string
    year: number
    pageCount: number
    retention: string
    startDate?: Date
    endDate?: Date
    details?: FileDetails
    boxCode: string
    indexCode?: string
    note?: string
    judgmentNumber?: string
    defendants?: string[]
    plaintiffs?: string[]
    civilDefendants?: string[]
}
```

- [ ] **Step 2: Cập nhật `server/lib/excel-parser.ts`**

Xóa `parseDetails()`, thêm helper `parseExcelDate()` và `parseNameList()`, đọc trực tiếp 12 cột:
```typescript
import * as XLSX from 'xlsx'
import { ExtractedFile, ExtractedDocument, ExtractedLocation, ImportData } from './types/excel'

export const parseExcelFile = async (buffer: ArrayBuffer): Promise<ImportData> => {
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })

    const sheetNames = workbook.SheetNames
    if (sheetNames.length < 1) {
        throw new Error('File Excel phải có ít nhất 1 Sheet dữ liệu.')
    }

    const filesSheet = workbook.Sheets[sheetNames[0]]
    const rawFiles = XLSX.utils.sheet_to_json<Record<string, unknown>>(filesSheet)
    
    const files: ExtractedFile[] = rawFiles.map((row: Record<string, unknown>) => {
        const rawBoxCode = row['Hộp số'] ?? row['Dữ liệu ( Hộp)'] ?? row['Hộp'] ?? row['Mã hộp'] ?? ''
        const judgmentDate = parseExcelDate(row['Ngày bản án/ quyết định'])
        const year = parseYear(row['Thời gian']) || (judgmentDate ? judgmentDate.getFullYear() : 0)

        const plaintiffs = parseNameList(row['Nguyên đơn/ người bị hại'] ?? row['Nguyên đơn'])
        const defendants = parseNameList(row['Bị cáo/ bị đơn'] ?? row['Bị cáo'])

        return {
            code: String(row['Hồ sơ số'] ?? '').trim(),
            title: String(row['Tiêu đề'] ?? row['Trích yếu'] ?? '').trim(),
            type: String(row['Loại án'] ?? '').trim(),
            year,
            pageCount: typeof row['Số tờ'] === 'number' ? row['Số tờ'] : parseInt(String(row['Số tờ'] || '0'), 10) || 0,
            retention: String(row['THBQ'] ?? row['Thời hạn bảo quản'] ?? '').trim(),
            boxCode: String(rawBoxCode).trim(),
            indexCode: row['MLHS'] ? String(row['MLHS']).trim() : undefined,
            note: row['Ghi chú'] ? String(row['Ghi chú']).trim() : undefined,
            judgmentNumber: row['Số bản án/ quyết định'] ? String(row['Số bản án/ quyết định']).trim() : undefined,
            startDate: judgmentDate,
            plaintiffs: plaintiffs.length > 0 ? plaintiffs : undefined,
            defendants: defendants.length > 0 ? defendants : undefined,
            details: {
                summary: String(row['Tiêu đề'] ?? '').trim(),
                judgmentNumber: row['Số bản án/ quyết định'] ? String(row['Số bản án/ quyết định']).trim() : undefined,
                judgmentDate: judgmentDate ? judgmentDate.toISOString() : undefined,
                plaintiffs,
                defendants,
            }
        }
    })

    const documents: ExtractedDocument[] = []
    if (sheetNames.length > 1) {
        const docsSheet = workbook.Sheets[sheetNames[1]]
        const rawDocs = XLSX.utils.sheet_to_json<Record<string, unknown>>(docsSheet)
        rawDocs.forEach((row, index) => {
            documents.push({
                fileCode: row['Hồ sơ số'] ? String(row['Hồ sơ số']).trim() : '',
                code: row['Mục lục văn bản'] ? String(row['Mục lục văn bản']).trim() : '',
                title: (row['Tiêu đề'] || row['Tên văn bản'] || 'Bản kê văn bản') as string,
                type: row['Loại án'] ? String(row['Loại án']).trim() : undefined,
                year: parseYear(row['Thời gian']),
                pageCount: typeof row['Số tờ'] === 'number' ? row['Số tờ'] : parseInt(String(row['Số tờ'] || '0'), 10) || 0,
                note: row['Ghi chú'] ? String(row['Ghi chú']).trim() : undefined,
                preservationTime: (row['Thời hạn bảo quản'] || row['THBQ']) ? String(row['Thời hạn bảo quản'] || row['THBQ']).trim() : undefined,
                contentIndex: row['Mục lục văn bản'] ? String(row['Mục lục văn bản']).trim() : undefined,
                order: index + 1
            })
        })
    }

    const boxes: ExtractedLocation[] = []
    return { files, documents, boxes }
}

function parseNameList(value: unknown): string[] {
    if (!value) return []
    const str = String(value).trim()
    if (!str) return []
    return str.split(/[,;\n]/).map(s => s.trim()).filter(Boolean)
}

function parseExcelDate(value: unknown): Date | undefined {
    if (!value) return undefined
    if (value instanceof Date && !isNaN(value.getTime())) return value
    if (typeof value === 'number') {
        // Excel serial date to JS Date
        const parsed = XLSX.SSF.parse_date_code(value)
        if (parsed) {
            return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d))
        }
    }
    if (typeof value === 'string') {
        const str = value.trim()
        // DD/MM/YYYY or DD-MM-YYYY
        const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
        if (dmyMatch) {
            const day = parseInt(dmyMatch[1], 10)
            const month = parseInt(dmyMatch[2], 10) - 1
            const year = parseInt(dmyMatch[3], 10)
            const d = new Date(Date.UTC(year, month, day))
            if (!isNaN(d.getTime())) return d
        }
        // YYYY-MM-DD
        const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/)
        if (ymdMatch) {
            const year = parseInt(ymdMatch[1], 10)
            const month = parseInt(ymdMatch[2], 10) - 1
            const day = parseInt(ymdMatch[3], 10)
            const d = new Date(Date.UTC(year, month, day))
            if (!isNaN(d.getTime())) return d
        }
        const d = new Date(str)
        if (!isNaN(d.getTime())) return d
    }
    return undefined
}

function parseYear(val: unknown): number {
    if (!val) return 0
    if (typeof val === 'number') return Math.floor(val)
    if (val instanceof Date) return val.getFullYear()
    const str = String(val).trim()
    const match = str.match(/\b(19\d\d|20\d\d)\b/)
    if (match) return parseInt(match[1], 10)
    return parseInt(str, 10) || 0
}
```

- [ ] **Step 3: Chạy test để xác nhận test pass**

Run: `bun test server/lib/excel-parser.test.ts`
Expected: PASS (tất cả các trường được trích xuất chính xác).

- [ ] **Step 4: Commit**

```bash
git add server/lib/excel-parser.ts server/lib/types/excel.ts lib/types/excel.ts
git commit -m "feat: refactor excel-parser to parse new 12-column template directly"
```

---

### Task 3: Cập nhật Import Service & Contract Tests

**Files:**
- Modify: `server/lib/services/excel-import.ts`
- Modify: `server/contracts/upload.contract.test.ts`
- Test: `server/contracts/upload.contract.test.ts`

**Interfaces:**
- Consumes: `parseExcelUpload(file: File)` -> `ImportPayload`
- Produces: `previewExcelImport` & `commitExcelImport` hoạt động chính xác với cấu trúc mới.

- [ ] **Step 1: Kiểm tra và điều chỉnh `server/lib/services/excel-import.ts`**

Đảm bảo khi commit:
- `datetime: fileData.startDate || new Date(fileData.year, 0, 1)`
- `judgmentDate: fileData.startDate`
- `judgmentNumber: fileData.judgmentNumber`
- `defendants: fileData.defendants ?? []`
- `plaintiffs: fileData.plaintiffs ?? []`
- `note: fileData.note`
- `retention: fileData.retention`

- [ ] **Step 2: Cập nhật test contract trong `server/contracts/upload.contract.test.ts`**

Thêm test case kiểm tra preview và commit với file mẫu mới.

- [ ] **Step 3: Chạy test contract để xác nhận pass**

Run: `bun test server/contracts/upload.contract.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add server/lib/services/excel-import.ts server/contracts/upload.contract.test.ts
git commit -m "feat: align excel-import service and contract tests with new format"
```

---

### Task 4: Cập nhật Script Tạo Template Mẫu & Đồng Bộ File Template

**Files:**
- Modify: `scripts/generate-sample-excel.ts`
- Update: `public/templates/mau-ho-so-me.xlsx`
- Update: `dist/templates/mau-ho-so-me.xlsx`

**Interfaces:**
- Produces: File `public/templates/mau-ho-so-me.xlsx` và `dist/templates/mau-ho-so-me.xlsx` chuẩn 12 cột cho người dùng tải về.

- [ ] **Step 1: Cập nhật `scripts/generate-sample-excel.ts`**

Thay thế `sheet1Data` mẫu cũ bằng 12 cột mới:
```typescript
const sheet1Data = [
  {
    'Hộp số': 'H01',
    'Hồ sơ số': '2024/HS-ST/01',
    'Số bản án/ quyết định': '45/2024/QĐ-ST',
    'Ngày bản án/ quyết định': '15/04/2024',
    'Tiêu đề': 'Vụ án Nguyễn Văn A và đồng phạm về tội Trộm cắp tài sản',
    'Nguyên đơn/ người bị hại': 'Công ty TNHH X',
    'Bị cáo/ bị đơn': 'Nguyễn Văn A, Trần Văn B',
    'Số tờ': 150,
    'Loại án': 'Hình sự',
    'Thời gian': 2024,
    'THBQ': 'Vĩnh viễn',
    'Ghi chú': 'Hồ sơ án điểm năm 2024',
  },
  {
    'Hộp số': 'H01',
    'Hồ sơ số': '2024/DS-ST/02',
    'Số bản án/ quyết định': '12/2024/DS-ST',
    'Ngày bản án/ quyết định': '20/05/2024',
    'Tiêu đề': 'Vụ án tranh chấp hợp đồng chuyển nhượng quyền sử dụng đất',
    'Nguyên đơn/ người bị hại': 'Lê Thị C',
    'Bị cáo/ bị đơn': 'Phạm Văn D',
    'Số tờ': 85,
    'Loại án': 'Dân sự',
    'Thời gian': 2024,
    'THBQ': '50 năm',
    'Ghi chú': 'Đã thi hành án xong',
  },
  {
    'Hộp số': 'H02',
    'Hồ sơ số': '2024/HC-ST/03',
    'Số bản án/ quyết định': '08/2024/HC-ST',
    'Ngày bản án/ quyết định': '10/06/2024',
    'Tiêu đề': 'Vụ án khiếu kiện quyết định xử phạt hành chính trong lĩnh vực đất đai',
    'Nguyên đơn/ người bị hại': 'Hoàng Văn E',
    'Bị cáo/ bị đơn': 'Ủy ban nhân dân quận X',
    'Số tờ': 60,
    'Loại án': 'Hành chính',
    'Thời gian': 2024,
    'THBQ': '15 năm',
    'Ghi chú': 'Lưu trữ tại kho B',
  },
]
```

- [ ] **Step 2: Chạy script để sinh file template mới**

Run: `bun scripts/generate-sample-excel.ts`
Expected: File `public/templates/mau-ho-so-me.xlsx` được sinh thành công với cấu trúc mới.

- [ ] **Step 3: Sao chép sang `dist/templates/mau-ho-so-me.xlsx` nếu thư mục tồn tại**

Run: `mkdir -p dist/templates && cp public/templates/mau-ho-so-me.xlsx dist/templates/mau-ho-so-me.xlsx`

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-sample-excel.ts public/templates/mau-ho-so-me.xlsx dist/templates/mau-ho-so-me.xlsx
git commit -m "chore: update sample excel generator and templates to new 12-column format"
```

---

### Task 5: Chạy Toàn Bộ Bộ Kiểm Thử & Xác Nhận File Thật

**Files:**
- Test: Toàn bộ test suite trong repo (`bun test`)

- [ ] **Step 1: Test parse file gốc `mau-ho-so-me 2011 (3).xlsx`**

Viết test hoặc chạy script xác nhận parse thành công file gốc `mau-ho-so-me 2011 (3).xlsx` không phát sinh lỗi.

- [ ] **Step 2: Chạy toàn bộ test suite**

Run: `bun test`
Expected: Tất cả tests trong hệ thống pass.

- [ ] **Step 3: Commit hoàn tất**

```bash
git commit --allow-empty -m "chore: verify all test suites pass with new excel template"
```
