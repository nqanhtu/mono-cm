import * as XLSX from 'xlsx'
import { ExtractedFile, ExtractedDocument, ExtractedLocation, ImportData, ExtractedUser } from './types/excel'

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

export const parseChildDocumentsExcel = async (buffer: ArrayBuffer): Promise<ExtractedDocument[]> => {
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]

    const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)

    return rawData.map((row: Record<string, unknown>, index: number) => ({
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
    }))
}

function normalizeUserRole(roleStr: string): string {
    // Normalize to NFC before matching the hardcoded Vietnamese role labels
    // below, otherwise an NFD-encoded cell value silently fails every
    // .includes() check and the import falls through to an unrecognized role.
    roleStr = roleStr.normalize('NFC')
    const normalized = roleStr.trim().toUpperCase()
    if (['SUPER_ADMIN', 'SUPERADMIN'].includes(normalized)) return 'SUPER_ADMIN'
    if (['ADMIN'].includes(normalized)) return 'ADMIN'
    if (['COORDINATOR'].includes(normalized)) return 'COORDINATOR'
    // BASIC_VIEWER no longer exists as a role (merged into VIEWER on 2026-09-15) —
    // an old export or a hand-typed cell that still says "Basic Viewer" should
    // resolve to VIEWER rather than fail import as an unrecognized role.
    if (['VIEWER', 'BASIC_VIEWER', 'BASICVIEWER'].includes(normalized)) return 'VIEWER'

    const vnLower = roleStr.trim().toLowerCase()
    if (vnLower.includes('quản trị toàn hệ thống') || vnLower.includes('quản trị hệ thống') || vnLower.includes('super admin')) return 'SUPER_ADMIN'
    if (vnLower.includes('quản trị') || vnLower.includes('admin')) return 'ADMIN'
    if (vnLower.includes('điều phối')) return 'COORDINATOR'
    if (vnLower.includes('basic viewer') || vnLower.includes('người xem cơ bản') || vnLower.includes('chỉ xem') || vnLower.includes('xem') || vnLower.includes('viewer')) return 'VIEWER'

    return roleStr
}

export const parseUsersExcel = async (buffer: ArrayBuffer): Promise<ExtractedUser[]> => {
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) throw new Error('File không có dữ liệu.')
    const sheet = workbook.Sheets[sheetName]
    const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)
    
    return rawData.map((row: Record<string, unknown>, index: number) => {
        const username = (row['Tên đăng nhập'] || row['username'] || row['Username'] || '') as string
        const fullName = (row['Họ và tên'] || row['fullName'] || row['FullName'] || row['fullname'] || '') as string
        const password = (row['Mật khẩu'] || row['password'] || row['Password'] || '') as string
        const roleStr = (row['Vai trò'] || row['role'] || row['Role'] || '') as string
        const unit = (row['Đơn vị'] || row['đơn vị'] || row['unit'] || row['Unit'] || '') as string
        const statusStr = (row['Trạng thái'] || row['trạng thái'] || row['status'] || row['Status'] || '') as string
        
        let status = true
        if (statusStr) {
            const normalizedStatus = String(statusStr).normalize('NFC').trim().toLowerCase()
            if (['bị khóa', 'khóa', 'inactive', 'false', '0'].includes(normalizedStatus)) {
                status = false
            }
        }
        
        return {
            username: String(username).trim(),
            fullName: String(fullName).trim(),
            password: password ? String(password) : undefined,
            role: roleStr ? normalizeUserRole(String(roleStr)) : undefined,
            unit: unit ? String(unit).trim() : undefined,
            status,
            row: index + 2
        }
    })
}

