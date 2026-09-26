import { db } from '@/lib/db'
import { buildCaseTypeGroups, compareCaseTypes, isBlankCaseType } from '@/lib/case-type-cleanup'
import { createAuditLog } from '@/lib/services/audit-log'

type Actor = { userId: string; ipAddress: string }

/** Hồ sơ đã xoá mềm bị ẩn khỏi danh sách chính, nên cũng nằm ngoài phạm vi chuẩn hoá. */
const LIVE_FILE = { NOT: { status: 'ARCHIVED' } } as const

export class CaseTypeCleanupError extends Error {
  constructor(message: string, readonly status: 400 | 404 | 409) {
    super(message)
  }
}

async function countCaseTypes() {
  const [boxRows, fileRows] = await Promise.all([
    db.storageBox.groupBy({ by: ['caseType'], _count: { _all: true } }),
    db.file.groupBy({ by: ['type'], where: LIVE_FILE, _count: { _all: true } }),
  ])
  return {
    boxCounts: boxRows.map((row) => ({ value: row.caseType, count: row._count._all })),
    fileCounts: fileRows.map((row) => ({ value: row.type, count: row._count._all })),
  }
}

export async function listCaseTypes() {
  const { boxCounts, fileCounts } = await countCaseTypes()
  return buildCaseTypeGroups(boxCounts, fileCounts)
}

export async function renameCaseType({ from, to }: { from: unknown; to: unknown }, actor: Actor) {
  if (typeof from !== 'string' || isBlankCaseType(from)) {
    throw new CaseTypeCleanupError('Không thể đổi tên nhóm chưa có Loại án', 400)
  }
  const next = typeof to === 'string' ? to.trim() : ''
  if (!next) throw new CaseTypeCleanupError('Loại án mới không được để trống', 400)
  if (next === from) throw new CaseTypeCleanupError('Loại án mới trùng với giá trị cũ', 400)

  const result = await db.$transaction(async (tx) => {
    const [boxes, files] = await Promise.all([
      tx.storageBox.findMany({ where: { caseType: from }, select: { id: true } }),
      tx.file.findMany({ where: { type: from, ...LIVE_FILE }, select: { id: true } }),
    ])
    const boxIds = boxes.map((box) => box.id)
    const fileIds = files.map((file) => file.id)
    // Lặp lại điều kiện giá trị cũ: bản ghi bị sửa song song sau findMany sẽ không bị ghi đè.
    const boxResult = boxIds.length
      ? await tx.storageBox.updateMany({ where: { id: { in: boxIds }, caseType: from }, data: { caseType: next } })
      : { count: 0 }
    const fileResult = fileIds.length
      ? await tx.file.updateMany({ where: { id: { in: fileIds }, type: from }, data: { type: next } })
      : { count: 0 }
    return { boxIds, fileIds, boxesUpdated: boxResult.count, filesUpdated: fileResult.count }
  })

  await createAuditLog({
    action: 'UPDATE',
    target: 'CaseType',
    userId: actor.userId,
    ipAddress: actor.ipAddress,
    detail: { operation: 'rename', from, to: next, boxIds: result.boxIds, fileIds: result.fileIds },
  })

  return { boxesUpdated: result.boxesUpdated, filesUpdated: result.filesUpdated }
}

export async function listBlankCaseTypeRecords() {
  const { boxCounts, fileCounts } = await countCaseTypes()
  const blankBoxValues = boxCounts.map((row) => row.value).filter((value): value is string => value !== null && isBlankCaseType(value))
  const blankFileValues = fileCounts.map((row) => row.value).filter((value): value is string => value !== null && isBlankCaseType(value))

  const [boxes, files] = await Promise.all([
    db.storageBox.findMany({
      where: { OR: [{ caseType: null }, { caseType: { in: blankBoxValues } }] },
      select: { id: true, code: true, boxNumber: true, warehouse: true, line: true, shelf: true, slot: true },
      orderBy: { boxNumber: 'asc' },
    }),
    blankFileValues.length
      ? db.file.findMany({
          where: { type: { in: blankFileValues }, ...LIVE_FILE },
          select: { id: true, code: true, title: true, year: true, box: { select: { id: true, boxNumber: true, caseType: true } } },
          orderBy: { code: 'asc' },
        })
      : Promise.resolve([]),
  ])

  const suggestions = [...new Set([...boxCounts, ...fileCounts].filter((row) => !isBlankCaseType(row.value)).map((row) => row.value!.trim()))]
    .sort(compareCaseTypes)

  return {
    boxes,
    files: files.map((file) => ({
      ...file,
      box: file.box ? { ...file.box, caseType: isBlankCaseType(file.box.caseType) ? null : file.box.caseType } : null,
    })),
    suggestions,
  }
}

export async function fillBlankCaseType({ kind, id, value }: { kind: unknown; id: unknown; value: unknown }, actor: Actor) {
  if (kind !== 'box' && kind !== 'file') throw new CaseTypeCleanupError('Loại bản ghi không hợp lệ', 400)
  if (typeof id !== 'string' || !id) throw new CaseTypeCleanupError('Thiếu ID bản ghi', 400)
  const next = typeof value === 'string' ? value.trim() : ''
  if (!next) throw new CaseTypeCleanupError('Loại án không được để trống', 400)

  if (kind === 'box') {
    const box = await db.storageBox.findUnique({ where: { id }, select: { caseType: true } })
    if (!box) throw new CaseTypeCleanupError('Không tìm thấy Hộp', 404)
    if (!isBlankCaseType(box.caseType)) throw new CaseTypeCleanupError('Hộp này đã có Loại án', 409)
    const { count } = await db.storageBox.updateMany({ where: { id, caseType: box.caseType }, data: { caseType: next } })
    if (count === 0) throw new CaseTypeCleanupError('Hộp này đã có Loại án', 409)
  } else {
    const file = await db.file.findUnique({ where: { id }, select: { type: true, status: true } })
    if (!file || file.status === 'ARCHIVED') throw new CaseTypeCleanupError('Không tìm thấy Hồ sơ', 404)
    if (!isBlankCaseType(file.type)) throw new CaseTypeCleanupError('Hồ sơ này đã có Loại án', 409)
    const { count } = await db.file.updateMany({ where: { id, type: file.type }, data: { type: next } })
    if (count === 0) throw new CaseTypeCleanupError('Hồ sơ này đã có Loại án', 409)
  }

  await createAuditLog({
    action: 'UPDATE',
    target: kind === 'box' ? 'StorageBox' : 'File',
    targetId: id,
    userId: actor.userId,
    ipAddress: actor.ipAddress,
    detail: { operation: 'fill-case-type', value: next },
  })

  return { ok: true as const }
}
