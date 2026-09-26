import { describe, expect, test } from 'bun:test'
import * as XLSX from 'xlsx'
import { parseExcelFile } from './excel-parser'

describe('excel-parser with new 12-column format', () => {
  function workbook(row: Record<string, unknown>) {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([row]), 'Hồ sơ')
    return XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  }

  test('preserves parties and judgment fields across slash spacing, NFD and whitespace', async () => {
    const result = await parseExcelFile(workbook({
      'Hồ sơ số': 'HS-1',
      ['  Nguyên đơn/\nngười bị hại  '.normalize('NFD')]: 'Người A',
      'Bị cáo/bị đơn': 'Người B',
      'Số bản án/quyết định': '01/2023',
      'Ngày bản án/quyết định': '15/04/2023',
    }))
    expect(result.files[0].plaintiffs).toEqual(['Người A'])
    expect(result.files[0].defendants).toEqual(['Người B'])
    expect(result.files[0].judgmentNumber).toBe('01/2023')
    expect(result.files[0].startDate?.toISOString()).toBe('2023-04-14T17:00:00.000Z')
  })

  test('reports duplicate normalized headers as an error instead of selecting a column silently', async () => {
    const result = await parseExcelFile(workbook({ 'Bị cáo/bị đơn': 'A', 'Bị cáo/ bị đơn': 'B' }))
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ severity: 'error', message: expect.stringContaining('trùng') })]))
  })

  test('matches headers case-insensitively', async () => {
    const result = await parseExcelFile(workbook({ 'HỒ SƠ SỐ': 'HS-1', 'Bị Cáo/Bị Đơn': 'Người B' }))
    expect(result.files[0].code).toBe('HS-1')
    expect(result.files[0].defendants).toEqual(['Người B'])
  })

  // Dates are stored as midnight in Vietnam (UTC+7), the same instant the edit forms save from a VN browser.
  for (const tz of ['Asia/Ho_Chi_Minh', 'UTC']) {
    test(`stores real Excel date cells as Vietnam midnight on a ${tz} server`, async () => {
      const previous = process.env.TZ
      process.env.TZ = tz
      try {
        const sheet = XLSX.utils.aoa_to_sheet([['Hồ sơ số', 'Ngày bản án/quyết định', 'Thời gian'], ['HS-1', 'x', 'x']])
        sheet.B2 = { t: 'n', v: 45017, z: 'dd/mm/yyyy' } // 01/04/2023
        sheet.C2 = { t: 'n', v: 44927, z: 'dd/mm/yyyy' } // 01/01/2023
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, sheet, 'Hồ sơ')
        const result = await parseExcelFile(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }))
        expect(result.files[0].startDate?.toISOString()).toBe('2023-03-31T17:00:00.000Z')
        expect(result.files[0].year).toBe(2023)
      } finally {
        process.env.TZ = previous
      }
    })
  }

  test('derives the year from the Vietnam calendar day of a text date', async () => {
    const result = await parseExcelFile(workbook({ 'Hồ sơ số': 'HS-1', 'Ngày bản án/quyết định': '01/01/2023' }))
    expect(result.files[0].startDate?.toISOString()).toBe('2022-12-31T17:00:00.000Z')
    expect(result.files[0].year).toBe(2023)
  })

  test('reports invalid dates as errors, unknown and missing optional columns as warnings', async () => {
    const result = await parseExcelFile(workbook({ 'Hồ sơ số': 'HS-1', 'Nguyên đơn sai': 'A', 'Ngày bản án/quyết định': '31/02/2023' }))
    expect(result.files[0].startDate).toBeUndefined()
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ severity: 'warning', column: 'Nguyên đơn sai' }),
      expect.objectContaining({ severity: 'error', row: 2, column: 'Ngày bản án/ quyết định' }),
      expect.objectContaining({ severity: 'warning', column: 'Nguyên đơn/ người bị hại' }),
    ]))
  })
  test('parses new format excel buffer correctly', async () => {
    const wb = XLSX.utils.book_new()
    const sheet1Data = [
      {
        'Hộp số': 'H01',
        'Hồ sơ số': '2024/HS-ST/01',
        'Số bản án/ quyết định': '45/2024/HS-ST',
        'Ngày bản án/ quyết định': '15/04/2024',
        'Tiêu đề': 'Vụ án trộm cắp tài sản',
        'Nguyên đơn/ người bị hại': 'Nguyễn Văn Bị Hại',
        'Bị cáo/ bị đơn': 'Trần Văn Bị Cáo 1, Lê Văn Bị Cáo 2',
        'Số tờ': 120,
        'Loại án': 'Hình sự',
        'Thời gian': 2024,
        'THBQ': 'Vĩnh viễn',
        'Ghi chú': 'Án điểm',
      },
    ]
    const sheet2Data = [
      {
        'Hồ sơ số': '2024/HS-ST/01',
        'Mục lục văn bản': 'VB-01',
        'Tiêu đề': 'Cáo trạng',
        'Loại án': 'Hình sự',
        'Thời gian': 2024,
        'Số tờ': 10,
        'Thời hạn bảo quản': 'Vĩnh viễn',
        'Ghi chú': 'Bản chính',
      },
    ]

    const ws1 = XLSX.utils.json_to_sheet(sheet1Data)
    const ws2 = XLSX.utils.json_to_sheet(sheet2Data)
    XLSX.utils.book_append_sheet(wb, ws1, 'Thông tin hồ sơ')
    XLSX.utils.book_append_sheet(wb, ws2, 'Mục lục văn bản')
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })

    const result = await parseExcelFile(buffer)
    expect(result.files.length).toBe(1)
    const file = result.files[0]
    expect(file.code).toBe('2024/HS-ST/01')
    expect(file.boxCode).toBe('H01')
    expect(file.judgmentNumber).toBe('45/2024/HS-ST')
    expect(file.title).toBe('Vụ án trộm cắp tài sản')
    expect(file.plaintiffs).toEqual(['Nguyễn Văn Bị Hại'])
    expect(file.defendants).toEqual(['Trần Văn Bị Cáo 1', 'Lê Văn Bị Cáo 2'])
    expect(file.pageCount).toBe(120)
    expect(file.type).toBe('Hình sự')
    expect(file.year).toBe(2024)
    expect(file.retention).toBe('Vĩnh viễn')
    expect(file.note).toBe('Án điểm')
    expect(file.startDate).toBeDefined()

    expect(result.documents.length).toBe(1)
    expect(result.documents[0].fileCode).toBe('2024/HS-ST/01')
    expect(result.documents[0].title).toBe('Cáo trạng')
  })

  test('parses generated public/templates/mau-ho-so-me.xlsx successfully', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const templatePath = path.resolve(process.cwd(), 'public/templates/mau-ho-so-me.xlsx')
    const buffer = fs.readFileSync(templatePath).buffer
    const result = await parseExcelFile(buffer)
    expect(result.files.length).toBe(5)
    expect(result.files[0].code).toBe('2024/HS-ST/01')
    expect(result.files[0].boxCode).toBe('H01')
    expect(result.files[0].judgmentNumber).toBe('45/2024/HS-ST')
    expect(result.files[0].plaintiffs).toEqual(['Công ty TNHH Xây dựng Việt Nhật'])
    expect(result.files[0].defendants).toEqual(['Nguyễn Văn A', 'Trần Văn B'])
    expect(result.documents.length).toBeGreaterThan(0)
  })

  test('parses mau-ho-so-me 2011 (3).xlsx without errors', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const realFilePath = path.resolve(process.cwd(), 'mau-ho-so-me 2011 (3).xlsx')
    if (fs.existsSync(realFilePath)) {
      const buffer = fs.readFileSync(realFilePath).buffer
      const result = await parseExcelFile(buffer)
      expect(result.files).toBeDefined()
      expect(result.documents).toBeDefined()
    }
  })
})
