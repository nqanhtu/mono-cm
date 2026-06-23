import { z } from 'zod'

export const excelImportCommitSchema = z.object({
  confirm: z.literal('true').or(z.literal(true)).optional(),
})

export type ImportIssue = {
  row: number
  column: string
  code?: string
  message: string
  severity: 'error' | 'warning'
}

export type ExcelImportPreview = {
  summary: {
    files: number
    documents: number
    boxes: number
    errors: number
    warnings: number
  }
  files: Array<{
    code: string
    title: string
    type: string
    year: number
    status: 'ready' | 'error' | 'warning'
  }>
  issues: ImportIssue[]
}
