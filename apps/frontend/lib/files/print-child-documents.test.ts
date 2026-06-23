import { buildChildDocumentListPrintHtml, printChildDocumentList } from '@/lib/files/print-child-documents'
import type { DocumentDto } from '@/lib/api/types'

function createDocument(overrides: Partial<DocumentDto> = {}): DocumentDto {
  return {
    id: 'doc-1',
    fileId: 'file-1',
    title: 'Bản án sơ thẩm',
    pageCount: 12,
    order: 1,
    note: 'Bản chính',
    ...overrides,
  }
}

describe('child document list print helper', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the required columns and parent file information', () => {
    const html = buildChildDocumentListPrintHtml(
      { code: '02/HS/DH', title: 'Hồ sơ vụ án' },
      [createDocument()]
    )

    expect(html).toContain('DANH SÁCH VĂN BẢN TRONG HỒ SƠ')
    expect(html).toContain('Mã hồ sơ:')
    expect(html).toContain('02/HS/DH')
    expect(html).toContain('Trích yếu:')
    expect(html).toContain('Hồ sơ vụ án')
    expect(html).toContain('Số thứ tự')
    expect(html).toContain('Tên văn bản')
    expect(html).toContain('Số tờ')
    expect(html).toContain('Ghi chú')
  })

  it('escapes unsafe document text', () => {
    const html = buildChildDocumentListPrintHtml(
      { code: 'HS-001', title: 'Hồ sơ <test>' },
      [createDocument({ title: '<script>alert("x")</script>', note: "Ghi chú 'đặc biệt'" })]
    )

    expect(html).toContain('Hồ sơ &lt;test&gt;')
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;')
    expect(html).toContain('Ghi chú &#039;đặc biệt&#039;')
    expect(html).not.toContain('<script>alert("x")</script>')
  })

  it('uses document order when present and row index fallback when missing', () => {
    const html = buildChildDocumentListPrintHtml(
      { code: 'HS-001', title: 'Hồ sơ vụ án' },
      [
        createDocument({ id: 'doc-1', order: 7, title: 'Văn bản có số thứ tự' }),
        createDocument({ id: 'doc-2', order: null, title: 'Văn bản fallback' }),
      ]
    )

    expect(html).toContain('<td class="center">7</td>')
    expect(html).toContain('<td class="center">2</td>')
  })

  it('returns false when the print popup is blocked', () => {
    vi.spyOn(window, 'open').mockReturnValue(null)

    const result = printChildDocumentList({ code: 'HS-001', title: 'Hồ sơ vụ án' }, [createDocument()])

    expect(result).toBe(false)
  })

  it('writes print HTML when the popup opens', () => {
    const write = vi.fn()
    const close = vi.fn()
    const focus = vi.fn()
    vi.spyOn(window, 'open').mockReturnValue({
      document: { write, close },
      focus,
    } as unknown as Window)

    const result = printChildDocumentList({ code: 'HS-001', title: 'Hồ sơ vụ án' }, [createDocument()])

    expect(result).toBe(true)
    expect(write).toHaveBeenCalledWith(expect.stringContaining('DANH SÁCH VĂN BẢN TRONG HỒ SƠ'))
    expect(close).toHaveBeenCalled()
    expect(focus).toHaveBeenCalled()
  })
})
