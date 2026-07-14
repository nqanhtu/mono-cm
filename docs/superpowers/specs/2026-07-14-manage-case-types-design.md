# Thiết kế Hệ thống Quản lý Loại Bản Án / Vụ Án (Case Types)

Tài liệu này đặc tả thiết kế kỹ thuật cho tính năng lưu trữ và quản lý danh mục Loại bản án/vụ án dưới cơ sở dữ liệu, đồng thời cung cấp giao diện quản trị Super Admin để thêm, sửa, xóa các loại này.

## 1. Mục tiêu & Yêu cầu nghiệp vụ
* **Đưa danh mục loại bản án vào Database**: Thay thế danh sách cứng (hardcoded) hiện tại bằng dữ liệu động lưu trong PostgreSQL.
* **Giao diện quản lý cho Super Admin**: Cho phép Super Admin CRUD (Thêm, Đọc, Sửa, Xóa) danh mục loại bản án tại trang `/admin/case-types`.
* **Trường dữ liệu**: Mỗi loại bản án gồm **Tên** (ví dụ: "Hình sự sơ thẩm") và **Mã viết tắt** (ví dụ: "HSST").
* **Cơ chế gợi ý Autocomplete**: Danh sách gợi ý tự động khi nhập hồ sơ vẫn hiển thị tên loại bản án đầy đủ dưới dạng chuỗi văn bản (ví dụ: "Hình sự sơ thẩm") để đồng bộ với dữ liệu cũ trong trường `File.type`.
* **Ràng buộc khi xóa**: Cho phép xóa loại bản án ngay cả khi đã được sử dụng ở hồ sơ cũ (không chặn xóa cứng), việc xóa chỉ làm biến mất tùy chọn đó khi tạo/sửa hồ sơ mới.

---

## 2. Thiết kế Cơ sở dữ liệu (Database Design)

### 2.1. Model mới: `CaseType`
Thêm model `CaseType` vào [schema.prisma](file:///Users/anhtu/Projects/mono-cm/prisma/schema.prisma):

```prisma
model CaseType {
  id        String   @id @default(uuid(7))
  name      String   @unique // Ví dụ: "Hình sự sơ thẩm"
  code      String   @unique // Ví dụ: "HSST"
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("case_type")
}
```

### 2.2. Kế hoạch Seed dữ liệu mẫu (`prisma/seed.ts`)
Bổ sung các bản ghi ban đầu vào hàm seed:
* Hình sự sơ thẩm (HSST)
* Dân sự sơ thẩm (DSST)
* Hình sự phúc thẩm (HSPT)
* Dân sự phúc thẩm (DSPT)
* Hôn nhân phúc thẩm (HNPT)
* Hành chính (HC)
* Kinh doanh thương mại (KDTM)
* Lao động (LD)
* Gia đình và người chưa thành niên (GDNCTN)

---

## 3. Thiết kế API ở Máy chủ (Backend API)

Toàn bộ các endpoint mới cho Super Admin được đặt trong tệp định tuyến admin [admin.routes.ts](file:///Users/anhtu/Projects/mono-cm/server/api-routes/admin.routes.ts) và được bảo vệ bằng quyền quản trị.

### 3.1. CRUD API (`/api/admin/case-types`)
* **`GET /api/admin/case-types`**
  * Quyền: `SUPER_ADMIN`
  * Phản hồi: Danh sách loại bản án dạng JSON sắp xếp tăng dần theo tên.
* **`POST /api/admin/case-types`**
  * Quyền: `SUPER_ADMIN`
  * Body: `{ name: string, code: string }`
  * Logic: Kiểm tra trống, kiểm tra trùng lặp tên/mã (409 Conflict), ghi nhận logs audit.
* **`PATCH /api/admin/case-types/:id`**
  * Quyền: `SUPER_ADMIN`
  * Body: `{ name?: string, code?: string }`
  * Logic: Kiểm tra trùng lặp tên/mã ở các bản ghi khác, cập nhật dữ liệu, ghi nhận logs audit.
* **`DELETE /api/admin/case-types/:id`**
  * Quyền: `SUPER_ADMIN`
  * Logic: Xóa trực tiếp bản ghi trong database, ghi nhận logs audit.

### 3.2. Cập nhật API Autocomplete (`/api/files/autocomplete-suggestions`)
Chỉnh sửa trong [files.routes.ts](file:///Users/anhtu/Projects/mono-cm/server/api-routes/files.routes.ts):
```typescript
const dbCaseTypes = await db.caseType.findMany({ select: { name: true }, orderBy: { name: 'asc' } })
const predefinedTypes = dbCaseTypes.map(c => c.name)
```
Cơ chế này kết hợp động giữa danh sách chuẩn từ DB và các giá trị `distinct` cũ trong cột `File.type` để bảo đảm không mất gợi ý nếu có dữ liệu lịch sử chưa được chuẩn hóa.

---

## 4. Thiết kế Giao diện người dùng (Frontend Design)

### 4.1. Đăng ký Tuyến đường (Routing)
Thêm trang mới vào hệ thống tại [app.tsx](file:///Users/anhtu/Projects/mono-cm/src/app.tsx):
* Đường dẫn: `/admin/case-types`
* Quyền yêu cầu: `manageAgencies` (Super Admin)
* Component: `src/routes/admin/case-types-page.tsx`

### 4.2. Tích hợp Sidebar
Thêm nút điều hướng trong [app-sidebar.tsx](file:///Users/anhtu/Projects/mono-cm/components/app-sidebar.tsx) dưới nhóm Quản lý:
```typescript
{ name: "Loại bản án", href: "/admin/case-types", icon: FolderKanban }
```

### 4.3. Các Component giao diện mới
* **`CaseTypesPage`** (`src/routes/admin/case-types-page.tsx`):
  * Layout quản trị tiêu chuẩn.
  * Chứa component hiển thị danh sách `CaseTypeList`.
* **`CaseTypeList`** (`components/admin/case-type-list.tsx`):
  * Bảng hiển thị thông tin gồm: Tên loại bản án, Mã viết tắt.
  * Có nút Sửa, Xóa tương ứng từng dòng và nút "Thêm loại bản án" trên thanh công cụ.
  * Tích hợp hộp thoại AlertDialog để yêu cầu xác nhận trước khi xóa.
* **`CaseTypeFormModal`** (`components/admin/case-type-form-modal.tsx`):
  * Modal nhập liệu chung cho việc Thêm mới và Chỉnh sửa.
  * Tự động chuẩn hóa mã viết tắt khi người dùng nhập (chuyển sang in hoa, loại bỏ dấu cách).

---

## 5. Kế hoạch Kiểm thử & Xác minh (Verification Plan)

### 5.1. Automated Tests
* Cập nhật các case test trong [files.contract.test.ts](file:///Users/anhtu/Projects/mono-cm/server/contracts/files.contract.test.ts) để mô phỏng API trả gợi ý từ DB thay vì mảng tĩnh.
* Viết thêm các test case kiểm tra CRUD API trong `server/contracts/admin.contract.test.ts`.

### 5.2. Manual Verification
* Đăng nhập bằng tài khoản Super Admin, truy cập `/admin/case-types`.
* Thử thêm mới, chỉnh sửa và xóa một loại bản án, kiểm tra danh mục thay đổi tương ứng.
* Truy cập trang tạo mới hồ sơ vụ án, gõ vào ô gợi ý "Loại án" để kiểm tra danh mục gợi ý hoạt động đúng và chứa các mục vừa cấu hình.
