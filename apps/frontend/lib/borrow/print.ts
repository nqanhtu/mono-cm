import type { BorrowSlipWithDetails } from '@/lib/types/borrow'
import type { FileDto, UserDto } from '@/lib/api/types'

export type BorrowSlipPrintVariant = 'request' | 'handover'

type BorrowSlipDraftInput = {
  borrowerName: string
  borrowerUnit?: string | null
  borrowerTitle?: string | null
  reason?: string | null
  borrowDate: string | Date
  dueDate: string | Date
  files: FileDto[]
  lender?: UserDto | null
}

export function getBorrowSlipPrintVariant(status?: string | null): BorrowSlipPrintVariant {
  return status === 'PENDING_APPROVAL' || status === 'REJECTED' ? 'request' : 'handover'
}

export function buildBorrowSlipDraft(input: BorrowSlipDraftInput): BorrowSlipWithDetails {
  const lender = input.lender ?? {
    id: 'draft-lender',
    username: 'draft',
    fullName: 'Cán bộ lập phiếu',
    role: 'COORDINATOR',
    status: true,
  }

  return {
    id: 'draft',
    code: 'BẢN NHÁP',
    borrowerName: input.borrowerName,
    borrowerUnit: input.borrowerUnit,
    borrowerTitle: input.borrowerTitle,
    reason: input.reason,
    borrowDate: input.borrowDate,
    dueDate: input.dueDate,
    status: 'PENDING_APPROVAL',
    lenderId: lender.id,
    lender,
    items: input.files.map((file, index) => ({
      id: `draft-item-${index}`,
      borrowSlipId: 'draft',
      fileId: file.id,
      file,
      status: 'REQUESTED',
    })),
  }
}

export function printBorrowSlip(slip: BorrowSlipWithDetails, variant = getBorrowSlipPrintVariant(slip.status)) {
  const printWindow = window.open('', '_blank', 'width=900,height=1200')
  if (!printWindow) return false

  printWindow.document.write(buildBorrowSlipPrintHtml(slip, variant))
  printWindow.document.close()
  printWindow.focus()
  return true
}

export function buildBorrowSlipPrintHtml(slip: BorrowSlipWithDetails, variant: BorrowSlipPrintVariant) {
  const title = variant === 'request' ? 'PHIẾU YÊU CẦU MƯỢN HỒ SƠ' : 'PHIẾU GIAO NHẬN HỒ SƠ'
  const statusLabel = getStatusLabel(slip.status)
  const rows = slip.items.map((item, index) => {
    const file = item.file
    const location = file.box
      ? [file.box.warehouse, file.box.line, file.box.shelf, file.box.slot, file.box.boxNumber].filter(Boolean).join('-')
      : '-'

    return `
      <tr>
        <td class="center">${index + 1}</td>
        <td>${escapeHtml(file.code)}</td>
        <td>${escapeHtml(file.title)}</td>
        <td>${escapeHtml(file.type || '-')}</td>
        <td class="center">${escapeHtml(String(file.year ?? '-'))}</td>
        <td>${escapeHtml(location)}</td>
      </tr>
    `
  }).join('')

  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)} - ${escapeHtml(slip.code)}</title>
  <style>
    @page { size: A4; margin: 16mm; }
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
    .header {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      text-align: center;
      margin-bottom: 22px;
    }
    .header strong { display: block; font-size: 13px; }
    .underline { display: inline-block; border-bottom: 1px solid #111827; padding-bottom: 3px; }
    h1 {
      margin: 12px 0 4px;
      text-align: center;
      font-size: 20px;
      letter-spacing: 0;
    }
    .code { text-align: center; margin-bottom: 22px; font-weight: bold; }
    .meta {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 24px;
      margin-bottom: 14px;
    }
    .meta div { min-height: 22px; }
    .label { font-weight: bold; }
    .reason {
      border: 1px solid #d1d5db;
      min-height: 52px;
      padding: 8px;
      margin: 8px 0 16px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      font-size: 13px;
    }
    th, td {
      border: 1px solid #111827;
      padding: 6px;
      vertical-align: top;
    }
    th { text-align: center; background: #f3f4f6; font-weight: bold; }
    .center { text-align: center; }
    .note {
      margin-top: 12px;
      font-style: italic;
      color: #374151;
    }
    .signatures {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-top: 34px;
      text-align: center;
      page-break-inside: avoid;
    }
    .signature-title { font-weight: bold; text-transform: uppercase; }
    .signature-sub { font-style: italic; font-size: 13px; }
    .signature-space { height: 76px; }
    .footer-date { text-align: right; margin-top: 20px; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <main class="page">
    <section class="header">
      <div>
        <span class="underline">BỘ PHẬN LƯU TRỮ</span>
      </div>
      <div>
        <strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong>
        <span class="underline">Độc lập - Tự do - Hạnh phúc</span>
      </div>
    </section>

    <h1>${escapeHtml(title)}</h1>
    <div class="code">Mã phiếu: ${escapeHtml(slip.code)} | Trạng thái: ${escapeHtml(statusLabel)}</div>

    <section class="meta">
      <div><span class="label">Người mượn:</span> ${escapeHtml(slip.borrowerName)}</div>
      <div><span class="label">Chức danh:</span> ${escapeHtml(slip.borrowerTitle || '-')}</div>
      <div><span class="label">Đơn vị:</span> ${escapeHtml(slip.borrowerUnit || '-')}</div>
      <div><span class="label">Cán bộ lập phiếu:</span> ${escapeHtml(slip.lender?.fullName || '-')}</div>
      <div><span class="label">Ngày lập:</span> ${escapeHtml(formatDate(slip.borrowDate))}</div>
      <div><span class="label">Hạn trả:</span> ${escapeHtml(formatDate(slip.dueDate))}</div>
    </section>

    <div class="label">Mục đích/Ghi chú mượn hồ sơ:</div>
    <div class="reason">${escapeHtml(slip.reason || '-')}</div>

    <div class="label">Danh sách hồ sơ:</div>
    <table>
      <thead>
        <tr>
          <th style="width: 36px;">STT</th>
          <th style="width: 100px;">Mã hồ sơ</th>
          <th>Tiêu đề hồ sơ</th>
          <th style="width: 90px;">Loại</th>
          <th style="width: 58px;">Năm</th>
          <th style="width: 120px;">Vị trí</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="6" class="center">Chưa có hồ sơ</td></tr>'}
      </tbody>
    </table>

    <p class="note">
      ${variant === 'request'
        ? 'Phiếu này là yêu cầu mượn hồ sơ, chỉ có giá trị xuất kho sau khi được phê duyệt.'
        : 'Phiếu này xác nhận việc giao nhận hồ sơ giữa bộ phận lưu trữ và người mượn.'}
    </p>

    <div class="footer-date">Ngày ...... tháng ...... năm ........</div>
    <section class="signatures">
      <div>
        <div class="signature-title">Người mượn</div>
        <div class="signature-sub">(Ký, ghi rõ họ tên)</div>
        <div class="signature-space"></div>
        <div>${escapeHtml(slip.borrowerName)}</div>
      </div>
      <div>
        <div class="signature-title">Cán bộ lưu trữ</div>
        <div class="signature-sub">(Ký, ghi rõ họ tên)</div>
        <div class="signature-space"></div>
        <div>${escapeHtml(slip.lender?.fullName || '')}</div>
      </div>
      <div>
        <div class="signature-title">Người duyệt</div>
        <div class="signature-sub">(Ký, ghi rõ họ tên)</div>
        <div class="signature-space"></div>
        <div></div>
      </div>
    </section>
  </main>
  <script>
    window.addEventListener('load', function () {
      window.print();
    });
  </script>
</body>
</html>`
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING_APPROVAL: 'Chờ duyệt',
    APPROVED: 'Đã duyệt',
    REJECTED: 'Từ chối',
    EXPORTED: 'Đang mượn',
    PARTIAL_RETURN: 'Trả một phần',
    RETURNED: 'Đã trả',
    OVERDUE: 'Quá hạn',
  }
  return labels[status] || status
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('vi-VN')
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
