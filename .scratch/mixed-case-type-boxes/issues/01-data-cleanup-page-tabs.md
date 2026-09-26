# 01: Chuyển trang Chuẩn hoá dữ liệu sang dạng tab

**What to build:** Trang Chuẩn hoá dữ liệu có hai tab: "Loại án" (nội dung chuẩn hoá Loại án hiện có, không đổi hành vi) và "Hộp lẫn loại án" (tạm thời để trống, chỉ có tiêu đề/mô tả). Tab đang chọn phản ánh trên URL (query string) để tải lại hoặc chia sẻ link vẫn mở đúng tab; mặc định là "Loại án".

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Trang hiện hai tab "Loại án" và "Hộp lẫn loại án"
- [x] Tab "Loại án" giữ nguyên toàn bộ hành vi hiện có
- [x] Chọn tab cập nhật URL; mở URL có tham số tab thì chọn đúng tab; tham số lạ/thiếu thì về "Loại án"
- [x] Trang vẫn chỉ SUPER_ADMIN truy cập được
