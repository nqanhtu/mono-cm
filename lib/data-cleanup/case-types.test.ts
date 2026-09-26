import { describe, expect, it } from 'vitest'

import { describeRenameTarget, showWhitespace } from '@/lib/data-cleanup/case-types'

const groups = [
  { value: 'Hôn nhân sơ thẩm', boxCount: 364, fileCount: 5586, hasExtraWhitespace: false },
  { value: 'Hơn nhân sơ thẩm', boxCount: 3, fileCount: 0, hasExtraWhitespace: false },
  { value: 'Hình sự ', boxCount: 0, fileCount: 1, hasExtraWhitespace: true },
]

describe('describeRenameTarget', () => {
  it('is invalid when the new value is blank or unchanged', () => {
    expect(describeRenameTarget(groups, 'Hơn nhân sơ thẩm', '   ')).toEqual({ kind: 'invalid', reason: 'Loại án mới không được để trống' })
    expect(describeRenameTarget(groups, 'Hơn nhân sơ thẩm', 'Hơn nhân sơ thẩm')).toEqual({ kind: 'invalid', reason: 'Loại án mới trùng với giá trị cũ' })
  })

  it('reports a merge into an existing group, matching after trim and NFC', () => {
    expect(describeRenameTarget(groups, 'Hơn nhân sơ thẩm', ' Hôn nhân sơ thẩm '.normalize('NFD'))).toEqual({
      kind: 'merge',
      value: 'Hôn nhân sơ thẩm',
      boxCount: 364,
      fileCount: 5586,
    })
  })

  it('reports a new case type when nothing matches', () => {
    expect(describeRenameTarget(groups, 'Hơn nhân sơ thẩm', 'Hôn nhân gia đình')).toEqual({ kind: 'new', value: 'Hôn nhân gia đình' })
  })

  it('treats trimming a whitespace-only variant as a rename to a new value', () => {
    expect(describeRenameTarget(groups, 'Hình sự ', 'Hình sự')).toEqual({ kind: 'new', value: 'Hình sự' })
  })
})

describe('showWhitespace', () => {
  it('makes leading, trailing and repeated spaces visible', () => {
    expect(showWhitespace('Hình sự ')).toBe('Hình sự·')
    expect(showWhitespace(' A  B')).toBe('·A··B')
    expect(showWhitespace('A B')).toBe('A B')
  })
})
