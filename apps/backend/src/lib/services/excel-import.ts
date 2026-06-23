import type { Prisma } from '@/generated/prisma/client'
import { db } from '@/lib/db'
import { parseExcelFile } from '@/lib/excel-parser'
import { createAuditLog } from '@/lib/services/audit-log'
import { getAgencyForYear } from '@/lib/services/agency-history'
import type { ExcelImportPreview, ImportIssue } from '@/lib/validation/import'

type ImportPayload = Awaited<ReturnType<typeof parseExcelFile>>

function normalizeCode(code: unknown) {
  return String(code ?? '').trim()
}

function buildIssue(row: number, column: string, message: string, code?: string): ImportIssue {
  return { row, column, message, code, severity: 'error' }
}

export async function parseExcelUpload(file: File): Promise<ImportPayload> {
  const buffer = await file.arrayBuffer()
  return parseExcelFile(buffer)
}

export async function previewExcelImport(payload: ImportPayload): Promise<ExcelImportPreview> {
  const issues: ImportIssue[] = []
  const codes = payload.files.map((file) => normalizeCode(file.code))
  const codeCounts = new Map<string, number>()

  codes.forEach((code) => {
    if (!code) return
    codeCounts.set(code, (codeCounts.get(code) ?? 0) + 1)
  })

  payload.files.forEach((file, index) => {
    const row = index + 2
    const code = normalizeCode(file.code)

    if (!code) issues.push(buildIssue(row, 'Hồ sơ số', 'Thiếu mã hồ sơ'))
    if (!normalizeCode(file.title)) issues.push(buildIssue(row, 'Tiêu đề', 'Thiếu tiêu đề hoặc trích yếu', code))
    if (!normalizeCode(file.type)) issues.push(buildIssue(row, 'Loại án', 'Thiếu loại án', code))
    if (!Number.isInteger(file.year) || file.year < 1900 || file.year > 2200) {
      issues.push(buildIssue(row, 'Thời gian', 'Năm hồ sơ không hợp lệ', code))
    }
    if (code && (codeCounts.get(code) ?? 0) > 1) {
      issues.push(buildIssue(row, 'Hồ sơ số', 'Mã hồ sơ bị trùng trong file Excel', code))
    }
  })

  const existingFiles = codes.length
    ? await db.file.findMany({
        where: { code: { in: codes.filter(Boolean) } },
        select: { code: true },
      })
    : []

  const existingCodes = new Set(existingFiles.map((file) => file.code))
  payload.files.forEach((file, index) => {
    const code = normalizeCode(file.code)
    if (code && existingCodes.has(code)) {
      issues.push(buildIssue(index + 2, 'Hồ sơ số', 'Mã hồ sơ đã tồn tại trong hệ thống', code))
    }
  })

  const errorCodes = new Set(issues.filter((issue) => issue.code).map((issue) => issue.code))

  return {
    summary: {
      files: payload.files.length,
      documents: payload.documents.length,
      boxes: payload.boxes.length,
      errors: issues.filter((issue) => issue.severity === 'error').length,
      warnings: issues.filter((issue) => issue.severity === 'warning').length,
    },
    files: payload.files.slice(0, 100).map((file) => {
      const code = normalizeCode(file.code)
      return {
        code,
        title: normalizeCode(file.title),
        type: normalizeCode(file.type),
        year: file.year,
        status: errorCodes.has(code) ? 'error' : 'ready',
      }
    }),
    issues,
  }
}

export async function commitExcelImport(payload: ImportPayload, userId: string) {
  const preview = await previewExcelImport(payload)

  if (preview.summary.errors > 0) {
    return {
      success: false as const,
      preview,
      stats: { success: 0, failure: preview.summary.errors },
    }
  }

  const stats = await db.$transaction(async (tx) => {
    for (const box of payload.boxes) {
      const filesInBox = payload.files.filter(
        (file) => file.boxCode === box.boxNumber || file.boxCode === `H${box.boxNumber}`
      )
      const agency = filesInBox[0]?.year ? await getAgencyForYear(filesInBox[0].year) : null

      await tx.storageBox.upsert({
        where: { code: box.fullCode },
        update: { agencyId: agency?.id },
        create: {
          code: box.fullCode,
          warehouse: box.warehouse,
          line: box.line,
          shelf: box.shelf,
          slot: box.slot,
          boxNumber: box.boxNumber,
          agencyId: agency?.id,
        },
      })
    }

    let success = 0

    for (const fileData of payload.files) {
      const matchingBox = payload.boxes.find(
        (box) => box.boxNumber === fileData.boxCode || box.boxNumber === `H${fileData.boxCode}`
      )

      const createdFile = await tx.file.create({
        data: {
          code: normalizeCode(fileData.code),
          title: normalizeCode(fileData.title),
          type: normalizeCode(fileData.type),
          year: fileData.year,
          datetime: fileData.startDate || new Date(fileData.year, 0, 1),
          pageCount: fileData.pageCount,
          retention: fileData.retention,
          judgmentDate: fileData.startDate,
          details: fileData.details as Prisma.InputJsonValue,
          isLocked: true,
          note: fileData.note,
          indexCode: fileData.indexCode,
          judgmentNumber: fileData.judgmentNumber,
          defendants: fileData.defendants ?? [],
          plaintiffs: fileData.plaintiffs ?? [],
          civilDefendants: fileData.civilDefendants ?? [],
          box: matchingBox ? { connect: { code: matchingBox.fullCode } } : undefined,
          documents: {
            create: payload.documents
              .filter((document) => document.fileCode === fileData.code)
              .map((document) => ({
                title: document.title,
                code: document.code,
                year: document.year,
                pageCount: document.pageCount,
                order: document.order,
                note: document.note,
                preservationTime: document.preservationTime,
                contentIndex: document.contentIndex,
              })),
          },
        },
      })

      await tx.auditLog.create({
        data: {
          action: 'CREATE',
          target: 'File',
          targetId: createdFile.id,
          userId,
          detail: { code: createdFile.code, source: 'Excel Import' },
        },
      })

      success += 1
    }

    return { success, failure: 0 }
  }, {
    maxWait: 10000, // 10 giây để chờ kết nối
    timeout: 120000 // 120 giây (2 phút) để xử lý dữ liệu
  })

  await createAuditLog({
    action: 'UPLOAD',
    target: 'File',
    userId,
    detail: { source: 'Excel Import', stats },
  })

  return { success: true as const, preview, stats }
}
