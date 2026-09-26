import { createHash } from 'node:crypto'
import type { ImportData } from './types/excel'

export type RepairRecord = {
  id: string; code: string; title: string; type: string; year: number | null
  boxCode: string | null; boxNumber: string | null; updatedAt: string
  plaintiffs: string[]; defendants: string[]; civilDefendants: string[]
  judgmentNumber: string | null; judgmentDate: string | null
  details: Record<string, unknown> | null
}
export type RepairFields = Pick<RepairRecord, 'plaintiffs' | 'defendants' | 'judgmentNumber' | 'judgmentDate' | 'details'>
export type RepairChange = { before: RepairRecord; patch: Partial<RepairFields> }
export type RepairPlan = {
  version: 1; database: string; sourceSha256: string; createdAt: string
  changes: RepairChange[]; blockers: string[]; notes: string[]
  summary: { source: number; matched: number; unchanged: number; fields: Record<string, number> }
}
const norm = (v: unknown) => String(v ?? '').normalize('NFC').trim()
const empty = (v: unknown) => v == null || (Array.isArray(v) ? !v.length : !norm(v))
function stable(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stable)
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, value]) => [k, stable(value)]))
  return v
}
export const digest = (v: unknown) => createHash('sha256').update(JSON.stringify(stable(v))).digest('hex')
export const same = (a: unknown, b: unknown) => digest(a) === digest(b)

export function buildRepairPlan(input: ImportData, records: RepairRecord[], database: string, sourceSha256: string): RepairPlan {
  const plan: RepairPlan = { version: 1, database, sourceSha256, createdAt: new Date().toISOString(), changes: [], blockers: [], notes: [], summary: { source: input.files.length, matched: 0, unchanged: 0, fields: {} } }
  for (const issue of input.issues ?? []) {
    const description = `Dòng ${issue.row}, ${issue.column}: ${issue.message}`
    if (issue.severity === 'error' && issue.column !== 'Ngày bản án/ quyết định') plan.blockers.push(description)
    else plan.notes.push(description)
  }
  const map = new Map(records.map(row => [row.code, row]))
  const seen = new Set<string>()
  for (const file of input.files) {
    const code = norm(file.code)
    if (!code || seen.has(code)) { plan.blockers.push(`Mã hồ sơ rỗng hoặc trùng: ${code}`); continue }
    seen.add(code)
    const before = map.get(code)
    if (!before) { plan.blockers.push(`Không tìm thấy hồ sơ: ${code}`); continue }
    plan.summary.matched++
    if (norm(before.title) !== norm(file.title) || norm(before.type) !== norm(file.type) || before.year !== file.year || ![norm(before.boxCode), norm(before.boxNumber)].includes(norm(file.boxCode))) {
      plan.blockers.push(`Không khớp tiêu đề/loại án/năm/hộp: ${code}`); continue
    }
    if (before.details !== null && (typeof before.details !== 'object' || Array.isArray(before.details))) {
      plan.blockers.push(`details không phải object: ${code}`); continue
    }
    const patch: Partial<RepairFields> = {}
    const details = { ...(before.details ?? {}) }
    let detailsChanged = false
    const candidates: [keyof Omit<RepairFields, 'details'>, unknown][] = [
      ['plaintiffs', file.plaintiffs], ['defendants', file.defendants],
      ['judgmentNumber', file.judgmentNumber], ['judgmentDate', file.startDate?.toISOString()],
    ]
    for (const [key, value] of candidates) {
      if (empty(value)) continue
      if (key === 'defendants' && before.civilDefendants?.length && empty(before.defendants)) {
        plan.blockers.push(`Cần kiểm tra Bị đơn đã có dữ liệu: ${code}`); continue
      }
      if (!empty(before[key]) && !same(before[key], value)) { plan.blockers.push(`Giá trị hiện tại khác Excel: ${code}/${key}`); continue }
      if (!empty(details[key]) && !same(details[key], value)) { plan.blockers.push(`details khác Excel: ${code}/${key}`); continue }
      if (empty(before[key])) {
        Object.assign(patch, { [key]: value })
        plan.summary.fields[key] = (plan.summary.fields[key] ?? 0) + 1
      }
      if (empty(details[key])) { details[key] = value; detailsChanged = true }
    }
    if (detailsChanged) patch.details = details
    if (Object.keys(patch).length) plan.changes.push({ before, patch })
    else plan.summary.unchanged++
  }
  return plan
}

export function assertReviewedPlan(plan: RepairPlan, approvedDigest: string, database: string) {
  if (plan.version !== 1 || plan.database !== database || !approvedDigest || digest(plan) !== approvedDigest) throw new Error('Database hoặc mã duyệt không khớp báo cáo')
  if (plan.blockers.length) throw new Error('Báo cáo còn lỗi đối chiếu; không được ghi dữ liệu')
  for (const change of plan.changes) {
    if (!change.before.id || !change.before.updatedAt) throw new Error('Thiếu bản chụp trước thay đổi')
    for (const key of Object.keys(change.patch)) if (!['plaintiffs', 'defendants', 'judgmentNumber', 'judgmentDate', 'details'].includes(key)) throw new Error('Trường cập nhật ngoài phạm vi')
  }
}
