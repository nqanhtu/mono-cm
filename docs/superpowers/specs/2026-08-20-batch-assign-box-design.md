# Thiết kế Tính năng Chuyển hàng loạt hồ sơ vào hộp lưu trữ & Chọn hồ sơ đa trang

**Ngày cập nhật:** 2026-08-20  
**Trạng thái:** Đã phê duyệt (Approved)

---

## 1. Tổng quan & Mục tiêu

Nâng cấp cơ chế chọn hồ sơ và chuyển hộp lưu trữ:
1. **Lưu vết chọn hồ sơ xuyên suốt nhiều trang (Cross-page Selection):** Cho phép người dùng chọn các hồ sơ ở nhiều trang khác nhau (khi dùng phân trang máy chủ). Trạng thái chọn và đối tượng hồ sơ được tích lũy toàn cục.
2. **Hiển thị danh sách kiểm tra hồ sơ (Verification List) trong Modal:** Trong hộp thoại chuyển vào hộp, hiển thị danh sách trực quan các hồ sơ sẽ được chuyển kèm thông tin hộp hiện tại, cho phép xóa/bỏ bớt từng hồ sơ trực tiếp trong modal.
3. **Đồng bộ thời hạn bảo quản:** Tự động đồng bộ thời hạn bảo quản (`retention`) của các hồ sơ theo hộp lưu trữ đích.

---

## 2. Kiến trúc & Thiết kế chi tiết

### 2.1. Quản lý trạng thái chọn đa trang (`FileTable`)
* **State:**
  - `selectedFilesMap: Map<string, FileWithBox>` (hoặc `Record<string, FileWithBox>`): Lưu trữ toàn bộ các object hồ sơ đã chọn từ bất kỳ trang nào.
  - `rowSelection: Record<string, boolean>`: Đồng bộ giữa TanStack Table và `selectedFilesMap`.
* **Hành vi:**
  - Khi tick chọn / bỏ chọn 1 dòng: Thêm / xóa `file.id` và `file` object trong `selectedFilesMap`.
  - Khi tick chọn / bỏ chọn "Tất cả dòng của trang":
    - Chọn tất cả: Thêm toàn bộ các hồ sơ của trang hiện tại vào `selectedFilesMap`.
    - Bỏ chọn tất cả: Xóa toàn bộ các hồ sơ của trang hiện tại khỏi `selectedFilesMap`.
  - Thanh công cụ hành động:
    - Hiển thị tổng số hồ sơ đã chọn: `selectedFilesMap.size` (không bị reset về 0 khi chuyển trang).
    - Các nút hành động (*In bìa*, *Tạo phiếu mượn*, *Chuyển vào hộp*, *Lưu trữ*) nhận danh sách đầy đủ: `Array.from(selectedFilesMap.values())`.
  - Nút "Bỏ chọn": Xóa trắng `selectedFilesMap` và `rowSelection`.

---

### 2.2. Modal `BatchAssignBoxDialog` với Danh sách Kiểm tra
* **Props:**
  - `isOpen: boolean`
  - `onClose: () => void`
  - `selectedFiles: FileWithBox[]`
  - `onRemoveFile?: (fileId: string) => void`
  - `onSuccess?: () => void`
* **Giao diện:**
  1. **Khung chọn hộp lưu trữ:** Combobox tìm kiếm hộp kèm thẻ thông tin chi tiết của hộp (Kho, Dãy, Kệ, Ô, Loại án, Thời hạn bảo quản).
  2. **Danh sách hồ sơ sẽ chuyển ({selectedFiles.length}):**
     - Vùng cuộn (Scrollable area, `max-h-48`) hiển thị danh sách hồ sơ:
       - **Mã hồ sơ** (`font-mono font-semibold`).
       - **Tiêu đề hồ sơ** (`truncate`).
       - **Vị trí/Hộp hiện tại:** Badge nhỏ (ví dụ: `Hộp: BOX-01` hoặc `Chưa vào hộp`).
       - **Nút xóa (icon `X`):** Bấm để loại bỏ hồ sơ khỏi danh sách chuyển (và đồng bộ bỏ chọn ở bảng chính).
  3. **Hành động:**
     - Nút "Hủy".
     - Nút "Xác nhận chuyển": Gửi request `POST /api/files/batch-assign-box` với toàn bộ `fileIds` còn lại trong danh sách.

---

## 3. Kế hoạch kiểm thử

1. **Unit Test chọn đa trang trong `FileTable`:**
   - Chọn 2 hồ sơ ở trang 1.
   - Chuyển sang trang 2, chọn tiếp 1 hồ sơ ở trang 2.
   - Kiểm tra thanh công cụ hiển thị "3 hồ sơ đã chọn".
   - Mở modal chuyển hộp, kiểm tra có đầy đủ 3 hồ sơ từ cả 2 trang.
   - Chuyển về trang 1, kiểm tra 2 hồ sơ trang 1 vẫn được tick chọn.
2. **Unit Test Modal `BatchAssignBoxDialog`:**
   - Render danh sách hồ sơ được chuyển.
   - Bấm nút `X` để loại 1 hồ sơ -> số lượng giảm và gọi callback `onRemoveFile`.
   - Bấm xác nhận -> gửi đúng danh sách `fileIds` đã lọc.
