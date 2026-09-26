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

export type BlankCaseTypeRecords = {
  boxes: { id: string; code: string; boxNumber: string; warehouse: string; line: string; shelf: string; slot: string }[]
  files: {
    id: string
    code: string
    title: string
    year: number | null
    box: { id: string; boxNumber: string; caseType: string | null } | null
  }[]
  suggestions: string[]
}

export type RenameTarget =
  | { kind: 'invalid'; reason: string }
  | { kind: 'merge'; value: string; boxCount: number; fileCount: number }
  | { kind: 'new'; value: string }

/** Cho admin biết giá trị vừa gõ sẽ gộp vào nhóm có sẵn hay tạo Loại án mới. */
export function describeRenameTarget(groups: CaseTypeGroup[], from: string, input: string): RenameTarget {
  const value = input.trim().normalize('NFC')
  if (!value) return { kind: 'invalid', reason: 'Loại án mới không được để trống' }
  if (value === from) return { kind: 'invalid', reason: 'Loại án mới trùng với giá trị cũ' }
  const existing = groups.find((group) => group.value === value)
  if (existing) return { kind: 'merge', value, boxCount: existing.boxCount, fileCount: existing.fileCount }
  return { kind: 'new', value }
}

/** Hiện khoảng trắng thừa thành "·" để phân biệt "Hình sự" và "Hình sự ". */
export function showWhitespace(value: string) {
  return value.replace(/^\s+|\s+$/g, (match) => '·'.repeat(match.length)).replace(/\s{2,}/g, (match) => '·'.repeat(match.length))
}
