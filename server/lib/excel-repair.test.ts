import { describe, expect, test } from 'bun:test'
import { assertReviewedPlan, buildRepairPlan, digest, type RepairRecord } from './excel-repair'
import type { ImportData } from './types/excel'

const source = (): ImportData => ({ files: [{ code: 'HS-1', title: 'Vụ án A', type: 'Hình sự', year: 2023, boxCode: '12', pageCount: 1, retention: '', plaintiffs: ['A'], defendants: ['B'], judgmentNumber: '1/2023', startDate: new Date('2023-04-15T00:00:00Z') }], documents: [], boxes: [] })
const record = (): RepairRecord => ({ id: 'id-1', code: 'HS-1', title: 'Vụ án A', type: 'Hình sự', year: 2023, boxCode: 'H12', boxNumber: '12', updatedAt: '2026-09-26T00:00:00Z', plaintiffs: [], defendants: [], civilDefendants: [], judgmentNumber: null, judgmentDate: null, details: { summary: 'keep' } })
describe('reviewed Excel repair', () => {
  test('fills missing values and preserves unrelated JSON; a second plan makes no changes', () => {
    const before = record()
    const plan = buildRepairPlan(source(), [before], 'test', 'sha')
    expect(plan.blockers).toEqual([])
    expect(plan.summary.fields).toEqual({ plaintiffs: 1, defendants: 1, judgmentNumber: 1, judgmentDate: 1 })
    expect(plan.changes[0].patch.details?.summary).toBe('keep')
    expect(before.plaintiffs).toEqual([])
    const rerun = buildRepairPlan(source(), [{ ...before, ...plan.changes[0].patch }], 'test', 'sha')
    expect(rerun.changes).toEqual([])
  })
  test('never clears a value from an empty source or guesses an invalid date', () => {
    const input = source()
    input.files[0].plaintiffs = undefined
    input.files[0].startDate = undefined
    input.issues = [{ column: 'Ngày bản án/ quyết định', row: 2, severity: 'error', message: 'Invalid date' }]
    const plan = buildRepairPlan(input, [{ ...record(), plaintiffs: ['existing'] }], 'test', 'sha')
    expect(plan.changes[0].patch).not.toHaveProperty('plaintiffs')
    expect(plan.changes[0].patch).not.toHaveProperty('judgmentDate')
    expect(plan.notes).toHaveLength(1)
  })
  test('blocks identity mismatch, duplicate or missing codes', () => {
    for (const field of ['title', 'type', 'year', 'boxNumber'] as const) {
      const changed = { ...record(), [field]: field === 'year' ? 2024 : 'different' }
      expect(buildRepairPlan(source(), [changed], 'test', 'sha').blockers.length).toBeGreaterThan(0)
    }
    expect(buildRepairPlan(source(), [], 'test', 'sha').blockers).toHaveLength(1)
    const input = source(); input.files.push(input.files[0])
    expect(buildRepairPlan(input, [record()], 'test', 'sha').blockers).toHaveLength(1)
  })
  test('blocks conflicting relational and JSON values and ambiguous civil defendants', () => {
    for (const changed of [{ plaintiffs: ['other'] }, { details: { defendants: ['other'] } }, { civilDefendants: ['other'] }]) {
      const plan = buildRepairPlan(source(), [{ ...record(), ...changed }], 'test', 'sha')
      expect(plan.blockers.length).toBeGreaterThan(0)
      expect(() => assertReviewedPlan(plan, digest(plan), 'test')).toThrow()
    }
  })
  test('requires exact reviewed content and database', () => {
    const plan = buildRepairPlan(source(), [record()], 'test', 'sha')
    const approved = digest(plan)
    expect(() => assertReviewedPlan(plan, approved, 'test')).not.toThrow()
    expect(() => assertReviewedPlan(plan, approved, 'other')).toThrow()
    plan.changes[0].patch.plaintiffs = ['tampered']
    expect(() => assertReviewedPlan(plan, approved, 'test')).toThrow()
  })
})
