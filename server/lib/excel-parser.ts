import * as XLSX from 'xlsx'
import { ExtractedFile, ExtractedDocument, ExtractedLocation, ImportData, FileDetails, ExtractedUser } from './types/excel'



export const parseExcelFile = async (buffer: ArrayBuffer): Promise<ImportData> => {
    const workbook = XLSX.read(buffer, { type: 'array' })

    // Validate Sheets
    // Assuming Sheet Names are standardized or we use index 0, 1, 2
    // Sheet 1: Thông tin hồ sơ
    // Sheet 2: Mục lục hồ sơ (Văn bản con)
    // Sheet 3: Vị trí lưu kho

    const sheetNames = workbook.SheetNames
    if (sheetNames.length < 1) {
        throw new Error('File Excel phải có ít nhất 1 Sheet dữ liệu.')
    }

    const filesSheet = workbook.Sheets[sheetNames[0]]

    // Parse Sheet 1: Files
    const rawFiles = XLSX.utils.sheet_to_json<Record<string, unknown>>(filesSheet)
    const files: ExtractedFile[] = rawFiles.map((row: Record<string, unknown>) => ({
        code: row['Hồ sơ số'] as string,
        // Title will be extracted from the complex text column if not present?
        // Or if 'Tiêu đề' column exists, use it. In HS628 there isn't a clear "Tiêu đề" column, 
        // it seems to be inside the column ":" (which is row[':'])
        title: '', // Will populate from details parsing
        type: row['Loại án'] as string,
        year: parseYear(row['Thời gian']),
        pageCount: typeof row['Số tờ'] === 'number' ? row['Số tờ'] : parseInt((row['Số tờ'] as string) || '0'),
        retention: row['THBQ'] as string, // HS628 uses 'THBQ'
        boxCode: (row['Dữ liệu ( Hộp)'] || row['Hộp số']) as string,
        indexCode: row['MLHS'] as string,
        note: row['Ghi chú'] as string,

        details: parseDetails(row[':'] as string), // The column with header ":"

        startDate: undefined, // Will be set from details
    }))

    // Post-process to set title and startDate from details


    files.forEach(f => {
        if (f.details) {
            const d = f.details as FileDetails; 
            if (d.summary) f.title = d.summary;
            if (d.judgmentDate) f.startDate = new Date(d.judgmentDate);
            f.judgmentNumber = d.judgmentNumber;
            f.defendants = d.defendants;
            f.plaintiffs = d.plaintiffs;
            f.civilDefendants = d.civilDefendants;
        }
    })

    const documents: ExtractedDocument[] = []
    const boxes: ExtractedLocation[] = []

    return { files, documents, boxes }
}

function parseDetails(text: string): FileDetails {
    if (!text) return {};
    const lines = text.split('\r\n').map(l => l.trim());
    const details: FileDetails = {};

    // ...

    lines.forEach(line => {
        if (line.startsWith('Về việc:')) details.summary = line.replace('Về việc:', '').trim();
        if (line.startsWith('Bị cáo:')) details.defendants = line.replace('Bị cáo:', '').trim().split(',').map(s => s.trim());
        if (line.startsWith('Nguyên đơn:')) details.plaintiffs = line.replace('Nguyên đơn:', '').trim().split(',').map(s => s.trim());
        if (line.startsWith('Bị đơn:')) details.civilDefendants = line.replace('Bị đơn:', '').trim().split(',').map(s => s.trim());
        if (line.startsWith('QDTHS:') || line.startsWith('Số:')) details.judgmentNumber = (line.replace('QDTHS:', '').replace('Số:', '')).trim();
        if (line.startsWith('Ngày:')) {
            const dateStr = line.replace('Ngày:', '').trim();
            // Parse DD/MM/YYYY
            const parts = dateStr.split('/');
            if (parts.length === 3) {
                // Store as format YYYY-MM-DD or ISO string for JSON compatibility
                // Using new Date() directly in JSON object causes Prisma Error
                const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                if (!isNaN(d.getTime())) {
                    details.judgmentDate = d.toISOString();
                }
            }
        }
    });

    return details;
}

// ... (existing imports)

export const parseChildDocumentsExcel = async (buffer: ArrayBuffer): Promise<ExtractedDocument[]> => {
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]

    const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)

    return rawData.map((row: Record<string, unknown>, index: number) => ({
        // Assuming "Hồ sơ số" maps to fileCode (to link to parent). Default to '' if missing.
        fileCode: row['Hồ sơ số'] ? String(row['Hồ sơ số']) : '',

        // "Mục lục văn bản" might be the Document Code or ID
        code: row['Mục lục văn bản'] ? String(row['Mục lục văn bản']) : '',

        title: row['Tiêu đề'] ? String(row['Tiêu đề']) : 'Bản kê văn bản',

        type: row['Loại án'] ? String(row['Loại án']) : undefined,

        year: parseYear(row['Thời gian']),

        pageCount: typeof row['Số tờ'] === 'number' ? row['Số tờ'] : parseInt((row['Số tờ'] as string) || '0'),

        // New fields
        note: row['Ghi chú'] ? String(row['Ghi chú']) : undefined,
        preservationTime: row['Thời hạn bảo quản'] ? String(row['Thời hạn bảo quản']) : undefined,
        contentIndex: row['Mục lục văn bản'] ? String(row['Mục lục văn bản']) : undefined,

        order: index + 1
    }))
}

// ... (keep existing functions)

function parseYear(dateStr: unknown): number {
    if (typeof dateStr === 'number') {
        if (dateStr > 10000) {
            // Excel serial date (days since 1900-01-01)
            const date = new Date(Math.round((dateStr - 25569) * 86400 * 1000))
            return date.getFullYear()
        }
        return dateStr
    }
    if (!dateStr) return new Date().getFullYear()
    const date = new Date(dateStr as string | number)
    if (!isNaN(date.getTime())) return date.getFullYear()
    // Try regex for YYYY
    const match = dateStr.toString().match(/\d{4}/)
    return match ? parseInt(match[0]) : new Date().getFullYear()
}

function normalizeUserRole(roleStr: string): string {
    const normalized = roleStr.trim().toUpperCase()
    if (['SUPER_ADMIN', 'SUPERADMIN'].includes(normalized)) return 'SUPER_ADMIN'
    if (['ADMIN'].includes(normalized)) return 'ADMIN'
    if (['COORDINATOR'].includes(normalized)) return 'COORDINATOR'
    if (['VIEWER'].includes(normalized)) return 'VIEWER'
    if (['BASIC_VIEWER', 'BASICVIEWER'].includes(normalized)) return 'BASIC_VIEWER'
    
    const vnLower = roleStr.trim().toLowerCase()
    if (vnLower.includes('quản trị toàn hệ thống') || vnLower.includes('quản trị hệ thống') || vnLower.includes('super admin')) return 'SUPER_ADMIN'
    if (vnLower.includes('quản trị') || vnLower.includes('admin')) return 'ADMIN'
    if (vnLower.includes('điều phối')) return 'COORDINATOR'
    if (vnLower.includes('chỉ xem') || vnLower.includes('xem') || vnLower.includes('viewer')) return 'VIEWER'
    if (vnLower.includes('basic viewer') || vnLower.includes('người xem cơ bản')) return 'BASIC_VIEWER'
    
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
            const normalizedStatus = String(statusStr).trim().toLowerCase()
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

