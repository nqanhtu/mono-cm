import * as XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'

const outputDir = path.resolve(process.cwd(), 'public/templates')
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true })
}

// -------------------------------------------------------------
// 1. GENERATE "mau-ho-so-me.xlsx" (Sheet 1: Hồ sơ mẹ, Sheet 2: Văn bản con)
// -------------------------------------------------------------
const sheet1Data = [
  {
    'Hồ sơ số': '2024/HS-ST/01',
    'Tiêu đề': 'Vụ án Nguyễn Văn A và đồng phạm về tội Trộm cắp tài sản',
    'Loại án': 'Hình sự',
    'Thời gian': 2024,
    'Số tờ': 150,
    'THBQ': 'Vĩnh viễn',
    'Hộp số': 'H01',
    'MLHS': 'ML-2024-01',
    'Ghi chú': 'Hồ sơ án điểm năm 2024',
    ':': `Về việc: Vụ án Nguyễn Văn A và đồng phạm về tội Trộm cắp tài sản
Bị cáo: Nguyễn Văn A, Trần Văn B
QDTHS: 45/2024/QĐ-ST
Ngày: 15/04/2024`,
  },
  {
    'Hồ sơ số': '2024/DS-ST/02',
    'Tiêu đề': 'Vụ án tranh chấp hợp đồng chuyển nhượng quyền sử dụng đất',
    'Loại án': 'Dân sự',
    'Thời gian': 2024,
    'Số tờ': 85,
    'THBQ': '50 năm',
    'Hộp số': 'H01',
    'MLHS': 'ML-2024-01',
    'Ghi chú': 'Đã thi hành án xong',
    ':': `Về việc: Vụ án tranh chấp hợp đồng chuyển nhượng quyền sử dụng đất
Nguyên đơn: Lê Thị C
Bị đơn: Phạm Văn D
Số: 12/2024/DS-ST
Ngày: 20/05/2024`,
  },
  {
    'Hồ sơ số': '2024/HC-ST/03',
    'Tiêu đề': 'Vụ án khiếu kiện quyết định xử phạt hành chính trong lĩnh vực đất đai',
    'Loại án': 'Hành chính',
    'Thời gian': 2024,
    'Số tờ': 60,
    'THBQ': '15 năm',
    'Hộp số': 'H02',
    'MLHS': 'ML-2024-02',
    'Ghi chú': 'Lưu trữ tại kho B',
    ':': `Về việc: Vụ án khiếu kiện quyết định xử phạt hành chính trong lĩnh vực đất đai
Nguyên đơn: Hoàng Văn E
Bị đơn: Ủy ban nhân dân quận X
Số: 08/2024/HC-ST
Ngày: 10/06/2024`,
  },
]

const sheet2Data = [
  {
    'Hồ sơ số': '2024/HS-ST/01',
    'Mục lục văn bản': 'VB-01',
    'Tiêu đề': 'Cáo trạng số 15/CT-VKS của Viện kiểm sát nhân dân',
    'Loại án': 'Hình sự',
    'Thời gian': 2024,
    'Số tờ': 10,
    'Thời hạn bảo quản': 'Vĩnh viễn',
    'Ghi chú': 'Bản gốc',
  },
  {
    'Hồ sơ số': '2024/HS-ST/01',
    'Mục lục văn bản': 'VB-02',
    'Tiêu đề': 'Bản án hình sự sơ thẩm số 45/2024/HS-ST',
    'Loại án': 'Hình sự',
    'Thời gian': 2024,
    'Số tờ': 15,
    'Thời hạn bảo quản': 'Vĩnh viễn',
    'Ghi chú': 'Bản chính',
  },
  {
    'Hồ sơ số': '2024/DS-ST/02',
    'Mục lục văn bản': 'VB-01',
    'Tiêu đề': 'Đơn khởi kiện của nguyên đơn Lê Thị C',
    'Loại án': 'Dân sự',
    'Thời gian': 2024,
    'Số tờ': 5,
    'Thời hạn bảo quản': '50 năm',
    'Ghi chú': 'Bản chính',
  },
  {
    'Hồ sơ số': '2024/DS-ST/02',
    'Mục lục văn bản': 'VB-02',
    'Tiêu đề': 'Hợp đồng chuyển nhượng quyền sử dụng đất',
    'Loại án': 'Dân sự',
    'Thời gian': 2024,
    'Số tờ': 8,
    'Thời hạn bảo quản': '50 năm',
    'Ghi chú': 'Bản sao công chứng',
  },
]

const wbMother = XLSX.utils.book_new()

const wsMother1 = XLSX.utils.json_to_sheet(sheet1Data)
wsMother1['!cols'] = [
  { wch: 18 }, { wch: 45 }, { wch: 12 }, { wch: 10 }, { wch: 10 },
  { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 25 }, { wch: 60 },
]

const wsMother2 = XLSX.utils.json_to_sheet(sheet2Data)
wsMother2['!cols'] = [
  { wch: 18 }, { wch: 18 }, { wch: 45 }, { wch: 12 }, { wch: 10 },
  { wch: 10 }, { wch: 18 }, { wch: 20 },
]

XLSX.utils.book_append_sheet(wbMother, wsMother1, 'Thông tin hồ sơ')
XLSX.utils.book_append_sheet(wbMother, wsMother2, 'Mục lục văn bản')

const pathMother = path.join(outputDir, 'mau-ho-so-me.xlsx')
XLSX.writeFile(wbMother, pathMother)
console.log(`✅ Đã tạo file mẫu Hồ sơ mẹ: ${pathMother}`)

// -------------------------------------------------------------
// 2. GENERATE "mau-van-ban-con.xlsx" (Mục lục văn bản / Hồ sơ con)
// -------------------------------------------------------------
const childDocData = [
  {
    'Mục lục văn bản': 'VB-01',
    'Tiêu đề': 'Cáo trạng số 15/CT-VKS của Viện kiểm sát nhân dân',
    'Loại án': 'Hình sự',
    'Thời gian': 2024,
    'Số tờ': 12,
    'Thời hạn bảo quản': 'Vĩnh viễn',
    'Ghi chú': 'Bản gốc',
  },
  {
    'Mục lục văn bản': 'VB-02',
    'Tiêu đề': 'Bản án hình sự sơ thẩm số 45/2024/HS-ST',
    'Loại án': 'Hình sự',
    'Thời gian': 2024,
    'Số tờ': 18,
    'Thời hạn bảo quản': 'Vĩnh viễn',
    'Ghi chú': 'Bản chính',
  },
  {
    'Mục lục văn bản': 'VB-03',
    'Tiêu đề': 'Biên bản lấy lời khai bị cáo Nguyễn Văn A',
    'Loại án': 'Hình sự',
    'Thời gian': 2024,
    'Số tờ': 6,
    'Thời hạn bảo quản': '50 năm',
    'Ghi chú': 'Bản gốc',
  },
  {
    'Mục lục văn bản': 'VB-04',
    'Tiêu đề': 'Kết luận giám định pháp y số 102/KLGĐ',
    'Loại án': 'Hình sự',
    'Thời gian': 2024,
    'Số tờ': 4,
    'Thời hạn bảo quản': '50 năm',
    'Ghi chú': 'Bản chính',
  },
  {
    'Mục lục văn bản': 'VB-05',
    'Tiêu đề': 'Biên bản khám nghiệm hiện trường và sơ đồ hiện trường',
    'Loại án': 'Hình sự',
    'Thời gian': 2024,
    'Số tờ': 8,
    'Thời hạn bảo quản': '50 năm',
    'Ghi chú': 'Bản chính đính kèm ảnh chụp',
  },
]

const wbChild = XLSX.utils.book_new()
const wsChild = XLSX.utils.json_to_sheet(childDocData)

wsChild['!cols'] = [
  { wch: 18 }, // Mục lục văn bản
  { wch: 50 }, // Tiêu đề
  { wch: 12 }, // Loại án
  { wch: 10 }, // Thời gian
  { wch: 10 }, // Số tờ
  { wch: 18 }, // Thời hạn bảo quản
  { wch: 30 }, // Ghi chú
]

XLSX.utils.book_append_sheet(wbChild, wsChild, 'Danh mục văn bản con')

const pathChild = path.join(outputDir, 'mau-van-ban-con.xlsx')
XLSX.writeFile(wbChild, pathChild)
console.log(`✅ Đã tạo file mẫu Hồ sơ con: ${pathChild}`)
