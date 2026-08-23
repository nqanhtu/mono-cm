# Thiết Kế Cập Nhật Định Dạng Import Excel Hồ Sơ Theo Mẫu Mới

## 1. Tổng quan & Mục tiêu
- Chuyển đổi toàn bộ hệ thống import hồ sơ vụ án từ định dạng cũ (sử dụng cột gộp chuỗi `:` / `Chi tiết`) sang định dạng chuẩn hóa mới theo mẫu `mau-ho-so-me 2011 (3).xlsx`.
- Loại bỏ tính năng tương thích ngược (Backward Compatibility) của cột chuỗi đa dòng cũ để code tinh gọn, rõ ràng và giảm thiểu lỗi logic.
- Đồng bộ file template mẫu tải về trên UI và cập nhật toàn bộ test suite.

## 2. Cấu trúc File Excel Mới

### Sheet 1: `Thông tin hồ sơ` (Hồ sơ mẹ) - 12 Cột
1. `Hộp số`: Mã hộp lưu trữ (ví dụ: `H01`, `1`).
2. `Hồ sơ số`: Mã định danh hồ sơ vụ án (bắt buộc, duy nhất).
3. `Số bản án/ quyết định`: Số hiệu văn bản bản án/quyết định (lưu vào `File.judgmentNumber`).
4. `Ngày bản án/ quyết định`: Ngày ra bản án/quyết định (hỗ trợ Date object của Excel, serial number, chuỗi `DD/MM/YYYY` hoặc `YYYY-MM-DD` -> lưu vào `File.judgmentDate` và `File.datetime`).
5. `Tiêu đề`: Trích yếu / Tên hồ sơ vụ án (bắt buộc, lưu vào `File.title`).
6. `Nguyên đơn/ người bị hại`: Danh sách nguyên đơn/bị hại, phân tách bởi dấu `,` hoặc `;` (lưu vào mảng `File.plaintiffs`).
7. `Bị cáo/ bị đơn`: Danh sách bị cáo/bị đơn, phân tách bởi dấu `,` hoặc `;` (lưu vào mảng `File.defendants`).
8. `Số tờ`: Số tờ của hồ sơ (số nguyên, lưu vào `File.pageCount`).
9. `Loại án`: Phân loại án (Hình sự, Dân sự, Hành chính, Hôn nhân gia đình, Kinh doanh thương mại, Lao động... -> lưu vào `File.type`).
10. `Thời gian`: Năm của hồ sơ (số 4 chữ số, lưu vào `File.year`).
11. `THBQ`: Thời hạn bảo quản (Vĩnh viễn, 50 năm, 15 năm... -> lưu vào `File.retention`).
12. `Ghi chú`: Ghi chú bổ sung (lưu vào `File.note`).

### Sheet 2: `Mục lục văn bản` (Văn bản con) - 8 Cột
1. `Hồ sơ số`: Mã hồ sơ cha (liên kết với Sheet 1).
2. `Mục lục văn bản`: Mã định danh hoặc thứ tự văn bản con.
3. `Tiêu đề`: Tên văn bản.
4. `Loại án`: Loại án của văn bản.
5. `Thời gian`: Năm ban hành văn bản.
6. `Số tờ`: Số trang/tờ của văn bản.
7. `Thời hạn bảo quản`: Thời hạn bảo quản văn bản.
8. `Ghi chú`: Ghi chú văn bản.

## 3. Kiến trúc Kỹ thuật & Thay đổi

### 3.1. Parser (`server/lib/excel-parser.ts`)
- Đọc trực tiếp các header cột từ Sheet 1 theo danh sách 12 cột chuẩn.
- Loại bỏ hoàn toàn hàm `parseDetails()` và logic xử lý cột `:` / `Chi tiết`.
- Bổ sung helper `parseDate()` để xử lý linh hoạt các định dạng ngày Excel (Excel serial date number, string `DD/MM/YYYY`, `YYYY-MM-DD`, `Date`).
- Bổ sung helper `parseNameList()` để phân tách chuỗi tên thành mảng (`string[]`), loại bỏ phần tử rỗng và trim khoảng trắng.

### 3.2. Import Service (`server/lib/services/excel-import.ts`)
- Validation:
  - Bắt buộc các trường: `Hồ sơ số`, `Tiêu đề`, `Loại án`, `Thời gian` (năm hợp lệ 1900-2200).
  - Cảnh báo hoặc kiểm tra trùng lặp mã hồ sơ trong file và cơ sở dữ liệu.
- Lưu trữ vào DB (`File` model):
  - Ánh xạ trực tiếp `judgmentNumber`, `judgmentDate`, `plaintiffs`, `defendants`.
  - Nếu `judgmentDate` có giá trị, gán `datetime = judgmentDate`, nếu không fallback `new Date(year, 0, 1)`.

### 3.3. Template & Scripts
- Cập nhật script `scripts/generate-sample-excel.ts` để tạo file template theo định dạng 12 cột mới với dữ liệu mẫu trực quan.
- Chạy script tạo mới `public/templates/mau-ho-so-me.xlsx` (và `dist/templates/mau-ho-so-me.xlsx`).

### 3.4. Kiểm thử
- Cập nhật test contract `server/contracts/upload.contract.test.ts` để sử dụng cấu trúc mẫu mới.
- Đảm bảo toàn bộ test case upload/import chạy thành công.
