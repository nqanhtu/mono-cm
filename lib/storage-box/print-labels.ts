import JsBarcode from 'jsbarcode'
import type { StorageBoxDto } from '@/lib/api/types'

export type StorageBoxLabelPrintMode = 'single' | 'grid'

export type StorageBoxLabelPrintItem = {
  box: StorageBoxDto
  qrDataUrl: string
  qrUrl: string
}

export function printStorageBoxLabels(items: StorageBoxLabelPrintItem[], mode: StorageBoxLabelPrintMode) {
  const printWindow = window.open('', '_blank', 'width=1000,height=1200')
  if (!printWindow) return false

  printWindow.document.write(buildStorageBoxLabelsHtml(items, mode))
  printWindow.document.close()
  printWindow.focus()
  return true
}

function generateBarcodeSvg(text: string): string {
  if (typeof document === 'undefined') return ''
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  try {
    JsBarcode(svg, text, {
      format: 'CODE39',
      width: 1.5,
      height: 40,
      displayValue: false,
      margin: 0,
    })
    return svg.outerHTML
  } catch (err) {
    console.error('Failed to generate barcode SVG:', err)
    return ''
  }
}

function buildStorageBoxLabelsHtml(items: StorageBoxLabelPrintItem[], mode: StorageBoxLabelPrintMode) {
  const isSingle = mode === 'single'
  const labels = items.map((item) => buildLabelHtml(item, isSingle)).join('')

  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>In nhãn QR hộp lưu trữ</title>
  <style>
    @page { size: A4; margin: ${isSingle ? '18mm' : '10mm'}; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #fff;
      color: #111827;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
    }
    .sheet {
      display: grid;
      grid-template-columns: ${isSingle ? '1fr' : '1fr 1fr'};
      gap: ${isSingle ? '0' : '8mm'};
      align-items: start;
    }
    .label {
      border: 1.5px solid #111827;
      border-radius: 6px;
      padding: ${isSingle ? '16px' : '10px'};
      min-height: ${isSingle ? '125mm' : '59mm'};
      page-break-inside: avoid;
      display: grid;
      grid-template-columns: ${isSingle ? '170px 1fr' : '92px 1fr'};
      gap: ${isSingle ? '18px' : '10px'};
    }
    .qr {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }
    .qr img {
      width: ${isSingle ? '160px' : '88px'};
      height: ${isSingle ? '160px' : '88px'};
      image-rendering: crisp-edges;
    }
    .barcode-container {
      width: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      margin-top: 2px;
    }
    .barcode-container svg {
      max-width: 100%;
      height: ${isSingle ? '35px' : '20px'};
    }
    .code {
      max-width: 100%;
      text-align: center;
      font-family: "Courier New", monospace;
      font-weight: 700;
      overflow-wrap: anywhere;
    }
    .title {
      margin: 0 0 8px;
      font-size: ${isSingle ? '20px' : '14px'};
      text-transform: uppercase;
      letter-spacing: 0;
    }
    .meta {
      display: grid;
      gap: ${isSingle ? '8px' : '5px'};
    }
    .row {
      display: grid;
      grid-template-columns: ${isSingle ? '120px 1fr' : '76px 1fr'};
      gap: 6px;
      align-items: baseline;
    }
    .label-name {
      color: #4b5563;
      font-size: ${isSingle ? '12px' : '10px'};
    }
    .value {
      font-weight: 700;
      overflow-wrap: anywhere;
    }
    .location {
      display: inline-block;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      padding: 3px 6px;
      font-family: "Courier New", monospace;
      font-weight: 700;
    }
    .files {
      border-top: 1px solid #d1d5db;
      margin-top: 8px;
      padding-top: 8px;
      font-size: ${isSingle ? '12px' : '10px'};
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .label { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <main class="sheet">${labels}</main>
  <script>
    window.addEventListener('load', function () {
      window.print();
    });
  </script>
</body>
</html>`
}

function buildLabelHtml({ box, qrDataUrl, qrUrl }: StorageBoxLabelPrintItem, isSingle: boolean) {
  const location = [box.warehouse, box.line, box.shelf, box.slot, box.boxNumber].filter(Boolean).join(' - ')
  const fileRange = box.fromFileCode || box.toFileCode
    ? `${box.fromFileCode || '?'} - ${box.toFileCode || '?'}`
    : '-'
  
  const barcodeSvg = generateBarcodeSvg(box.code)

  return `<section class="label">
    <div class="qr">
      <img src="${escapeHtml(qrDataUrl)}" alt="QR ${escapeHtml(box.code)}" />
      <div class="barcode-container">
        ${barcodeSvg}
      </div>
      <div class="code">${escapeHtml(box.code)}</div>
    </div>
    <div>
      <h1 class="title">Hộp lưu trữ</h1>
      <div class="meta">
        <div class="row"><span class="label-name">Vị trí</span><span class="value location">${escapeHtml(location)}</span></div>
        <div class="row"><span class="label-name">Phông</span><span class="value">${escapeHtml(box.agency?.name || '-')}</span></div>
        <div class="row"><span class="label-name">Loại hồ sơ</span><span class="value">${escapeHtml(box.caseType || '-')}</span></div>
        <div class="row"><span class="label-name">Năm</span><span class="value">${escapeHtml(String(box.year || '-'))}</span></div>
        <div class="row"><span class="label-name">Bảo quản</span><span class="value">${escapeHtml(box.retention || '-')}</span></div>
      </div>
      <div class="files">
        <div><strong>Từ/đến số hồ sơ:</strong> ${escapeHtml(fileRange)}</div>
        <div><strong>Số hồ sơ trong hộp:</strong> ${escapeHtml(String(box._count?.files ?? 0))}</div>
        ${isSingle ? `<div><strong>Đường dẫn QR:</strong> ${escapeHtml(qrUrl)}</div>` : ''}
      </div>
    </div>
  </section>`
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
