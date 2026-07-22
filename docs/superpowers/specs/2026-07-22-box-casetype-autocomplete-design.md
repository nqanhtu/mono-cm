# Spec Design: Autocomplete cho Trường "Loại hồ sơ" trong Form Hộp Lưu Trữ

- **Ngày tạo:** 2026-07-22
- **Trạng thái:** Đã duyệt (Approved)
- **Tác vụ:** Chuyển đổi dropdown chọn loại hồ sơ trong dialog Thêm/Sửa Hộp lưu trữ tại `/admin/boxes` sang dạng Autocomplete có gợi ý động & mặc định.

---

## 1. Bối cảnh & Mục tiêu

Hiện tại, ở trang `/admin/boxes`, khi ấn "Thêm hộp mới" hoặc "Chỉnh sửa hộp", trường **Loại hồ sơ** (`caseType`) trong `StorageBoxDialog` đang sử dụng thẻ `<Select>` cố định với 9 lựa chọn mặc định. Trong khi đó, ở trang Thêm hồ sơ (`CaseFileForm`), trường **Loại án** đã sử dụng `<AutocompleteInput>` kết hợp dữ liệu gợi ý từ CSDL qua `useAutocompleteSuggestions()`.

**Mục tiêu:** Nâng cấp trường **Loại hồ sơ** trong `StorageBoxDialog` sang `<AutocompleteInput>` để nâng cao trải nghiệm người dùng, đồng bộ UI/UX giữa quản lý Hộp lưu trữ và quản lý Hồ sơ.

---

## 2. Giải pháp kỹ thuật chi tiết

### File cần chỉnh sửa: [components/forms/storage-box-dialog.tsx](file:///Users/anhtu/Projects/mono-cm/components/forms/storage-box-dialog.tsx)

1. **Imports bổ sung**:
   - `AutocompleteInput` từ `@/components/ui/autocomplete-input`
   - `useAutocompleteSuggestions` từ `@/lib/hooks/use-autocomplete-suggestions`
   - `useMemo` từ `react`

2. **Dữ liệu gợi ý hợp nhất (`mergedCaseTypes`)**:
   - Gộp danh sách loại án mặc định chuẩn (`caseTypes` sẵn có) với danh sách loại án được trả về từ DB thông qua `useAutocompleteSuggestions().suggestions.types`.
   - Sử dụng `Set` để lọc các giá trị trùng lặp (không phân biệt chữ hoa/chữ thường sau khi chuẩn hóa).

3. **Cập nhật Form Field `caseType`**:
   - Thay thế thẻ `<Select>` bằng `<AutocompleteInput>`.
   - Thuộc tính `value`: truyền `field.value || ""`.
   - Thuộc tính `suggestions`: truyền `mergedCaseTypes`.
   - Thuộc tính `onValueChange`: cập nhật form value, tự động biến đổi chuỗi rỗng `""` thành `null`.

4. **Chuẩn hóa Payload**:
   - Trong `onSubmit`, đảm bảo `caseType` được trim whitespace và nếu rỗng thì ghi nhận là `null`.

---

## 3. Kế hoạch kiểm thử

- **Kiểm thử tìm kiếm**: Mở dialog Thêm/Sửa Hộp, nhập từ khóa tìm kiếm (VD: "Hình sự", "Dân sự") -> Hiển thị danh sách gợi ý hợp nhất.
- **Kiểm thử chọn từ gợi ý**: Click chọn một mục từ popup gợi ý -> Giá trị điền chính xác vào form.
- **Kiểm thử nhập tùy chỉnh**: Nhập một loại hồ sơ chưa từng có trong gợi ý -> Lưu hộp thành công và dữ liệu lưu đúng loại hồ sơ mới vào CSDL.
- **Kiểm thử sửa hộp**: Mở dialog sửa hộp đã có `caseType` -> Form load đúng giá trị ban đầu vào Autocomplete.
