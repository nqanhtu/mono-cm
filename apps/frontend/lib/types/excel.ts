export interface FileDetails {
    summary?: string;
    judgmentDate?: string;
    judgmentNumber?: string;
    defendants?: string[];
    plaintiffs?: string[];
    civilDefendants?: string[];
}

export interface ExtractedFile {
    code: string
    title: string
    type: string
    year: number
    pageCount: number
    retention: string
    startDate?: Date
    endDate?: Date
    details: FileDetails
    boxCode: string // Links to Location
    indexCode: string // MLHS
    note: string // Ghi chú
    judgmentNumber?: string // Số bản án
    defendants?: string[] // Bị cáo
    plaintiffs?: string[] // Nguyên đơn
    civilDefendants?: string[] // Bị đơn
}

export interface ExtractedDocument {
    fileCode: string // Links to Parent File
    code: string
    title: string
    pageCount: number
    year: number
    order: number
    note?: string
    preservationTime?: string
    contentIndex?: string
    type?: string
}

export interface ExtractedLocation {
    warehouse: string
    line: string
    shelf: string
    slot: string
    boxNumber: string
    fullCode: string // Kxx-Dxx-Gxx-Nxx-Hxx
}

export interface ImportData {
    files: ExtractedFile[]
    documents: ExtractedDocument[]
    boxes: ExtractedLocation[]
}
