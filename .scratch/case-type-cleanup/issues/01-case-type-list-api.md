# 01: API liệt kê Loại án

**What to build:** Thêm endpoint (quyền `manageStorage`) trả về danh sách mọi giá trị Loại án đang tồn tại (gộp từ `StorageBox.caseType` và `File.type`, group theo chuỗi chính xác), mỗi dòng gồm: giá trị, số Hộp, số Hồ sơ, cờ có khoảng trắng thừa. Hộp/Hồ sơ thiếu Loại án gom thành một dòng đặc biệt "(Chưa có Loại án)" với số đếm riêng. Danh sách sắp theo chuỗi đã bỏ dấu tiếng Việt. Demo được bằng gọi API trực tiếp.

**Blocked by:** —

**Status:** done

- [x] Endpoint trả 200 cho SUPER_ADMIN, 403 cho ADMIN/VIEWER/COORDINATOR
- [x] Group theo chuỗi chính xác: "Hình sự" và "Hình sự " là hai dòng khác nhau
- [x] Mỗi dòng có số Hộp (`caseType` bằng đúng giá trị) và số Hồ sơ (`type` bằng đúng giá trị); giá trị chỉ có ở một phía thì phía kia là 0
- [x] Cờ khoảng trắng thừa bật khi có khoảng trắng đầu/cuối hoặc liên tiếp
- [x] Null/chuỗi rỗng (sau trim) không thành dòng thường mà gom vào dòng "(Chưa có Loại án)" có cờ đánh dấu
- [x] Sắp theo chuỗi bỏ dấu + hạ chữ (đ→d); hàm sắp xếp và hàm phát hiện khoảng trắng có unit test
- [x] Contract test cho phân quyền và hình dạng response
