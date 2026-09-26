# 02: API đổi tên một giá trị Loại án

**What to build:** Endpoint nhận giá trị cũ (chính xác) và giá trị mới, cập nhật trong một transaction mọi `StorageBox` có `caseType` bằng giá trị cũ và mọi `File` có `type` bằng giá trị cũ sang giá trị mới (đã trim). Ghi một audit log gồm giá trị cũ, giá trị mới, danh sách ID Hộp và ID Hồ sơ bị đổi. Trả về số Hộp và số Hồ sơ thực sự đã đổi.

**Blocked by:** —

**Status:** done

- [x] 200 cho SUPER_ADMIN, 403 cho ADMIN/VIEWER/COORDINATOR
- [x] Không cho đổi tên dòng "(Chưa có Loại án)" (400 nếu giá trị cũ rỗng)
- [x] Giá trị mới được trim; 400 nếu rỗng sau trim hoặc bằng đúng giá trị cũ
- [x] Điều kiện cập nhật là bằng-chính-xác trên giá trị cũ; không đụng Hồ sơ chỉ vì nằm trong Hộp bị đổi
- [x] Cập nhật Hộp và Hồ sơ trong cùng một transaction
- [x] Giá trị cũ không còn bản ghi nào: trả 0/0, không lỗi
- [x] Audit log có giá trị cũ, giá trị mới, ID Hộp, ID Hồ sơ, người thực hiện, IP
- [x] Contract test cho các trường hợp trên
