# Thiết kế Tính năng Chuyển hàng loạt hồ sơ vào hộp lưu trữ

**Ngày tạo:** 2026-08-20  
**Trạng thái:** Chờ phê duyệt (Pending Approval)

---

## 1. Tổng quan & Mục tiêu

Tính năng cho phép người dùng có quyền quản lý hồ sơ (`SUPER_ADMIN`, `ADMIN`) chọn nhiều hồ sơ cùng lúc trong bảng danh sách hồ sơ (`FileTable`) và chuyển toàn bộ vào một hộp lưu trữ (`StorageBox`) xác định thông qua một thao tác duy nhất.

Đồng thời, hệ thống sẽ tự động đồng bộ thời hạn bảo quản (`retention`) của các hồ sơ được chọn theo thời hạn bảo quản của hộp lưu trữ (nếu hộp có quy định).

---

## 2. Kiến trúc & Thiết kế chi tiết

### 2.1. Backend API

* **Endpoint:** `POST /api/files/batch-assign-box`
* **Xác thực & Phân quyền:**
  - Yêu cầu người dùng đăng nhập.
  - Phân quyền: `canManageFiles` (`SUPER_ADMIN`, `ADMIN`). Trả về 403 Forbidden nếu không đủ quyền.
* **Payload đầu vào (JSON):**
  ```json
  {
    "fileIds": ["string"],
    "boxId": "string"
  }
  ```
* **Quy tắc nghiệp vụ & Xử lý cơ sở dữ liệu:**
  1. Validate: `fileIds` phải là mảng chuỗi không rỗng; `boxId` phải là chuỗi hợp lệ.
  2. Kiểm tra sự tồn tại của hộp lưu trữ `storageBox` trong CSDL qua `boxId`. Nếu không tìm thấy, trả về lỗi 404.
  3. Chuẩn bị dữ liệu cập nhật (`data`):
     - `boxId: box.id`
     - Nếu `box.retention` có giá trị không rỗng: `retention: box.retention`
     - `updatedById: session.id`
     - `updatedAt: new Date()`
  4. Thực thi cập nhật cơ sở dữ liệu qua Prisma:
     - `db.file.updateMany({ where: { id: { in: fileIds } }, data })`
  5. Ghi nhật ký hệ thống (`AuditLog`):
     - `action: "UPDATE"`
     - `target: "File"`
     - `targetId: "batch_assign_box"`
     - `userId: session.id`
     - `detail: { boxId: box.id, boxCode: box.code, count: result.count, fileIds }`
* **Response:**
  ```json
  {
    "success": true,
    "message": "Đã chuyển thành công X hồ sơ vào hộp BOX-01",
    "count": 5
  }
  ```

---

### 2.2. Frontend UI & Components

#### 2.2.1. Thanh công cụ tác vụ hàng loạt (`FileTable`)
* Vị trí: [file-table.tsx](file:///Users/tunguyen/Projects/mono-cm/components/files/file-table.tsx)
* Điều kiện hiển thị: `selectedRows.length > 0` và `canManageFiles === true`.
* Bổ sung nút **"Chuyển vào hộp"** (icon `Archive` từ `lucide-react`) với kích thước `size="sm"`, `variant="outline"`.
* Khi click: Mở hộp thoại `BatchAssignBoxDialog`.

#### 2.2.2. Component `BatchAssignBoxDialog` (`components/files/batch-assign-box-dialog.tsx`)
* **Props:**
  - `isOpen: boolean`
  - `onClose: () => void`
  - `selectedFiles: FileWithBox[]`
  - `onSuccess?: () => void`
* **Giao diện & Chức năng:**
  - **Tiêu đề:** *"Chuyển {selectedFiles.length} hồ sơ vào hộp lưu trữ"*
  - **Mô tả:** *"Chọn hộp lưu trữ đích để chuyển các hồ sơ đã chọn vào."*
  - **Bộ chọn hộp lưu trữ (Combobox / Searchable Select):**
    - Tải danh sách hộp qua hook `useStorageBoxes` hoặc tìm kiếm trực tiếp.
    - Hỗ trợ gõ tìm kiếm theo: Mã hộp, Vị trí (Kho, Dãy, Kệ, Ô), Loại án, Năm.
    - Hiển thị từng mục trong danh sách: `Mã hộp` - `Kho / Dãy / Kệ / Ô` - `Thời hạn bảo quản`.
  - **Thẻ thông tin tóm tắt hộp được chọn (Preview Card):**
    - Khi người dùng chọn 1 hộp trong danh sách, hiển thị card thông tin trực quan:
      - Mã hộp & Số hộp (Badge nổi bật).
      - Vị trí vật lý: `Kho > Dãy > Kệ > Ô`.
      - Loại án & Phông lưu trữ.
      - Thời hạn bảo quản: Hiển thị giá trị kèm ghi chú *"Thời hạn bảo quản của các hồ sơ sẽ tự động đồng bộ theo hộp"*.
      - Số lượng hồ sơ hiện có trong hộp: Ví dụ `12 hồ sơ`.
  - **Thao tác:**
    - Nút "Hủy": Đóng modal.
    - Nút "Xác nhận chuyển": Gửi request `POST /api/files/batch-assign-box`. Hiển thị trạng thái đang xử lý (loading spinner / disabled).

#### 2.2.3. Xử lý sau khi thành công
* Đóng modal.
* Hiển thị thông báo Toast thành công (`toast.success(...)`).
* Bỏ chọn các dòng đã chọn (`table.resetRowSelection()`).
* Invalidate các query liên quan qua `queryClient`:
  - `queryKeys.files.all`
  - `queryKeys.files.stats`
  - `queryKeys.boxes.all`
* Gọi `onRefresh?.()`.

---

## 3. Kế hoạch kiểm thử (Verification Plan)

### 3.1. Backend Contract & Integration Tests
* File: `server/contracts/files.contract.test.ts` hoặc `server/contracts/batch-assign-box.contract.test.ts`
* Các test case:
  1. `POST /api/files/batch-assign-box` - Thành công cập nhật `boxId` và `retention` cho danh sách hồ sơ khi có quyền `SUPER_ADMIN`/`ADMIN`.
  2. `POST /api/files/batch-assign-box` - Từ chối khi không có quyền (403 Forbidden).
  3. `POST /api/files/batch-assign-box` - Trả về lỗi 400 khi thiếu `fileIds` hoặc `fileIds` rỗng.
  4. `POST /api/files/batch-assign-box` - Trả về lỗi 404 khi `boxId` không tồn tại.
  5. Kiểm tra bản ghi `AuditLog` được tạo chính xác với thông tin hộp và số lượng hồ sơ.

### 3.2. Frontend Tests
* File: `components/files/batch-assign-box-dialog.test.tsx`
* Các test case:
  1. Render modal với danh sách hồ sơ đã chọn và danh sách hộp lưu trữ.
  2. Tìm kiếm và chọn hộp lưu trữ -> Thẻ thông tin hộp hiển thị đúng thông tin.
  3. Bấm xác nhận chuyển -> Gọi đúng API và kích hoạt callback `onSuccess`.
  4. Kiểm tra nút "Chuyển vào hộp" trong `FileTable` hiển thị đúng khi chọn dòng và ẩn khi không chọn.

### 3.3. Kiểm tra hồi quy toàn diện
* Chạy `bun run test:frontend`
* Chạy `bun run lint`
