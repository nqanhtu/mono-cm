import * as XLSX from 'xlsx'

export function toXlsx(rows: Array<Record<string, unknown>>, sheetName: string, header?: string[]) {
  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.json_to_sheet(rows, header ? { header } : undefined)
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName)
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}
