import { describe, expect, it } from 'bun:test'

import { classifyBoxes, summarizeMismatchedBoxes, type BoxWithFiles } from '@/lib/mismatched-boxes'

let fileSeq = 0
function files(type: string, count: number) {
  return Array.from({ length: count }, () => {
    fileSeq += 1
    return { id: `f${fileSeq}`, code: `HS-${String(fileSeq).padStart(3, '0')}`, title: `Hồ sơ ${fileSeq}`, year: 2000, type }
  })
}

function box(boxNumber: string, caseType: string | null, contents: ReturnType<typeof files>): BoxWithFiles {
  return { id: `box-${boxNumber}`, boxNumber, code: `C-${boxNumber}`, warehouse: '01', line: '01', shelf: '01', slot: '01', caseType, files: contents }
}

describe('classifyBoxes', () => {
  it('drops boxes whose files all match the label', () => {
    expect(classifyBoxes([box('1', 'Hình sự sơ thẩm', files('Hình sự sơ thẩm', 5))])).toEqual([])
  })

  it('compares after trimming but does not ignore spelling differences', () => {
    expect(classifyBoxes([box('1', ' Dân sự sơ thẩm ', files('Dân sự sơ thẩm ', 3))])).toEqual([])

    const [result] = classifyBoxes([box('2', 'Hình sự', files('Hình sự sơ thẩm', 4))])
    expect(result.kind).toBe('label-mismatch')
    expect(result.mismatchedCount).toBe(4)
  })

  it('ignores blank file case types', () => {
    expect(classifyBoxes([box('1', 'Dân sự sơ thẩm', [...files('Dân sự sơ thẩm', 3), ...files('  ', 2)])])).toEqual([])
  })

  it('classifies a box holding several case types as mixed', () => {
    const [result] = classifyBoxes([box('420', 'Dân sự sơ thẩm', [...files('Dân sự sơ thẩm', 8), ...files('Hôn nhân sơ thẩm', 8)])])
    expect(result.kind).toBe('mixed')
    expect(result.totalCount).toBe(16)
    expect(result.mismatchedCount).toBe(8)
    expect(result.mismatchRatio).toBe(0.5)
    expect(result.combo).toBe('Dân sự sơ thẩm + Hôn nhân sơ thẩm')
  })

  it('classifies a single-type box that differs from its label as label-mismatch', () => {
    const [result] = classifyBoxes([box('9', 'Hôn nhân sơ thẩm', files('Dân sự sơ thẩm', 3))])
    expect(result.kind).toBe('label-mismatch')
    expect(result.severity).toBe('wrong-label')
  })

  it('classifies an unlabeled box with files as unlabeled and always wrong-label', () => {
    const [result] = classifyBoxes([box('191', null, files('Dân sự sơ thẩm', 2))])
    expect(result.kind).toBe('unlabeled')
    expect(result.caseType).toBeNull()
    expect(result.mismatchRatio).toBe(1)
    expect(result.severity).toBe('wrong-label')

    expect(classifyBoxes([box('192', '  ', files('Dân sự sơ thẩm', 1))])[0].kind).toBe('unlabeled')
  })

  it('assigns severity at the 50% and 20% boundaries', () => {
    const severity = (matching: number, off: number) =>
      classifyBoxes([box('1', 'A', [...files('A', matching), ...files('B', off)])])[0].severity

    expect(severity(4, 6)).toBe('wrong-label') // 60%
    expect(severity(5, 5)).toBe('significant') // exactly 50% is not a majority
    expect(severity(8, 2)).toBe('significant') // exactly 20%
    expect(severity(9, 1)).toBe('minor') // 10%
  })

  it('lists composition by count desc and only mismatched files, sorted by code', () => {
    const [result] = classifyBoxes([box('7', 'A', [...files('C', 1), ...files('A', 3), ...files('B', 2)])])
    expect(result.composition).toEqual([
      { caseType: 'A', count: 3 },
      { caseType: 'B', count: 2 },
      { caseType: 'C', count: 1 },
    ])
    expect(result.mismatchedFiles.map((file) => file.caseType)).toEqual(['C', 'B', 'B'])
    expect(result.mismatchedFiles.map((file) => file.code)).toEqual([...result.mismatchedFiles.map((file) => file.code)].sort())
    expect(result.combo).toBe('A + B + C')
  })

  it('sorts by severity, then mismatch ratio desc, then natural box number', () => {
    const result = classifyBoxes([
      box('10', 'A', [...files('A', 9), ...files('B', 1)]), // minor 10%
      box('2', 'A', [...files('A', 9), ...files('B', 1)]), // minor 10%
      box('3', 'A', [...files('A', 1), ...files('B', 3)]), // wrong-label 75%
      box('4', 'A', [...files('A', 7), ...files('B', 3)]), // significant 30%
      box('5', 'A', [...files('A', 3), ...files('B', 2)]), // significant 40%
    ])
    expect(result.map((item) => item.boxNumber)).toEqual(['3', '5', '4', '2', '10'])
  })
})

describe('summarizeMismatchedBoxes', () => {
  it('counts boxes by severity and kind and totals mismatched files', () => {
    const boxes = classifyBoxes([
      box('1', 'A', [...files('A', 1), ...files('B', 3)]),
      box('2', 'A', files('B', 2)),
      box('3', null, files('A', 1)),
      box('4', 'A', [...files('A', 9), ...files('B', 1)]),
    ])
    expect(summarizeMismatchedBoxes(boxes)).toEqual({
      totalBoxes: 4,
      mismatchedFiles: 7,
      bySeverity: { 'wrong-label': 3, significant: 0, minor: 1 },
      byKind: { mixed: 2, 'label-mismatch': 1, unlabeled: 1 },
    })
  })
})
