# 02: Danh sách Hộp có Hồ sơ lệch loại

**What to build:** SUPER_ADMIN mở tab "Hộp lẫn loại án" và thấy mọi Hộp có ít nhất một Hồ sơ lệch loại (Loại án của Hồ sơ sau trim khác nhãn Loại án của Hộp sau trim, so sánh chính xác). Mỗi dòng: Hộp số, nhãn Loại án (hoặc "(chưa có nhãn)"), vị trí (Kho → Dãy → Kệ → Ô), huy hiệu kiểu vấn đề (Lẫn nhiều loại án / Nhãn khác hồ sơ / Hộp chưa có nhãn), huy hiệu mức độ (🔴 Nhãn sai >50%, 🟠 Lẫn đáng kể ≥20%, 🟡 Lệch lẻ), và "N/M hồ sơ lệch (x%)". Sắp theo mức độ, rồi tỉ lệ lệch giảm dần, rồi Hộp số. Hồ sơ ARCHIVED, Hồ sơ không có Hộp và Hồ sơ có Loại án rỗng không được tính. Tab tự làm mới sau thao tác ở tab "Loại án". Xem spec để biết đầy đủ định nghĩa và hình dạng response.

**Blocked by:** 01 (Chuyển trang Chuẩn hoá dữ liệu sang dạng tab)

**Status:** done

- [x] Hàm phân loại thuần trả về kiểu vấn đề, mức độ, tỉ lệ, thành phần Loại án (giảm dần), tổ hợp Loại án (chuỗi ổn định), danh sách Hồ sơ lệch; Hộp không lệch bị loại
- [x] Unit test: ba kiểu vấn đề, biên ngưỡng 50%/20%, trim nhưng không bỏ qua khác biệt cách viết ("Hình sự" ≠ "Hình sự sơ thẩm"), Hộp chưa nhãn luôn 🔴, thứ tự sắp xếp
- [x] API chỉ đọc trả `summary` và `boxes` theo spec, dùng quyền `manageStorage`
- [x] Contract test: 401 chưa đăng nhập, 403 ADMIN/VIEWER/COORDINATOR, 200 SUPER_ADMIN; hình dạng response; điều kiện truy vấn loại ARCHIVED và Loại án rỗng
- [x] Tab hiển thị danh sách với các cột/huy hiệu trên, đúng thứ tự sắp xếp
- [x] Đổi tên/điền Loại án ở tab "Loại án" làm mới số liệu tab này
- [x] Không có nút sửa dữ liệu nào
