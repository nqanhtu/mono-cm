import { Elysia } from 'elysia'
import type { Prisma } from '@/generated/prisma/client'

import { db } from '@/lib/db'
import { apiError, apiSuccess, jsonError, type AppSet } from '@/lib/http'
import { getClientIp } from '@/lib/request'
import { sessionOrDenied, isUploadedFile } from '@/api-routes/_shared'
import { createAuditLog } from '@/lib/services/audit-log'
import { commitExcelImport, parseExcelUpload, previewExcelImport } from '@/lib/services/excel-import'
import { parseChildDocumentsExcel, parseExcelFile } from '@/lib/excel-parser'

export const uploadRoutes = new Elysia()
  .post('/api/upload/excel', async ({ request, set }) => importExcelCommit(request, set, 'Upload error:'))
  .post('/api/upload/excel/commit', async ({ request, set }) => importExcelCommit(request, set, 'Excel commit error:'))
  .post('/api/upload/excel/preview', async ({ request, set }) => {
    try {
      const { denied } = await sessionOrDenied({ request, set }, 'manageFiles')
      if (denied) return denied
      const formData = await request.formData()
      const file = formData.get('file')
      if (!isUploadedFile(file)) return apiError(set, 'Vui lòng chọn file Excel', 400)
      return apiSuccess(await previewExcelImport(await parseExcelUpload(file)))
    } catch (error) {
      console.error('Excel preview error:', error)
      return apiError(set, error instanceof Error ? error.message : 'Không thể đọc file Excel', 500)
    }
  })
  .post('/api/upload/child-documents', async ({ request, set }) => importChildDocuments(request, set, 'upload'))
  .post('/api/files/import-child-docs', async ({ request, set }) => importChildDocuments(request, set, 'file'))
  .post('/api/import/files', async ({ request, set }) => legacyImportFiles(request, set))
  .post('/api/upload/excel/patch-boxes', async ({ request, set }) => {
    try {
      const { session, denied } = await sessionOrDenied({ request, set }, 'manageFiles')
      if (denied) return denied

      const formData = await request.formData()
      const file = formData.get('file')
      if (!isUploadedFile(file)) return apiError(set, 'Vui lòng chọn file Excel', 400)

      const payload = await parseExcelUpload(file)
      const normalizeCode = (code: unknown) => String(code ?? '').trim()

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
        const targetFile = fileMap.get(code)

        if (!targetFile) {
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
          where: { id: targetFile.id },
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
    } catch (error) {
      console.error('Patch error:', error)
      return apiError(set, error instanceof Error ? error.message : 'Không thể vá Hộp số từ file Excel', 500)
    }
  })

async function importExcelCommit(request: Request, set: AppSet, logPrefix: string) {
  try {
    const { session, denied } = await sessionOrDenied({ request, set }, 'manageFiles')
    if (denied) return denied
    const formData = await request.formData()
    const file = formData.get('file')
    if (!isUploadedFile(file)) return apiError(set, 'Vui lòng chọn file Excel', 400)
    const result = await commitExcelImport(await parseExcelUpload(file), session!.id)
    if (!result.success) return apiError(set, 'File Excel còn lỗi, chưa thể nhập dữ liệu', 422, result.preview.issues)
    return apiSuccess({ stats: result.stats, preview: result.preview }, 'Nhập dữ liệu thành công')
  } catch (error) {
    console.error(logPrefix, error)
    return apiError(set, error instanceof Error ? error.message : 'Không thể nhập dữ liệu Excel', 500)
  }
}

async function importChildDocuments(request: Request, set: AppSet, mode: 'upload' | 'file') {
  try {
    const { session, denied } = await sessionOrDenied({ request, set }, 'manageFiles')
    if (denied) return denied
    const formData = await request.formData()
    const file = formData.get('file')
    const fileId = formData.get('fileId')
    if (!isUploadedFile(file) || typeof fileId !== 'string' || !fileId) {
      return mode === 'upload' ? apiError(set, !file ? 'No file uploaded' : 'Missing fileId', 400) : jsonError(set, 'Missing fileId or file', 400)
    }
    const documents = await parseChildDocumentsExcel(await file.arrayBuffer()).catch((error) => {
      console.error('Parse error:', error)
      return null
    })
    if (!documents) return jsonError(set, 'Failed to parse Excel file', 400)
    if (documents.length === 0) return mode === 'upload' ? apiError(set, 'File Excel không có dữ liệu', 400) : jsonError(set, 'No data in file Excel', 400)
    const targetFile = await db.file.findUnique({ where: { id: fileId } })
    if (!targetFile) return mode === 'upload' ? apiError(set, 'Hồ sơ không tồn tại', 404) : jsonError(set, 'File not found', 404)
    if (targetFile.isLocked && session!.role !== 'SUPER_ADMIN') {
      return mode === 'upload' 
        ? apiError(set, 'Hồ sơ đã bị khóa, không thể nhập thêm tài liệu con', 403) 
        : jsonError(set, 'Hồ sơ đã bị khóa', 403)
    }
    let successCount = 0
    let failureCount = 0
    const errors: string[] = []
    for (const document of documents) {
      try {
        await db.document.create({ data: { fileId, code: document.code || null, title: document.title || (mode === 'upload' ? 'Văn bản' : 'Văn bản chưa đặt tên'), year: document.year, pageCount: document.pageCount, order: document.order, note: document.note, preservationTime: document.preservationTime, contentIndex: document.contentIndex } })
        successCount += 1
      } catch (error) {
        failureCount += 1
        errors.push(`Row ${document.order}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
    await createAuditLog({ action: mode === 'upload' ? 'UPDATE' : 'UPLOAD', target: mode === 'upload' ? 'File' : 'Document', targetId: fileId, userId: session?.id, ipAddress: getClientIp(request), detail: mode === 'upload' ? { action: 'Import Child Documents', count: successCount } : { filename: file.name, total: documents.length, success: successCount, failed: failureCount, errors: errors.length > 0 ? errors : undefined } })
    return mode === 'upload'
      ? { success: true, stats: { success: successCount, failure: failureCount }, errors }
      : { success: true, fileId, successCount, failureCount, errors }
  } catch (error) {
    console.error('Upload documents error:', error)
    return mode === 'upload' ? apiError(set, error instanceof Error ? error.message : 'Unknown error', 500) : jsonError(set, 'Failed to upload file', 500)
  }
}

async function legacyImportFiles(request: Request, set: AppSet) {
  try {
    const { session, denied } = await sessionOrDenied({ request, set }, 'manageFiles')
    if (denied) return denied
    const formData = await request.formData()
    const file = formData.get('file')
    if (!isUploadedFile(file)) return jsonError(set, 'Không tìm thấy file tải lên', 400)
    const { files } = await parseExcelFile(await file.arrayBuffer())
    if (!files || files.length === 0) return jsonError(set, 'Không có dữ liệu hợp lệ trong file Excel', 400)

    const codes = files.map(f => f.code).filter(Boolean) as string[]
    const lockedFiles = await db.file.findMany({
      where: {
        code: { in: codes },
        isLocked: true,
      },
      select: { code: true }
    })
    if (lockedFiles.length > 0 && session!.role !== 'SUPER_ADMIN') {
      return jsonError(set, `Không thể nhập đè lên hồ sơ đã bị khóa: ${lockedFiles.map(f => f.code).join(', ')}`, 403)
    }

    const createdFiles = []
    for (const importedFile of files) {
      if (!importedFile.code) continue
      let boxId: string | null = null
      if (importedFile.boxCode) {
        let box = await db.storageBox.findUnique({ where: { code: importedFile.boxCode } })
        if (!box) {
          box = await db.storageBox.create({ data: { code: importedFile.boxCode, warehouse: 'Chưa xếp', line: '-', shelf: '-', slot: '-', boxNumber: importedFile.boxCode } })
        }
        boxId = box.id
      }
      const payload = {
        title: importedFile.title || 'Hồ sơ chưa có tiêu đề',
        type: importedFile.type || 'Không xác định',
        year: importedFile.year,
        pageCount: importedFile.pageCount,
        retention: importedFile.retention,
        note: importedFile.note,
        indexCode: importedFile.indexCode,
        judgmentNumber: importedFile.judgmentNumber,
        judgmentDate: importedFile.startDate,
        datetime: importedFile.startDate || new Date(`${importedFile.year || new Date().getFullYear()}-01-01`),
        defendants: importedFile.defendants || [],
        plaintiffs: importedFile.plaintiffs || [],
        civilDefendants: importedFile.civilDefendants || [],
        details: importedFile.details as Prisma.InputJsonValue,
        boxId,
      }
      createdFiles.push(await db.file.upsert({ where: { code: importedFile.code }, update: payload, create: { code: importedFile.code, ...payload, status: 'IN_STOCK', isLocked: false } }))
    }
    await createAuditLog({ action: 'CREATE', target: 'File', targetId: 'batch_import', userId: session?.id, ipAddress: getClientIp(request), detail: { count: createdFiles.length, type: 'Excel Import' } })
    return { success: true, message: `Nhập thành công ${createdFiles.length} hồ sơ`, count: createdFiles.length }
  } catch (error) {
    console.error('Error importing excel:', error)
    set.status = 500
    return { success: false, error: error instanceof Error ? error.message : 'Lỗi hệ thống khi nhập Excel' }
  }
}
