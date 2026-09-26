# 04: Trang admin "Chuẩn hoá dữ liệu" — chuẩn hoá Loại án

**What to build:** Trang admin mới (chỉ SUPER_ADMIN), chỉ hiện trong menu cho người có quyền `manageStorage`. Bảng liệt kê Loại án từ API ticket 01 (giá trị, số Hộp, số Hồ sơ, đánh dấu khoảng trắng thừa, hiển thị khoảng trắng một cách nhìn thấy được). Mỗi dòng có nút Sửa mở dialog: ô nhập có autocomplete từ các giá trị đang có; nếu giá trị gõ vào (sau trim) trùng nhóm có sẵn thì hiện "Sẽ gộp vào nhóm X (N hộp, M hồ sơ)", nếu chưa tồn tại thì cảnh báo "Tạo Loại án mới"; hiện xem trước số Hộp/Hồ sơ sẽ đổi (từ số liệu dòng nguồn). Xác nhận gọi API ticket 02, toast số bản ghi thực tế đã đổi, rồi làm mới danh sách. Dòng "(Chưa có Loại án)" không có nút Sửa mà mở ra danh sách từng Hộp/Hồ sơ thiếu Loại án (API ticket 03), mỗi bản ghi có ô nhập autocomplete riêng, Hồ sơ nằm trong Hộp đã có Loại án được gợi ý sẵn Loại án của Hộp; lưu từng bản ghi. Có dòng nhắc nên backup trước khi chuẩn hoá.

**Blocked by:** 01, 02, 03

**Status:** done

- [x] Route + mục menu mới, ẩn với vai trò không có `manageStorage`
- [x] Bảng hiện đủ cột và đánh dấu khoảng trắng thừa
- [x] Dialog sửa có autocomplete, thông báo gộp/tạo mới, xem trước số lượng
- [x] Không cho xác nhận khi giá trị mới rỗng hoặc bằng giá trị cũ
- [x] Sau khi sửa: toast số thực tế, danh sách làm mới
- [x] Dòng "(Chưa có Loại án)" mở danh sách từng bản ghi, điền và lưu từng bản ghi, gợi ý Loại án của Hộp chứa
- [x] Bản ghi đã điền biến khỏi danh sách trống, số đếm cập nhật
