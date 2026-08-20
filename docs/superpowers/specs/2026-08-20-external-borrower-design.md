# Thiết Kế: Cho Phép Người Không Có Username Mượn Hồ Sơ

## 1. Bối cảnh & Vấn đề

- **Thực trạng**:
  - Cơ sở dữ liệu và API (`BorrowSlip`, `/api/borrow`) vốn lưu trữ thông tin người mượn dưới dạng các trường văn bản tự do: `borrowerName`, `borrowerUnit`, `borrowerTitle` (chỉ có `lenderId` là tài khoản hệ thống của cán bộ lưu trữ lập phiếu).
  - Tuy nhiên, giao diện form lập/sửa phiếu mượn (`BorrowForm` trong `components/borrow/borrow-form.tsx`) hiện tại bắt buộc phải chọn từ danh sách người dùng hệ thống (`Select` user với `selectedUserId`). Nếu người mượn là khách hoặc cán bộ chưa có tài khoản trong hệ thống, cán bộ lưu trữ không thể tạo phiếu mượn.
  - Khi chỉnh sửa phiếu mượn cũ của người không có tài khoản, form không map được user và gây lỗi dữ liệu.
- **Mục tiêu**: Cho phép cán bộ lưu trữ linh hoạt chọn người mượn từ danh sách tài khoản có sẵn HOẶC tự nhập tên, đơn vị của người mượn bên ngoài (không có username/tài khoản).

---

## 2. Giải pháp Thiết kế

### 2.1 Giao diện & Trải nghiệm (UI/UX)
- Chuyển trường chọn người mượn từ `<Select>` cố định sang **Combobox / Autocomplete linh hoạt**:
  - Người dùng có thể gõ tìm kiếm người dùng trong hệ thống (gợi ý Họ tên + Đơn vị).
  - Nếu click chọn một người dùng có sẵn: Tự động điền `borrowerName` và `borrowerUnit`.
  - Nếu người mượn chưa có tài khoản: Người dùng có thể gõ trực tiếp tên vào ô nhập và chọn sử dụng giá trị đó (hoặc tự do nhập text).
- Bổ sung trường nhập liệu **Đơn vị / Phòng ban (`borrowerUnit`)** trên giao diện:
  - Cho phép xem/chỉnh sửa đơn vị của người mượn nội bộ hoặc nhập tay đơn vị đối với người ngoài.
- Giữ nguyên trường **Chức danh (`borrowerTitle`)**, **Ngày mượn**, **Hạn trả**, và **Ghi chú**.

### 2.2 Quản lý State & Validation
- **State Form**:
  - Lưu trực tiếp:
    - `borrowerName: string`
    - `borrowerUnit: string`
    - `borrowerTitle: string`
  - Bỏ biến `selectedUserId` và logic ép buộc chọn user.
- **Chế độ chỉnh sửa (`initialData`)**:
  - Nạp trực tiếp `initialData.borrowerName`, `initialData.borrowerUnit`, `initialData.borrowerTitle` vào state mà không cần map ngược với danh sách `User`.
- **Validation**:
  - `borrowerName.trim().length > 0` (bắt buộc nhập tên người mượn).
  - `selectedFiles.length > 0` (bắt buộc có ít nhất 1 hồ sơ).
  - `dueDate` hợp lệ.
- **In phiếu dự thảo (`handlePrintDraft`)**:
  - Sử dụng trực tiếp các giá trị `borrowerName`, `borrowerUnit`, `borrowerTitle` từ state form để tạo bản in dự thảo.

---

## 3. Các thành phần bị ảnh hưởng

1. `components/borrow/borrow-form.tsx`:
   - Thay thế `Select` người mượn bằng Combobox/Autocomplete linh hoạt hoặc Input có gợi ý.
   - Thêm Input `borrowerUnit`.
   - Cập nhật state, validation submit và `handlePrintDraft`.
2. `src/routes/borrow/create-borrow-page.tsx` (nếu cần đồng bộ):
   - Đảm bảo tính nhất quán của các trường nhập liệu người mượn.
3. Kiểm thử / Test cases:
   - Tạo phiếu mượn với người dùng hệ thống.
   - Tạo phiếu mượn với người mượn tự do (không có tài khoản).
   - In phiếu mượn dự thảo cho cả 2 trường hợp.
   - Chỉnh sửa phiếu mượn của người mượn tự do.

---

## 4. Kế hoạch Kiểm thử & Xác minh

- **Unit / Component Test**:
  - Kiểm tra form hiển thị và xử lý submit đúng khi nhập tên tự do.
  - Kiểm tra tự động điền đơn vị khi chọn người dùng trong danh sách.
  - Kiểm tra validation khi để trống tên người mượn.
- **Manual Test**:
  - Mở modal "Tạo phiếu mượn hồ sơ", gõ tên một người không có trong danh sách và submit thành công.
  - Mở phiếu vừa tạo để sửa thông tin và lưu lại thành công.
  - Thử in phiếu dự thảo và in phiếu chính thức.
