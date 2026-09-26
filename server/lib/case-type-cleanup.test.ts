import { describe, expect, it } from 'bun:test'

import { buildCaseTypeGroups, caseTypeSortKey, hasExtraWhitespace, isBlankCaseType, trimCaseTypeData } from '@/lib/case-type-cleanup'

describe('trimCaseTypeData', () => {
  it('trims File.type and StorageBox.caseType in single and batch write data', () => {
    expect(trimCaseTypeData('File', { type: ' Hình sự ', title: ' giữ nguyên ' })).toEqual({ type: 'Hình sự', title: ' giữ nguyên ' })
    expect(trimCaseTypeData('StorageBox', { caseType: 'Dân sự ', code: ' X ' })).toEqual({ caseType: 'Dân sự', code: ' X ' })
    expect(trimCaseTypeData('File', [{ type: 'A ' }, { type: ' B' }])).toEqual([{ type: 'A' }, { type: 'B' }])
  })

  it('supports Prisma `{ set: value }` updates and leaves other shapes alone', () => {
    expect(trimCaseTypeData('File', { type: { set: ' A ' } })).toEqual({ type: { set: 'A' } })
    expect(trimCaseTypeData('StorageBox', { caseType: null })).toEqual({ caseType: null })
    expect(trimCaseTypeData('User', { type: ' x ' })).toEqual({ type: ' x ' })
    expect(trimCaseTypeData('File', { title: 'no type' })).toEqual({ title: 'no type' })
  })
})

describe('caseTypeSortKey', () => {
  it('strips Vietnamese diacritics, maps đ to d and lowercases', () => {
    expect(caseTypeSortKey('Hôn Nhân Sơ Thẩm')).toBe('hon nhan so tham')
    expect(caseTypeSortKey('Đất đai')).toBe('dat dai')
  })

  it('puts misspelled variants next to the correct value', () => {
    const values = ['Hình sự sơ thẩm', 'Hơn nhân sơ thẩm', 'Dân sự sơ thẩm', 'Hôn nhân sơ thẩm', 'Hôn nhấn sơ thẩm']
    const sorted = [...values].sort((a, b) => caseTypeSortKey(a).localeCompare(caseTypeSortKey(b)))
    expect(sorted.slice(2)).toEqual(expect.arrayContaining(['Hơn nhân sơ thẩm', 'Hôn nhân sơ thẩm', 'Hôn nhấn sơ thẩm']))
    expect(sorted[0]).toBe('Dân sự sơ thẩm')
    expect(sorted[1]).toBe('Hình sự sơ thẩm')
  })
})

describe('hasExtraWhitespace', () => {
  it('flags leading, trailing and repeated whitespace', () => {
    expect(hasExtraWhitespace('Hình sự ')).toBe(true)
    expect(hasExtraWhitespace(' Hình sự')).toBe(true)
    expect(hasExtraWhitespace('Hình  sự')).toBe(true)
    expect(hasExtraWhitespace('Hình sự')).toBe(true)
  })

  it('does not flag a clean value', () => {
    expect(hasExtraWhitespace('Hình sự sơ thẩm')).toBe(false)
  })
})

describe('isBlankCaseType', () => {
  it('treats null, empty and whitespace-only as blank', () => {
    expect(isBlankCaseType(null)).toBe(true)
    expect(isBlankCaseType('')).toBe(true)
    expect(isBlankCaseType('   ')).toBe(true)
    expect(isBlankCaseType('Dân sự')).toBe(false)
  })
})

describe('buildCaseTypeGroups', () => {
  it('merges box and file counts by exact value and separates blanks', () => {
    const result = buildCaseTypeGroups(
      [
        { value: 'Hôn nhân sơ thẩm', count: 364 },
        { value: 'Hơn nhân sơ thẩm', count: 3 },
        { value: null, count: 1 },
      ],
      [
        { value: 'Hôn nhân sơ thẩm', count: 5586 },
        { value: 'Dân sự', count: 61 },
        { value: 'Hình sự', count: 1 },
        { value: 'Hình sự ', count: 1 },
        { value: '', count: 5 },
      ]
    )

    expect(result.groups).toEqual([
      { value: 'Dân sự', boxCount: 0, fileCount: 61, hasExtraWhitespace: false },
      { value: 'Hình sự', boxCount: 0, fileCount: 1, hasExtraWhitespace: false },
      { value: 'Hình sự ', boxCount: 0, fileCount: 1, hasExtraWhitespace: true },
      { value: 'Hôn nhân sơ thẩm', boxCount: 364, fileCount: 5586, hasExtraWhitespace: false },
      { value: 'Hơn nhân sơ thẩm', boxCount: 3, fileCount: 0, hasExtraWhitespace: false },
    ])
    expect(result.blank).toEqual({ boxCount: 1, fileCount: 5 })
  })

  it('sums several blank variants into the blank bucket', () => {
    const result = buildCaseTypeGroups([{ value: '', count: 2 }, { value: '  ', count: 1 }], [])
    expect(result.groups).toEqual([])
    expect(result.blank).toEqual({ boxCount: 3, fileCount: 0 })
  })
})
