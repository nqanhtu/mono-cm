import type { DocumentDto } from '@/lib/api/types'

export type ChildDocumentListPrintParent = {
  code: string
  title: string
}

export function printChildDocumentList(parent: ChildDocumentListPrintParent, documents: DocumentDto[]) {
  const printWindow = window.open('', '_blank', 'width=900,height=1200')
  if (!printWindow) return false

  printWindow.document.write(buildChildDocumentListPrintHtml(parent, documents))
  printWindow.document.close()
  printWindow.focus()
  return true
}

export function buildChildDocumentListPrintHtml(parent: ChildDocumentListPrintParent, documents: DocumentDto[]) {
  const rows = documents.map((doc, index) => `
    <tr>
      <td class="center">${escapeHtml(String(doc.order ?? index + 1))}</td>
      <td>${escapeHtml(doc.title)}</td>
      <td class="center">${escapeHtml(String(doc.pageCount ?? 0))}</td>
      <td>${escapeHtml(doc.note || '')}</td>
    </tr>
  `).join('')

  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>DANH SÁCH VĂN BẢN TRONG HỒ SƠ - ${escapeHtml(parent.code)}</title>
  <style>
    @page { size: A4 portrait; margin: 16mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #111827;
      font-family: "Times New Roman", Times, serif;
      font-size: 14px;
      line-height: 1.45;
      background: #fff;
    }
    .page { width: 100%; min-height: 100%; }
    h1 {
      margin: 0 0 16px;
      text-align: center;
      font-size: 20px;
      letter-spacing: 0;
      text-transform: uppercase;
    }
    .meta {
      margin-bottom: 16px;
      display: grid;
      gap: 6px;
    }
    .label { font-weight: bold; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th, td {
      border: 1px solid #111827;
      padding: 6px;
      vertical-align: top;
    }
    th {
      text-align: center;
      background: #f3f4f6;
      font-weight: bold;
    }
    .center { text-align: center; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <main class="page">
    <h1>DANH SÁCH VĂN BẢN TRONG HỒ SƠ</h1>
    <section class="meta">
      <div><span class="label">Mã hồ sơ:</span> ${escapeHtml(parent.code)}</div>
      <div><span class="label">Trích yếu:</span> ${escapeHtml(parent.title)}</div>
    </section>
    <table>
      <thead>
        <tr>
          <th style="width: 60px;">Số thứ tự</th>
          <th>Tên văn bản</th>
          <th style="width: 70px;">Số tờ</th>
          <th style="width: 170px;">Ghi chú</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  </main>
  <script>
    window.addEventListener('load', function () {
      window.print();
    });
  </script>
</body>
</html>`
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
