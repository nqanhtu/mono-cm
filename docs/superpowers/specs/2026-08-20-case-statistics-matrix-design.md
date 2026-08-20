# Thiết kế Tính năng: Thống kê Hồ sơ Án theo Loại và Năm (Case Statistics Matrix)

## 1. Tổng quan
Tính năng "Thống kê hồ sơ án" bổ sung vào phân hệ **Báo cáo & Thống kê** (`/reports`) cho phép người dùng tra cứu, phân tích và xuất báo cáo số lượng hồ sơ án theo từng loại án và từng năm thụ lý/lưu trữ (ví dụ: *Án dân sự sơ thẩm năm 2014 có tổng bao nhiêu án*).

## 2. Mục tiêu & Yêu cầu chức năng
- **Bảng ma trận tổng hợp (Pivot Matrix):** Hiển thị dạng bảng trực quan: Hàng là danh mục các Loại án, Cột là các Năm, Cột cuối là Tổng cộng theo loại án, Hàng cuối là Tổng cộng theo năm.
- **Biểu đồ trực quan:** Biểu đồ cột phân bố số lượng án qua các năm và phân theo loại án (Recharts Bar Chart).
- **Bộ lọc linh hoạt:** Lọc theo khoảng năm (Từ năm - Đến năm, chọn nhanh 5 năm, 10 năm hoặc toàn bộ).
- **Drill-down xem chi tiết:** Nhấp vào số lượng tại bất kỳ ô nào (ví dụ: Án Dân sự sơ thẩm năm 2014) sẽ mở Dialog hiển thị danh sách các hồ sơ tương ứng.
- **Kết xuất báo cáo Excel:** Xuất file Excel ma trận đầy đủ hàng, cột và các dòng tổng cộng.

---

## 3. Kiến trúc & Thiết kế Kỹ thuật

### 3.1. Backend API (`server/api-routes/reports.routes.ts`)

#### Endpoint 1: `GET /api/reports/cases-matrix`
* **Quyền hạn truy cập:** Quyền `viewReports`.
* **Query Parameters:**
  - `fromYear` (số nguyên, tùy chọn): Năm bắt đầu.
  - `toYear` (số nguyên, tùy chọn): Năm kết thúc.
* **Xử lý:**
  1. Truy vấn Prisma `db.file.groupBy` theo `['type', 'year']` kết hợp `_count: { id: true }`.
  2. Lấy danh sách các năm duy nhất (`years`), sắp xếp tăng dần.
  3. Lấy danh sách các loại án duy nhất (`types`).
  4. Tạo cấu trúc ma trận `matrix: Array<{ type: string, countsByYear: Record<number, number>, total: number }>`.
  5. Tính tổng số lượng theo từng năm `yearTotals: Record<number, number>` và tổng toàn bộ `grandTotal`.
  6. Tính các chỉ số nhanh: `topType` (loại án nhiều nhất), `peakYear` (năm cao điểm nhất), `totalFiles`.
* **Cấu trúc JSON Response:**
  ```ts
  interface CaseMatrixResponse {
    years: number[]
    types: string[]
    matrix: Array<{
      type: string
      countsByYear: Record<number, number>
      total: number
    }>
    yearTotals: Record<number, number>
    grandTotal: number
    topType: { type: string; count: number } | null
    peakYear: { year: number; count: number } | null
  }
  ```

#### Endpoint 2: `GET /api/reports/cases-matrix/drilldown`
* **Query Parameters:**
  - `year` (số nguyên, bắt buộc): Năm cần xem.
  - `type` (chuỗi, bắt buộc): Loại án cần xem.
* **Response:** Danh sách các hồ sơ án (`id`, `code`, `title`, `datetime`, `year`, `judgmentDate`, `status`, `box.code`).

#### Endpoint 3: Xuất Excel trong `GET /api/reports/export?type=case-matrix&format=xlsx`
* Kết xuất bảng ma trận thành định dạng Excel đa cột (Cột A: Loại án, Cột B..N: Các năm, Cột N+1: Tổng cộng, Hàng cuối: Tổng cộng theo năm).

---

### 3.2. Frontend UI/UX

#### Thành phần chính:
1. **Trang `src/routes/reports/reports-page.tsx`:**
   - Thêm tab `case-stats` ("Thống kê hồ sơ án").
2. **Component `components/reports/case-stats-report.tsx`:**
   - **Thanh công cụ (Filters Toolbar):** Chọn khoảng năm, nút làm mới, nút xuất Excel, nút in ấn.
   - **Thẻ KPI (Summary Cards):** Tổng số án, Loại án phổ biến nhất, Năm cao điểm, Tổng số trang/tài liệu.
   - **Biểu đồ cột (Bar Chart):** Hiển thị số lượng án theo từng năm với các màu phân biệt loại án.
   - **Bảng ma trận (Matrix Table):** Bảng có cột đầu cố định (sticky), ô số liệu có hiệu ứng hover và click để mở drill-down.
3. **Component `components/reports/case-drilldown-dialog.tsx`:**
   - Dialog hiển thị danh sách hồ sơ khi click vào 1 ô số lượng trong bảng ma trận.

---

## 4. Kế hoạch Kiểm thử & Xác thực
- **Unit & Contract Test:** Viết test kiểm tra endpoint `GET /api/reports/cases-matrix` và `GET /api/reports/cases-matrix/drilldown`.
- **UI Test / Verification:** Kiểm tra hiển thị bảng ma trận, chuyển đổi bộ lọc năm, mở popup drill-down và tải file Excel báo cáo.
