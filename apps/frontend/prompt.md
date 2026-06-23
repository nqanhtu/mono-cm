

# YÊU CẦU ĐỐI VỚI PHẦN MỀM QUẢN LÝ HỒ SƠ

## 1. Quản lý quản lý hồ sơ

### Yêu cầu chung

* quản lý hồ sơ bằng Excel chuẩn.
* Upload Excel vào phần mềm.
* **Cơ chế khóa dữ liệu:** Sau khi vào phần mềm, dữ liệu sẽ bị khóa, không được chỉnh sửa nội dung. Chỉ **01 người có quyền cao nhất** được phép chỉnh sửa và hệ thống phải lưu lại lịch sử chỉnh sửa.

### Cấu trúc dữ liệu nhập liệu (File Excel)

#### **Sheet 1: Thông tin hồ sơ**

1. **Mã hồ sơ:** Quy ước sẵn `HS - loại án - năm - số thứ tự` (Yêu cầu: Không trùng, không thay đổi).
2. **Số tờ:** Đánh số trang trong hồ sơ.
3. **Thời gian:** Ngày/tháng/năm xử án (Theo Bản án/Quyết định đình chỉ/Quyết định công nhận thỏa thuận).
4. **Loại án:**
* Hình sự, Dân sự, Hành chính, Kinh tế...
* Phân loại cấp: Sơ thẩm, Phúc thẩm (đối với tòa án tỉnh).
* *Tính năng:* Cập nhật thêm loại án.


5. **Tên hồ sơ (Chi tiết theo loại):**
* **Hình sự:**
* Tiêu đề: Ví dụ "Hình sự sơ thẩm năm 2016".
* Về việc: Tóm tắt trên quyết định/bản án.
* Bị cáo: Liệt kê đủ tên các bị cáo.
* Quyết định/Bản án: Cập nhật theo hồ sơ.
* Ngày: Theo quyết định/bản án.


* **Dân sự (và các loại khác):**
* Tiêu đề: Ví dụ "Dân sự sơ thẩm năm 2016".
* Về việc: Tóm tắt.
* Nguyên đơn: [Tên].
* Bị đơn: [Tên].
* Người có quyền lợi, nghĩa vụ liên quan: [Tên].
* Quyết định/Bản án: Cập nhật theo hồ sơ.
* Ngày: Theo quyết định/bản án.




6. **Hộp số:** Số hiệu hộp lưu trữ.
7. **Mục lục hồ sơ:** Số thứ tự cuối cùng của mã hồ sơ con (liên kết Sheet 2).
8. **Thời hạn bảo quản** (Căn cứ TT số 12/2025/TT-TANDTC):
* Hồ sơ vụ án hình sự: **Vĩnh viễn**.
* Hồ sơ áp dụng biện pháp xử lý chuyển hướng: **Vĩnh viễn**.
* Hồ sơ vụ án hành chính: **Vĩnh viễn**.
* Hồ sơ vụ việc dân sự: **Vĩnh viễn**.
* Hồ sơ thi hành án hình sự: **10 năm, 70 năm, hoặc Vĩnh viễn**.



#### **Sheet 2: Mục lục hồ sơ (Văn bản con)**

1. **Mã hồ sơ:** Cập nhật đúng theo thông tin hồ sơ mẹ.
2. **Mã hồ sơ con:** Quy ước theo số thứ tự.
3. **Số tờ:** Số lượng tờ của văn bản.
4. **Tiêu đề:** Tên văn bản/trích yếu.
5. **Thời gian:** Căn cứ theo năm xét xử.

#### **Sheet 3: Vị trí lưu kho & Mã QR**

* **Cấu trúc vị trí:** Kho -> Dãy -> Giá -> Ngăn -> Hộp -> Mã QR hộp.
* **Quy tắc mã vị trí:** `[Mã kho] – [Dãy] – [Giá] – [Ngăn] – [Hộp]`
* *Ví dụ:* `K01-D02-G05-N03-H012` (Kho 1, Dãy 2, Giá 5, Ngăn 3, Hộp 12).


* **Quy trình quét mã:**
* Mỗi hộp có mã QR/mã vạch.
* Khi quét hoặc nhập mã: Hiển thị đường dẫn chi tiết `Kho → ... → Hộp → Danh sách hồ sơ bên trong`.


* **Ràng buộc:**
* Một hồ sơ = Một vị trí duy nhất.
* Hệ thống cảnh báo nếu trùng vị trí.



#### **Tiêu đề hộp (Nhãn hộp)**

Thông tin in trên vỏ hộp bao gồm:

* Tên cơ quan (Dựa trên lịch sử hình thành phông).
* Loại án và năm.
* Hộp số.
* Từ hồ sơ số ... đến hồ sơ số ...
* Thời hạn bảo quản.
* Mã số và mã vạch.

---

## 2. Tra cứu hồ sơ theo thẩm quyền

### Yêu cầu hệ thống

* Có web tra cứu nội bộ.
* Chạy VPN (nếu truy cập từ xa).
* Ghi lại nhật ký truy cập (Log).
* Các tài khoản không được phép xóa dữ liệu.

### Phân quyền tài khoản

1. **Tài khoản Upload:** Được phép upload Excel vào phần mềm.
2. **Tài khoản Quản trị (Admin):** Được phép chỉnh sửa nội dung (hệ thống lưu lịch sử chỉnh sửa).
3. **Tài khoản Xem chi tiết:** Được truy cập xem hết nội dung (Hồ sơ, mục lục, vị trí, trạng thái).
4. **Tài khoản Tra cứu cơ bản:**
* Chỉ xem được trạng thái hồ sơ (Đang lưu / Đang mượn).
* Xem thông tin định danh cơ bản: Loại án, Về việc, Bị cáo/Đương sự, Số bản án, Ngày tháng.



---

## 3. Quản lý mượn - trả, lịch sử truy vết

### Chức năng

* Lập phiếu mượn.
* Lưu lịch sử mượn - trả **vĩnh viễn**.
* Cảnh báo sắp đến hạn hoặc quá hạn trả hồ sơ.

### Thông tin phiếu mượn

* Ngày mượn.
* Người mượn: Họ tên, Chức danh, Đơn vị/Phòng ban.
* Lý do mượn.
* Thời hạn mượn.
* Người cho mượn (Cán bộ lưu trữ).

### Quản lý Phông lưu trữ (Lịch sử tên cơ quan)

Hệ thống phải quản lý được lịch sử hình thành phông để in đúng tên cơ quan trên bìa hồ sơ theo giai đoạn.

* *Ví dụ:*
* 1976 - 1996: TAND tỉnh Sông Bé.
* 1997 - 07/2025: TAND tỉnh Bình Dương.



---

## 4. Báo cáo - Thống kê

* Xuất Mục lục hồ sơ vĩnh viễn.
* Thống kê số lượng hồ sơ theo Năm / Loại án.
* Danh sách hồ sơ đang được mượn.

---

## 5. Bảo mật

* Không kết nối Internet công khai (Chạy mạng nội bộ/LAN).
* Log (ghi nhật ký) toàn bộ thao tác người dùng.
* Sao lưu dữ liệu offline định kỳ.
* Không cho phép Export dữ liệu hàng loạt (để tránh mất cắp dữ liệu lớn).

---

