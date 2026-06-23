# Thiết kế Tính năng: Thống kê đóng góp nhập liệu theo ngày

Tài liệu thiết kế chi tiết tính năng theo dõi lượng hồ sơ và tài liệu con (văn bản) được tạo bởi từng người dùng, chia nhỏ theo từng ngày.

## Mục tiêu (Goal)
- Cho phép người dùng theo dõi hiệu suất nhập liệu của chính mình.
- Cho phép Quản trị viên (Admin/Super Admin) theo dõi và giám sát hiệu suất nhập liệu của toàn bộ nhân viên trong hệ thống.
- Biểu diễn trực quan hóa dữ liệu qua biểu đồ cột và bảng thống kê chi tiết.

## Phân tích tác động và bảo mật (RBAC & Security)
- **Super Admin / Admin:** Có quyền chọn bất kỳ người dùng nào từ danh sách để xem báo cáo thống kê đóng góp.
- **Viewer / Coordinator / Basic Viewer (Người dùng thông thường):** Chỉ được xem thống kê đóng góp của chính mình. Ô chọn người dùng sẽ bị vô hiệu hóa (disabled) hoặc ẩn đi, tự động điền ID của chính họ.
- **Ràng buộc backend:** API backend bắt buộc phải kiểm tra quyền của phiên làm việc (Session). Nếu người dùng không phải Admin/Super Admin, backend sẽ ghi đè tham số `userId` thành ID của người dùng hiện tại để ngăn chặn việc xem trộm dữ liệu người khác qua API.

---

## Chi tiết Thay đổi Kỹ thuật

### 1. Thay đổi cơ sở dữ liệu (`prisma/schema.prisma`)
Thêm các trường `createdAt` và `updatedAt` vào model `Document`:

```prisma
model Document {
  id               String   @id @default(uuid(7))
  code             String?
  title            String
  year             Int?
  pageCount        Int?
  order            Int?
  contentIndex     String?
  preservationTime String?
  note             String?
  fileId           String
  file             File     @relation(fields: [fileId], references: [id], onDelete: Cascade)
  createdById      String?
  createdBy        User?    @relation("DocumentCreator", fields: [createdById], references: [id])
  updatedById      String?
  updatedBy        User?    @relation("DocumentUpdater", fields: [updatedById], references: [id])

  // Trình theo dõi thời gian mới thêm
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}
```

#### Quy trình Backfill dữ liệu cũ:
Đối với các tài liệu cũ đã có trong cơ sở dữ liệu (chưa có trường `createdAt`), chúng ta sẽ chạy một đoạn lệnh SQL/migration để lấy thời gian `updatedAt` của hồ sơ cha (`File`) cập nhật vào trường `createdAt` của tài liệu con (`Document`).
SQL chạy trong migration hoặc script độc lập:
```sql
UPDATE "Document" d
SET "createdAt" = f."updatedAt", "updatedAt" = f."updatedAt"
FROM "File" f
WHERE d."fileId" = f.id;
```

---

### 2. Thiết kế API Backend (`court-management-api`)
Tạo endpoint mới: `GET /api/reports/contributions` trong file `src/api-routes/reports.routes.ts`.

- **Tham số yêu cầu (Query Params):**
  - `userId` (string, tùy chọn): ID của người dùng cần thống kê.
  - `from` (string, tùy chọn): Ngày bắt đầu lọc (ISO Date String).
  - `to` (string, tùy chọn): Ngày kết thúc lọc (ISO Date String).

- **Thuật toán xử lý trên Backend:**
  1. Kiểm tra Session hiện tại:
     - Nếu vai trò không phải `SUPER_ADMIN` hoặc `ADMIN`, buộc `query.userId = session.id`.
  2. Truy vấn dữ liệu:
     - Thực hiện `db.file.groupBy` theo ngày tạo (`createdAt`), lọc theo `createdById == userId` và trong khoảng thời gian `from` -> `to`.
     - Thực hiện `db.document.groupBy` theo ngày tạo (`createdAt`), lọc theo `createdById == userId` và trong khoảng thời gian `from` -> `to`.
  3. Gộp dữ liệu trong bộ nhớ (In-Memory Merge):
     - Tạo danh sách các ngày liên tục từ `from` đến `to`.
     - Với mỗi ngày, trích xuất số lượng Hồ sơ (`files`) và số lượng Văn bản (`documents`) đã tạo.
     - Tính tổng cộng: `total = files + documents`.
  4. Trả về mảng dữ liệu đã sắp xếp theo thứ tự thời gian tăng dần.

- **Dữ liệu trả về mẫu (Response JSON):**
  ```json
  {
    "userId": "user-uuid-123",
    "fullName": "Nguyễn Văn A",
    "contributions": [
      { "date": "2026-06-15", "files": 3, "documents": 15, "total": 18 },
      { "date": "2026-06-16", "files": 1, "documents": 8, "total": 9 },
      { "date": "2026-06-17", "files": 0, "documents": 0, "total": 0 }
    ]
  }
  ```

---

### 3. Thiết kế Frontend (`court-management`)

#### 3.1. Thêm Tab mới trên Trang Báo cáo
Trong file `components/reports/report-dashboard.tsx` hoặc `src/routes/reports/reports-page.tsx`, chúng ta sẽ tổ chức lại giao diện báo cáo dạng Tab:
- **Tab 1:** Mượn trả gần đây (Giao diện cũ).
- **Tab 2:** Thống kê đóng góp nhập liệu (Giao diện mới).

#### 3.2. Thành phần Giao diện Thống kê Đóng góp (`components/reports/user-contributions-report.tsx`)
1. **Bộ lọc lọc dữ liệu (Filters):**
   - Chọn Nhân viên: Combobox/Select hiển thị danh sách người dùng lấy từ `/api/users`. Chỉ bật cho Admin/Super Admin.
   - Chọn Khoảng thời gian: Nút chọn nhanh (7 ngày qua, 30 ngày qua, Tháng này, Tùy chỉnh).
2. **Thẻ tóm tắt chỉ số (KPI Cards):**
   - **Tổng hồ sơ đã tạo:** Tổng số lượng hồ sơ đã nhập.
   - **Tổng văn bản đã tạo:** Tổng số lượng văn bản con đã nhập.
   - **Tổng lượt nhập:** Tổng số lượng Hồ sơ + Văn bản.
   - **Trung bình ngày:** Tổng số lượng chia cho số ngày có hoạt động.
3. **Biểu đồ đóng góp (Recharts Stacked Bar Chart):**
   - Trục X: Ngày dạng `DD/MM`.
   - Cột chồng (Stacked Bar): Màu xanh dương đại diện cho Hồ sơ, màu xanh lá đại diện cho Văn bản.
4. **Bảng chi tiết (Data Table):**
   - Các cột: Ngày, Số hồ sơ nhập, Số văn bản nhập, Tổng cộng đóng góp.

---

## Kế hoạch kiểm thử & Xác thực (Verification Plan)

### Kiểm thử tự động (Automated Tests)
- **Unit test backend:** Viết kiểm thử xác nhận API `/api/reports/contributions` hoạt động đúng quyền:
  - Nếu đăng nhập bằng Viewer và gửi kèm `userId` của Admin, kết quả trả về phải là của Viewer đó (không bị lộ thông tin của Admin).
  - Kiểm thử logic gộp dữ liệu (merge) hoạt động chuẩn xác khi có cả File và Document cùng ngày.
- **Frontend test:** Kiểm tra component hiển thị đúng thông tin khi danh sách đóng góp trống.

### Xác thực thủ công (Manual Verification)
1. Sử dụng tài khoản Super Admin, chọn tài khoản một Coordinator bất kỳ, kiểm tra biểu đồ và số liệu có khớp với cơ sở dữ liệu không.
2. Sử dụng tài khoản Coordinator đăng nhập, xác thực xem ô Chọn Nhân viên có bị ẩn/vô hiệu hóa hay không, và dữ liệu hiển thị có đúng là của Coordinator đó hay không.
3. Kiểm tra tính năng xuất báo cáo ra Excel/CSV (nếu mở rộng tích hợp sau này).
