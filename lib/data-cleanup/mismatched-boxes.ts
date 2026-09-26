export type MismatchKind = 'mixed' | 'label-mismatch' | 'unlabeled'
export type MismatchSeverity = 'wrong-label' | 'significant' | 'minor'

export type MismatchedBox = {
  id: string
  boxNumber: string
  code: string
  warehouse: string
  line: string
  shelf: string
  slot: string
  caseType: string | null
  kind: MismatchKind
  severity: MismatchSeverity
  totalCount: number
  mismatchedCount: number
  mismatchRatio: number
  composition: { caseType: string; count: number }[]
  combo: string
  mismatchedFiles: { id: string; code: string; title: string; year: number | null; caseType: string }[]
}

export type MismatchedBoxesResponse = {
  summary: {
    totalBoxes: number
    mismatchedFiles: number
    bySeverity: Record<MismatchSeverity, number>
    byKind: Record<MismatchKind, number>
  }
  boxes: MismatchedBox[]
}

export const SEVERITY_ORDER: MismatchSeverity[] = ['wrong-label', 'significant', 'minor']
export const KIND_ORDER: MismatchKind[] = ['mixed', 'label-mismatch', 'unlabeled']

export const SEVERITY_LABELS: Record<MismatchSeverity, string> = {
  'wrong-label': 'Nhãn sai',
  significant: 'Lẫn đáng kể',
  minor: 'Lệch lẻ',
}

export const SEVERITY_HINTS: Record<MismatchSeverity, string> = {
  'wrong-label': 'Hơn 50% hồ sơ khác nhãn hộp',
  significant: 'Từ 20% hồ sơ khác nhãn hộp',
  minor: 'Dưới 20% hồ sơ khác nhãn hộp',
}

export const KIND_LABELS: Record<MismatchKind, string> = {
  mixed: 'Lẫn nhiều loại án',
  'label-mismatch': 'Nhãn khác hồ sơ',
  unlabeled: 'Hộp chưa có nhãn',
}

/**
 * Gán mỗi Loại án một slot màu cố định theo tổng số hồ sơ trên toàn bộ danh sách,
 * để cùng một Loại án luôn cùng màu ở mọi Hộp (màu theo thực thể, không theo thứ hạng trong Hộp).
 */
export function assignCaseTypeSlots(boxes: MismatchedBox[], slotCount: number) {
  const totals = new Map<string, number>()
  for (const box of boxes) {
    for (const item of box.composition) totals.set(item.caseType, (totals.get(item.caseType) ?? 0) + item.count)
  }
  const ordered = [...totals].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'vi')).map(([caseType]) => caseType)
  return new Map(ordered.map((caseType, index) => [caseType, index < slotCount ? index : null]))
}

export type MismatchFilters = {
  severity: MismatchSeverity | null
  kind: MismatchKind | null
  combo: string | null
}

export function filterMismatchedBoxes(boxes: MismatchedBox[], filters: MismatchFilters) {
  return boxes.filter(
    (box) =>
      (!filters.severity || box.severity === filters.severity) &&
      (!filters.kind || box.kind === filters.kind) &&
      (!filters.combo || box.combo === filters.combo)
  )
}

export function comboOptions(boxes: MismatchedBox[]) {
  const counts = new Map<string, number>()
  for (const box of boxes) counts.set(box.combo, (counts.get(box.combo) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'vi')).map(([combo, count]) => ({ combo, count }))
}
