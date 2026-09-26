export type CaseTypeCount = { value: string | null; count: number }

export type CaseTypeGroup = {
  value: string
  boxCount: number
  fileCount: number
  hasExtraWhitespace: boolean
}

export type CaseTypeGroups = {
  groups: CaseTypeGroup[]
  blank: { boxCount: number; fileCount: number }
}

/** Khoá sắp xếp: bỏ dấu tiếng Việt, đ→d, hạ chữ — để các biến thể sai chính tả nằm cạnh nhau. */
export function caseTypeSortKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

export function hasExtraWhitespace(value: string) {
  return value !== value.trim() || /\s{2,}/.test(value) || /[^\S ]/.test(value)
}

export function isBlankCaseType(value: string | null | undefined) {
  return !value || value.trim() === ''
}

const CASE_TYPE_FIELDS: Record<string, string> = { File: 'type', StorageBox: 'caseType' }

function trimValue(value: unknown): unknown {
  if (typeof value === 'string') return value.trim()
  if (value && typeof value === 'object' && 'set' in value && typeof (value as { set: unknown }).set === 'string') {
    return { ...value, set: (value as { set: string }).set.trim() }
  }
  return value
}

/** Trim Loại án (`File.type`, `StorageBox.caseType`) trong `data` của một thao tác ghi Prisma. */
export function trimCaseTypeData(model: string | undefined, data: unknown): unknown {
  const field = model ? CASE_TYPE_FIELDS[model] : undefined
  if (!field) return data
  if (Array.isArray(data)) return data.map((item) => trimCaseTypeData(model, item))
  if (!data || typeof data !== 'object' || !(field in data)) return data
  return { ...data, [field]: trimValue((data as Record<string, unknown>)[field]) }
}

export function compareCaseTypes(a: string, b: string) {
  return caseTypeSortKey(a).localeCompare(caseTypeSortKey(b)) || a.localeCompare(b, 'vi')
}

export function buildCaseTypeGroups(boxCounts: CaseTypeCount[], fileCounts: CaseTypeCount[]): CaseTypeGroups {
  const byValue = new Map<string, CaseTypeGroup>()
  const blank = { boxCount: 0, fileCount: 0 }

  const add = (rows: CaseTypeCount[], key: 'boxCount' | 'fileCount') => {
    for (const { value, count } of rows) {
      if (isBlankCaseType(value)) {
        blank[key] += count
        continue
      }
      const group = byValue.get(value!) ?? { value: value!, boxCount: 0, fileCount: 0, hasExtraWhitespace: hasExtraWhitespace(value!) }
      group[key] += count
      byValue.set(value!, group)
    }
  }

  add(boxCounts, 'boxCount')
  add(fileCounts, 'fileCount')

  return {
    groups: [...byValue.values()].sort((a, b) => compareCaseTypes(a.value, b.value)),
    blank,
  }
}
