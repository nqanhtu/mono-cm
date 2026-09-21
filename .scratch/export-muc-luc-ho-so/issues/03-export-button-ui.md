# 03: Nút "Xuất Excel toàn bộ" trên danh sách Hồ sơ

**What to build:** Trên toolbar của màn hình danh sách Hồ sơ, thêm nút "Xuất Excel toàn bộ", tách biệt khỏi vùng thao tác hàng loạt theo lựa chọn dòng, chỉ hiển thị/kích hoạt cho người dùng có quyền `exportFiles`. Bấm nút mở dialog xác nhận hiển thị số dòng sẽ xuất (lấy từ tổng số đã có sẵn theo bộ lọc hiện tại trên màn hình, không gọi thêm API đếm riêng). Xác nhận thì gọi endpoint xuất (ticket 02) với đúng các tham số bộ lọc/tìm kiếm đang áp dụng, và tải file `.xlsx` về trình duyệt.

**Blocked by:** 02 (API xuất Excel toàn bộ Mục lục hồ sơ)

**Status:** ready-for-agent

- [ ] Nút "Xuất Excel toàn bộ" xuất hiện trên toolbar của màn hình danh sách Hồ sơ, tách biệt khỏi vùng thao tác hàng loạt theo lựa chọn dòng
- [ ] Nút chỉ hiển thị/kích hoạt cho người dùng có quyền `exportFiles`; ẩn hoặc vô hiệu hóa với vai trò khác
- [ ] Bấm nút mở dialog xác nhận hiển thị số dòng sẽ xuất, lấy từ tổng số đã có sẵn theo bộ lọc hiện tại trên màn hình
- [ ] Có thể hủy ở dialog xác nhận mà không xuất gì
- [ ] Xác nhận thì gọi endpoint xuất với đúng các tham số bộ lọc/tìm kiếm đang áp dụng trên màn hình, và kích hoạt tải file `.xlsx` về trình duyệt
