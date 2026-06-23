// Script tạo file Excel demo cho chức năng "Thêm hồ sơ con"
// Chạy: node scripts/create-demo-documents.mjs

import * as XLSX from 'xlsx'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ============================
// Dữ liệu mẫu hồ sơ con
// Mỗi hàng là một văn bản (Document) thuộc hồ sơ cha
// ============================
const documents = [
  // --- Hồ sơ HS-1995-001 ---
  {
    'Hồ sơ số':       'HS-1995-001',
    'Mục lục văn bản': 'HS-1995-001-TL01',
    'Tiêu đề':        'Đơn trình báo sự việc',
    'Thời gian':       1995,
    'Số tờ':           4,
    'Thời hạn bảo quản': 'Vĩnh viễn',
    'Ghi chú':         'Người trình báo: Chủ cửa hàng',
  },
  {
    'Hồ sơ số':       'HS-1995-001',
    'Mục lục văn bản': 'HS-1995-001-TL02',
    'Tiêu đề':        'Biên bản khám nghiệm hiện trường',
    'Thời gian':       1995,
    'Số tờ':           6,
    'Thời hạn bảo quản': 'Vĩnh viễn',
    'Ghi chú':         '',
  },
  {
    'Hồ sơ số':       'HS-1995-001',
    'Mục lục văn bản': 'HS-1995-001-TL03',
    'Tiêu đề':        'Bản cáo trạng',
    'Thời gian':       1995,
    'Số tờ':           8,
    'Thời hạn bảo quản': 'Vĩnh viễn',
    'Ghi chú':         'Cáo trạng số 12/1995',
  },
  {
    'Hồ sơ số':       'HS-1995-001',
    'Mục lục văn bản': 'HS-1995-001-TL04',
    'Tiêu đề':        'Bản án hình sự sơ thẩm',
    'Thời gian':       1995,
    'Số tờ':           10,
    'Thời hạn bảo quản': 'Vĩnh viễn',
    'Ghi chú':         'Bản án số 12/1995/HSST ngày 20/06/1995',
  },

  // --- Hồ sơ DS-2021-014 ---
  {
    'Hồ sơ số':       'DS-2021-014',
    'Mục lục văn bản': 'DS-2021-014-TL01',
    'Tiêu đề':        'Đơn khởi kiện',
    'Thời gian':       2021,
    'Số tờ':           3,
    'Thời hạn bảo quản': '20 năm',
    'Ghi chú':         'Nguyên đơn: Công ty TNHH An Phú',
  },
  {
    'Hồ sơ số':       'DS-2021-014',
    'Mục lục văn bản': 'DS-2021-014-TL02',
    'Tiêu đề':        'Hợp đồng vay tài sản số 05/2020/HDVT',
    'Thời gian':       2020,
    'Số tờ':           5,
    'Thời hạn bảo quản': '20 năm',
    'Ghi chú':         'Hợp đồng gốc kèm phụ lục',
  },
  {
    'Hồ sơ số':       'DS-2021-014',
    'Mục lục văn bản': 'DS-2021-014-TL03',
    'Tiêu đề':        'Biên bản hòa giải',
    'Thời gian':       2021,
    'Số tờ':           2,
    'Thời hạn bảo quản': '20 năm',
    'Ghi chú':         'Hòa giải không thành',
  },
  {
    'Hồ sơ số':       'DS-2021-014',
    'Mục lục văn bản': 'DS-2021-014-TL04',
    'Tiêu đề':        'Bản án dân sự sơ thẩm',
    'Thời gian':       2021,
    'Số tờ':           8,
    'Thời hạn bảo quản': '20 năm',
    'Ghi chú':         'Bản án số 14/2021/DS-ST ngày 18/05/2021',
  },
  {
    'Hồ sơ số':       'DS-2021-014',
    'Mục lục văn bản': 'DS-2021-014-TL05',
    'Tiêu đề':        'Quyết định thi hành án',
    'Thời gian':       2021,
    'Số tờ':           2,
    'Thời hạn bảo quản': '20 năm',
    'Ghi chú':         '',
  },

  // --- Hồ sơ HNGD-2022-031 ---
  {
    'Hồ sơ số':       'HNGD-2022-031',
    'Mục lục văn bản': 'HNGD-2022-031-TL01',
    'Tiêu đề':        'Đơn xin ly hôn',
    'Thời gian':       2022,
    'Số tờ':           2,
    'Thời hạn bảo quản': '10 năm',
    'Ghi chú':         'Nguyên đơn: Trần Thị Lan',
  },
  {
    'Hồ sơ số':       'HNGD-2022-031',
    'Mục lục văn bản': 'HNGD-2022-031-TL02',
    'Tiêu đề':        'Giấy đăng ký kết hôn',
    'Thời gian':       2015,
    'Số tờ':           1,
    'Thời hạn bảo quản': '10 năm',
    'Ghi chú':         'Bản sao công chứng',
  },
  {
    'Hồ sơ số':       'HNGD-2022-031',
    'Mục lục văn bản': 'HNGD-2022-031-TL03',
    'Tiêu đề':        'Giấy khai sinh của con chung',
    'Thời gian':       2019,
    'Số tờ':           1,
    'Thời hạn bảo quản': '10 năm',
    'Ghi chú':         '1 con, sinh năm 2019',
  },
  {
    'Hồ sơ số':       'HNGD-2022-031',
    'Mục lục văn bản': 'HNGD-2022-031-TL04',
    'Tiêu đề':        'Biên bản hòa giải đoàn tụ',
    'Thời gian':       2022,
    'Số tờ':           2,
    'Thời hạn bảo quản': '10 năm',
    'Ghi chú':         'Hòa giải không thành',
  },
  {
    'Hồ sơ số':       'HNGD-2022-031',
    'Mục lục văn bản': 'HNGD-2022-031-TL05',
    'Tiêu đề':        'Bản án hôn nhân gia đình sơ thẩm',
    'Thời gian':       2022,
    'Số tờ':           6,
    'Thời hạn bảo quản': '10 năm',
    'Ghi chú':         'Bản án số 31/2022/HNGĐ-ST',
  },

  // --- Hồ sơ KDTM-2023-009 ---
  {
    'Hồ sơ số':       'KDTM-2023-009',
    'Mục lục văn bản': 'KDTM-2023-009-TL01',
    'Tiêu đề':        'Đơn khởi kiện tranh chấp hợp đồng',
    'Thời gian':       2023,
    'Số tờ':           4,
    'Thời hạn bảo quản': '20 năm',
    'Ghi chú':         'Nguyên đơn: Công ty CP Gỗ Nam Việt',
  },
  {
    'Hồ sơ số':       'KDTM-2023-009',
    'Mục lục văn bản': 'KDTM-2023-009-TL02',
    'Tiêu đề':        'Hợp đồng mua bán hàng hóa số HDMB-45/2022',
    'Thời gian':       2022,
    'Số tờ':           8,
    'Thời hạn bảo quản': '20 năm',
    'Ghi chú':         'Kèm 3 phụ lục hợp đồng',
  },
  {
    'Hồ sơ số':       'KDTM-2023-009',
    'Mục lục văn bản': 'KDTM-2023-009-TL03',
    'Tiêu đề':        'Phiếu giao nhận hàng hóa',
    'Thời gian':       2022,
    'Số tờ':           12,
    'Thời hạn bảo quản': '20 năm',
    'Ghi chú':         '12 phiếu giao nhận',
  },
  {
    'Hồ sơ số':       'KDTM-2023-009',
    'Mục lục văn bản': 'KDTM-2023-009-TL04',
    'Tiêu đề':        'Biên bản xác nhận công nợ',
    'Thời gian':       2022,
    'Số tờ':           2,
    'Thời hạn bảo quản': '20 năm',
    'Ghi chú':         '',
  },
  {
    'Hồ sơ số':       'KDTM-2023-009',
    'Mục lục văn bản': 'KDTM-2023-009-TL05',
    'Tiêu đề':        'Bản án kinh doanh thương mại sơ thẩm',
    'Thời gian':       2023,
    'Số tờ':           10,
    'Thời hạn bảo quản': '20 năm',
    'Ghi chú':         'Bản án số 09/2023/KDTM-ST ngày 19/04/2023',
  },
]

// Tạo workbook và worksheet
const ws = XLSX.utils.json_to_sheet(documents, {
  header: [
    'Hồ sơ số',
    'Mục lục văn bản',
    'Tiêu đề',
    'Thời gian',
    'Số tờ',
    'Thời hạn bảo quản',
    'Ghi chú',
  ],
})

// Định dạng độ rộng cột
ws['!cols'] = [
  { wch: 20 }, // Hồ sơ số
  { wch: 25 }, // Mục lục văn bản
  { wch: 45 }, // Tiêu đề
  { wch: 12 }, // Thời gian
  { wch: 10 }, // Số tờ
  { wch: 22 }, // Thời hạn bảo quản
  { wch: 35 }, // Ghi chú
]

const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, 'Hồ sơ con')

const outputPath = join(__dirname, '..', 'demo-ho-so-con.xlsx')
XLSX.writeFile(wb, outputPath)

console.log(`✅ Đã tạo file Excel demo: ${outputPath}`)
console.log(`   Tổng số hồ sơ con: ${documents.length}`)
console.log(`   Thuộc các hồ sơ cha: HS-1995-001, DS-2021-014, HNGD-2022-031, KDTM-2023-009`)
