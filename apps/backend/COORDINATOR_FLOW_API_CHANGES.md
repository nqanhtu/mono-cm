# Tài liệu Tích hợp luồng nghiệp vụ Coordinator

Tài liệu này mô tả các thay đổi phía Backend API dành cho nhóm Frontend để tích hợp chức năng phân quyền theo vai trò `COORDINATOR`.

## 1. Thay đổi về Database
- Thêm trường `createdById` và `updatedById` cho cả 2 model `File` (Hồ sơ) và `Document` (Tài liệu con).
- Mỗi khi khởi tạo hoặc cập nhật, backend sẽ tự động gán ID của user đang thao tác vào các trường này.

## 2. Các quy định về quyền truy cập (RBAC)

- **`SUPER_ADMIN` và `ADMIN`:** 
  - Có toàn quyền xem tất cả các hồ sơ (`GET /api/files` lấy toàn bộ nếu không filter).
  - Có quyền **Create / Update / Delete** đối với mọi File và Document, kể cả khi File đó đang ở trạng thái `isLocked = true`.
- **`COORDINATOR`:**
  - Đã được cấp quyền `manageFiles` trong hệ thống phân quyền cơ bản.
  - **Giới hạn xem:** Khi gọi API `GET /api/files`, backend tự động ép tham số `createdById = session.id`. Do đó, Coordinator sẽ **chỉ nhìn thấy các hồ sơ do chính mình tạo ra**.
  - **Giới hạn thao tác:** Khi gọi API `PUT /api/files/:id`, `DELETE /api/files/:id`, hệ thống sẽ chặn (`403 Forbidden`) nếu File đó không thuộc sở hữu của Coordinator.
  - Tương tự đối với `Document`, vì tài liệu con phụ thuộc vào hồ sơ mẹ, Coordinator chỉ có quyền `POST/PUT/DELETE` đối với các Document nằm trong File do chính tay Coordinator đó tạo.

## 3. Cập nhật API cụ thể cho Frontend

### 3.1. Lấy danh sách Coordinator (Cho Select Box)
Dùng để hiển thị danh sách thả xuống (Select Box) cho `SUPER_ADMIN` / `ADMIN` chọn xem hồ sơ của một Coordinator cụ thể.
- **Endpoint:** `GET /api/users`
- **Query Parameter:** `?purpose=coordinator`
- **Response:** Trả về danh sách tất cả các user đang có `role === 'COORDINATOR'` và `status === true`.
- **Sử dụng:** Frontend gọi API này để lấy danh sách Coordinator đổ ra giao diện.

### 3.2. Lọc hồ sơ theo Coordinator
Dành cho giao diện Quản lý hồ sơ của `SUPER_ADMIN` / `ADMIN` khi họ chọn một Coordinator từ Select Box bên trên.
- **Endpoint:** `GET /api/files`
- **Query Parameter mới:** `?createdById={userId}`
- **Ví dụ:** `GET /api/files?createdById=abc-123`
- **Hoạt động:** Sẽ trả về danh sách hồ sơ chỉ do user có ID là `abc-123` tạo ra.

### 3.3. Xử lý Lỗi (Lưu ý cho Frontend)
Frontend cần bắt thêm trường hợp API trả về mã lỗi `403 Forbidden` với message: 
- `"Không có quyền chỉnh sửa hồ sơ này"`
- `"Không có quyền thêm tài liệu vào hồ sơ này"`
- `"Không có quyền xoá tài liệu thuộc hồ sơ này"`
*(Hiển thị Toast hoặc cảnh báo cho Coordinator khi họ cố gắng thao tác vượt quyền - nếu do Frontend cache chưa kịp update UI).*
