import { compareCaseTypes, isBlankCaseType } from '@/lib/case-type-cleanup'

/** Ngưỡng mức độ theo tỉ lệ Hồ sơ lệch loại trong một Hộp. */
export const WRONG_LABEL_RATIO = 0.5
export const SIGNIFICANT_RATIO = 0.2

export type MismatchKind = 'mixed' | 'label-mismatch' | 'unlabeled'
export type MismatchSeverity = 'wrong-label' | 'significant' | 'minor'

export type BoxWithFiles = {
  id: string
  boxNumber: string
  code: string
  warehouse: string
  line: string
  shelf: string
  slot: string
  caseType: string | null
  files: { id: string; code: string; title: string; year: number | null; type: string }[]
}

export type MismatchedBox = Omit<BoxWithFiles, 'files'> & {
  kind: MismatchKind
  severity: MismatchSeverity
  totalCount: number
  mismatchedCount: number
  mismatchRatio: number
  composition: { caseType: string; count: number }[]
  combo: string
  mismatchedFiles: { id: string; code: string; title: string; year: number | null; caseType: string }[]
}

const SEVERITY_ORDER: Record<MismatchSeverity, number> = { 'wrong-label': 0, significant: 1, minor: 2 }

function severityOf(ratio: number): MismatchSeverity {
  if (ratio > WRONG_LABEL_RATIO) return 'wrong-label'
  if (ratio >= SIGNIFICANT_RATIO) return 'significant'
  return 'minor'
}

function classifyBox({ files, ...box }: BoxWithFiles): MismatchedBox | null {
  const label = isBlankCaseType(box.caseType) ? null : box.caseType!.trim()
  const counted = files
    .filter((file) => !isBlankCaseType(file.type))
    .map((file) => ({ id: file.id, code: file.code, title: file.title, year: file.year, caseType: file.type.trim() }))

  const mismatchedFiles = counted.filter((file) => file.caseType !== label).sort((a, b) => a.code.localeCompare(b.code, 'vi', { numeric: true }))
  if (mismatchedFiles.length === 0) return null

  const counts = new Map<string, number>()
  for (const file of counted) counts.set(file.caseType, (counts.get(file.caseType) ?? 0) + 1)
  const composition = [...counts]
    .map(([caseType, count]) => ({ caseType, count }))
    .sort((a, b) => b.count - a.count || compareCaseTypes(a.caseType, b.caseType))

  const mismatchRatio = mismatchedFiles.length / counted.length
  const kind: MismatchKind = label === null ? 'unlabeled' : composition.length >= 2 ? 'mixed' : 'label-mismatch'

  return {
    ...box,
    caseType: label,
    kind,
    severity: severityOf(mismatchRatio),
    totalCount: counted.length,
    mismatchedCount: mismatchedFiles.length,
    mismatchRatio,
    composition,
    combo: composition.map((item) => item.caseType).sort(compareCaseTypes).join(' + '),
    mismatchedFiles,
  }
}

/** Giữ lại các Hộp có Hồ sơ lệch loại, sắp theo mức độ → tỉ lệ lệch giảm dần → Hộp số. */
export function classifyBoxes(boxes: BoxWithFiles[]): MismatchedBox[] {
  return boxes
    .map(classifyBox)
    .filter((box): box is MismatchedBox => box !== null)
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        b.mismatchRatio - a.mismatchRatio ||
        a.boxNumber.localeCompare(b.boxNumber, 'vi', { numeric: true })
    )
}

export function summarizeMismatchedBoxes(boxes: MismatchedBox[]) {
  const bySeverity: Record<MismatchSeverity, number> = { 'wrong-label': 0, significant: 0, minor: 0 }
  const byKind: Record<MismatchKind, number> = { mixed: 0, 'label-mismatch': 0, unlabeled: 0 }
  let mismatchedFiles = 0
  for (const box of boxes) {
    bySeverity[box.severity] += 1
    byKind[box.kind] += 1
    mismatchedFiles += box.mismatchedCount
  }
  return { totalBoxes: boxes.length, mismatchedFiles, bySeverity, byKind }
}
