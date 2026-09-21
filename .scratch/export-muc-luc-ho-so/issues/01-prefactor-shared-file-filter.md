# 01: Prefactor: tách hàm dựng điều kiện lọc Hồ sơ dùng chung

**What to build:** Logic dựng điều kiện lọc (`where`) cho danh sách Hồ sơ — tìm kiếm theo `q`, theo đương sự (`party`), loại án, năm, trạng thái, vị trí kho (Kho/Dãy/Kệ/Ô), phạm vi theo người tạo — hiện nằm inline trong handler `GET /api/files`. Tách logic này thành một hàm dùng chung, nhận vào các tham số lọc (và phiên đăng nhập để áp dụng phạm vi COORDINATOR), trả về điều kiện `where` sẵn sàng truyền cho Prisma. `GET /api/files` gọi lại hàm này thay vì logic inline cũ; hành vi không đổi. Đây là bước prefactor để endpoint xuất Mục lục hồ sơ ở ticket 02 tái sử dụng được logic lọc mà không phải sao chép lại.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Logic dựng `where` (bao gồm các lookup `party`/`q` qua raw SQL) được tách thành một hàm dùng chung, không còn nằm trực tiếp trong handler `GET /api/files`
- [ ] `GET /api/files` gọi hàm dùng chung này
- [ ] Hành vi của `GET /api/files` không đổi: toàn bộ test hiện có trong `files.contract.test.ts` pass nguyên vẹn, không cần sửa assertion
- [ ] Hàm dùng chung gọi được từ một route khác mà không phải lặp lại logic lọc (chuẩn bị cho ticket 02)
