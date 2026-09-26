# 03: API điền Loại án cho bản ghi đang trống

**What to build:** Endpoint (quyền `manageStorage`) liệt kê từng Hộp (`caseType` null/rỗng) và Hồ sơ (`type` rỗng sau trim) thiếu Loại án — Hộp: Hộp số, mã hộp, vị trí; Hồ sơ: Mã hồ sơ, Tiêu đề, Hộp chứa và Loại án của Hộp chứa (để UI gợi ý sẵn). Endpoint thứ hai điền Loại án cho đúng một bản ghi (Hộp hoặc Hồ sơ theo ID), chỉ khi bản ghi đó hiện đang trống; giá trị được trim, từ chối nếu rỗng; ghi audit log.

**Blocked by:** —

**Status:** done

- [x] 200 cho SUPER_ADMIN, 403 cho ADMIN/VIEWER/COORDINATOR
- [x] Danh sách trả đủ thông tin nhận diện bản ghi và Loại án của Hộp chứa (nếu có)
- [x] Điền thành công khi bản ghi đang trống; 409 nếu bản ghi đã có Loại án (không ghi đè)
- [x] Giá trị trim; 400 nếu rỗng
- [x] Audit log ghi loại bản ghi, ID, giá trị mới, người thực hiện
- [x] Contract test cho các trường hợp trên
