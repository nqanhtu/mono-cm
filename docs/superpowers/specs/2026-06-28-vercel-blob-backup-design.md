# Tài liệu thiết kế: Sao lưu cơ sở dữ liệu trên máy chủ (Server Backup) qua JS-Native và Vercel Blob

## 1. Giới thiệu & Mục tiêu
Hiện tại, dự án đang sử dụng công cụ hệ thống `pg_dump` và `pg_restore` để sao lưu và khôi phục cơ sở dữ liệu. Tuy nhiên, khi chạy trên môi trường Serverless của Vercel (AWS Lambda), hệ thống gặp lỗi `FAILED Executable not found in $PATH: "pg_dump"` do môi trường này thiếu các gói postgresql-client.

Tài liệu này thiết kế giải pháp khắc phục lỗi trên bằng cách:
1. Xây dựng bộ Backup/Restore bằng JS thuần túy (JS-Native Engine) thông qua Prisma Client, nén định dạng `.json.gz`.
2. Tích hợp lưu trữ Cloud tự động lên Vercel Blob dưới nhãn hiển thị **"Lưu trên máy chủ"**.
3. Thiết lập lịch trình tự động thông qua Vercel Cron-job và cơ chế dọn dẹp (Retention) các bản sao lưu cũ.

---

## 2. Thiết kế Kỹ thuật (Technical Specification)

### A. Bộ Backup/Restore JS-Native
Thay vì gọi các công cụ dòng lệnh của hệ điều hành, chúng ta sẽ truy cập dữ liệu trực tiếp qua Prisma.

#### 1. Định nghĩa các bảng cần sao lưu (MODELS)
Danh sách các bảng sẽ được khai báo theo thứ tự rõ ràng hoặc xử lý độc lập nhờ tắt ràng buộc khóa ngoại:
```typescript
const MODELS = [
  'User',
  'AgencyHistory',
  'StorageLayout',
  'BackupSchedule',
  'BackupRun',
  'StorageBox',
  'AuditLog',
  'UserAccessLog',
  'StorageBoxLabel',
  'File',
  'BorrowSlip',
  'FileIndex',
  'Document',
  'BorrowItem',
  'BorrowSlipEvent'
];
```

#### 2. Logic Backup (Sao lưu)
1. Lấy toàn bộ bản ghi từ các bảng bằng `prisma[modelName].findMany()`.
2. Tạo cấu trúc dữ liệu JSON chứa metadata (phiên bản cấu trúc dữ liệu, thời điểm tạo) và data của các bảng.
3. Sử dụng thư viện `zlib.gzipSync` của NodeJS để nén chuỗi JSON thành buffer dữ liệu `.json.gz`.
4. Nếu lưu cục bộ (`local`), server trả về stream nén tải về. Nếu lưu máy chủ (`server-cloud`), server đẩy trực tiếp buffer này lên Vercel Blob.

#### 3. Logic Restore (Khôi phục)
1. Nhận file `.json.gz` và giải nén bằng `zlib.gunzipSync`.
2. Chuyển đổi các cột ngày tháng (dạng chuỗi ISO-8601) trở lại thành đối tượng `Date` của Javascript.
3. Thực hiện khôi phục an toàn trong một transaction duy nhất:
   * Chạy SQL `SET session_replication_role = 'replica';` để tạm thời vô hiệu hóa tất cả các trigger và ràng buộc khóa ngoại.
   * Xóa sạch dữ liệu cũ trong các bảng thông qua `deleteMany()`.
   * Chèn dữ liệu mới vào các bảng thông qua `createMany()`.
   * Chạy SQL `SET session_replication_role = 'origin';` để kích hoạt lại ràng buộc khóa ngoại.

---

### B. Tích hợp Vercel Blob làm "Máy chủ Lưu trữ"
* **SDK**: Sử dụng thư viện `@vercel/blob` để tương tác.
* **Xác thực**: Token `BLOB_READ_WRITE_TOKEN` được cấu hình trong Environment Variables (ở Vercel dashboard hoặc `.env` của VPS).
* **Quản lý vòng đời (Retention)**:
  * Sau khi sao lưu thành công, hệ thống đọc số ngày giữ file (`retentionDays`, mặc định là 7) từ lịch cấu hình.
  * Liệt kê các tệp trên Vercel Blob bằng `list()`, lọc các tệp cũ hơn thời hạn lưu trữ và thực hiện xóa hàng loạt bằng `del()`.
  * Đồng thời, xóa các bản ghi nhật ký `BackupRun` tương ứng trong database.

---

### C. Thiết kế API Endpoints (`server/api-routes/admin.routes.ts`)

#### 1. API Sao lưu thủ công (`POST /api/admin/database/backup`)
* **Request Body**: `{ target: 'local' | 'server-cloud' }`
* **Response**:
  * Nếu `target === 'local'`: Stream tải file `.json.gz`.
  * Nếu `target === 'server-cloud'`: Trả về JSON chứa URL của bản sao lưu trên máy chủ và thông tin dung lượng.

#### 2. API Cron-job tự động (`POST /api/cron/backup`)
* **Bảo mật**: Kiểm tra `Authorization: Bearer <CRON_SECRET>` để tránh request giả mạo.
* **Logic**:
  1. Đọc cấu hình lịch từ bảng `BackupSchedule`.
  2. Nếu không bật lịch hoặc chưa đến giờ chạy: Thoát sớm.
  3. Nếu đến lịch: Thực hiện sao lưu JS-native, đẩy lên Vercel Blob, chạy dọn dẹp dữ liệu cũ, ghi nhận kết quả thành công/thất bại vào bảng `BackupRun` và cập nhật `lastRunAt` cho lịch.

---

### D. Thay đổi Giao diện UI (`backup-page.tsx`)

* **Từ ngữ (Wording)**:
  * Thay thế tất cả các thuật ngữ mang tính kỹ thuật như "local" và "vercel-blob" bằng ngôn ngữ thân thiện với khách hàng:
    * `local` $\rightarrow$ **Tải về máy cá nhân**
    * `vercel-blob` hoặc `server-cloud` $\rightarrow$ **Lưu trên máy chủ**
* **Nút bấm**:
  * Trên phần "Sao lưu thủ công", thay vì 1 nút duy nhất, ta chia làm 2 nút rõ ràng:
    * **Tải bản sao lưu về máy** (Thực hiện backup tải file).
    * **Sao lưu lên máy chủ ngay** (Thực hiện backup và lưu trữ cloud trên máy chủ).
* **Lập lịch tự động**:
  * Thêm Select box cấu hình **"Nơi lưu trữ"** với 2 tùy chọn tương ứng.

---

## 3. Kế hoạch Kiểm thử & Xác minh (Verification Plan)

### Kiểm thử Tự động
1. Tạo mock test cho tiến trình backup và restore trong `server/lib/services/database-backup.test.ts`.
2. Kiểm tra xem file nén `.json.gz` có giải nén và khôi phục đúng cấu trúc ban đầu không.

### Xác minh Thủ công
1. Chạy thủ công sao lưu trên môi trường Dev (với token giả lập hoặc token thật của Vercel Blob).
2. Tải bản sao lưu về máy cá nhân $\rightarrow$ kiểm tra cấu trúc dữ liệu bên trong file `.json.gz`.
3. Nhấp "Sao lưu lên máy chủ ngay" $\rightarrow$ kiểm tra lịch sử xem trạng thái có báo "Lưu trên máy chủ" thành công và hiển thị dung lượng không.
4. Thử khôi phục dữ liệu từ một file sao lưu cũ $\rightarrow$ kiểm tra xem hệ thống có tải lại đúng dữ liệu cũ không.
