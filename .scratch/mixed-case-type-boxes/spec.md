# Hộp lẫn loại án

Status: ready-for-agent

## Problem Statement

Hộp có nhãn Loại án riêng, nhưng hệ thống không ràng buộc Loại án của các Hồ sơ nằm trong Hộp phải khớp nhãn đó. Thực tế ở Long An (2026-09-26): 38 Hộp chứa Hồ sơ thuộc từ 2 Loại án trở lên, và 81 Hộp có ít nhất một Hồ sơ khác nhãn Hộp (498 Hồ sơ). Một số Hộp lệch nhẹ (1 Hồ sơ lạc loại), một số lẫn nửa-nửa, một số có đa số Hồ sơ khác nhãn — nghĩa là nhãn trên bìa Hộp có thể đang sai và người đi kho sẽ tìm nhầm. SUPER_ADMIN hiện không có cách nào nhìn thấy các trường hợp này, nên cũng không thể quyết định cách xử lý (đổi nhãn, chuyển Hồ sơ, sửa Loại án của Hồ sơ, hay chấp nhận xếp gửi).

## Solution

Thêm tab thứ hai "Hộp lẫn loại án" trên trang Chuẩn hoá dữ liệu (cạnh tab "Loại án" hiện có). Tab này chỉ đọc: liệt kê mọi Hộp có Hồ sơ khác nhãn Loại án của Hộp, phân theo kiểu vấn đề (Lẫn nhiều loại án / Nhãn khác hồ sơ / Hộp chưa có nhãn) và mức độ (🔴 Nhãn sai / 🟠 Lẫn đáng kể / 🟡 Lệch lẻ), với ô tổng quan, bộ lọc, thanh tỉ lệ Loại án trong từng Hộp, và danh sách Hồ sơ lệch khi mở một Hộp. Không có thao tác sửa dữ liệu nào — SUPER_ADMIN dùng thông tin này để cân nhắc phương án xử lý sau.

## User Stories

1. As a SUPER_ADMIN, I want thấy danh sách mọi Hộp có Hồ sơ khác nhãn Loại án của Hộp, so that tôi biết quy mô của vấn đề xếp lẫn trong kho.
2. As a SUPER_ADMIN, I want các ô tổng quan ở đầu tab cho biết số Hộp theo từng mức độ, theo từng kiểu vấn đề, và tổng số Hồ sơ lệch, so that tôi nắm bức tranh chung trước khi đi vào chi tiết.
3. As a SUPER_ADMIN, I want mỗi Hộp được gắn kiểu "Lẫn nhiều loại án" khi các Hồ sơ trong Hộp thuộc từ 2 Loại án trở lên, so that tôi phân biệt Hộp xếp lẫn với Hộp chỉ sai nhãn.
4. As a SUPER_ADMIN, I want mỗi Hộp được gắn kiểu "Nhãn khác hồ sơ" khi mọi Hồ sơ cùng một Loại án nhưng khác nhãn Hộp, so that tôi nhận ra Hộp có thể chỉ cần đổi nhãn.
5. As a SUPER_ADMIN, I want Hộp chưa có nhãn Loại án nhưng có chứa Hồ sơ được xếp vào nhóm riêng "Hộp chưa có nhãn", so that chúng không bị trộn với các Hộp sai nhãn.
6. As a SUPER_ADMIN, I want Hộp có hơn 50% Hồ sơ lệch được đánh dấu 🔴 "Nhãn sai", so that tôi ưu tiên kiểm tra những Hộp mà nhãn bìa có thể đang dẫn người đi kho tìm nhầm.
7. As a SUPER_ADMIN, I want Hộp có từ 20% Hồ sơ lệch trở lên (nhưng không quá 50%) được đánh dấu 🟠 "Lẫn đáng kể", so that tôi biết Hộp nào cần kiểm tra thực tế trong kho.
8. As a SUPER_ADMIN, I want các Hộp còn lại có Hồ sơ lệch được đánh dấu 🟡 "Lệch lẻ", so that tôi biết đây nhiều khả năng là Hồ sơ gán nhầm Hộp hoặc nhập sai Loại án.
9. As a SUPER_ADMIN, I want danh sách sắp theo mức độ nghiêm trọng rồi theo tỉ lệ lệch giảm dần, so that những Hộp đáng lo nhất luôn ở đầu.
10. As a SUPER_ADMIN, I want lọc danh sách theo mức độ, so that tôi tập trung xử lý từng nhóm.
11. As a SUPER_ADMIN, I want lọc danh sách theo kiểu vấn đề, so that tôi xem riêng Hộp xếp lẫn hoặc Hộp sai nhãn.
12. As a SUPER_ADMIN, I want lọc danh sách theo tổ hợp Loại án (ví dụ "Dân sự sơ thẩm + Hôn nhân sơ thẩm"), so that tôi phát hiện các kiểu xếp lẫn lặp lại có hệ thống.
13. As a SUPER_ADMIN, I want mỗi Hộp hiện Hộp số, nhãn Loại án, vị trí (Kho → Dãy → Kệ → Ô), số Hồ sơ lệch trên tổng số Hồ sơ và tỉ lệ lệch, so that tôi xác định được Hộp và mức lệch ngay trên một dòng.
14. As a SUPER_ADMIN, I want mỗi Hộp có một thanh ngang thể hiện tỉ lệ các Loại án bên trong, so that tôi thấy ngay thành phần của Hộp mà không cần đọc số.
15. As a SUPER_ADMIN, I want mở một Hộp để xem danh sách Hồ sơ lệch (Mã hồ sơ, Tiêu đề, Năm, Loại án), so that tôi biết chính xác Hồ sơ nào đang lạc loại.
16. As a SUPER_ADMIN, I want các Hồ sơ đúng nhãn chỉ hiện dưới dạng số lượng khi mở Hộp, so that danh sách chi tiết ngắn và tập trung vào vấn đề.
17. As a SUPER_ADMIN, I want bấm vào Mã hồ sơ để mở trang chi tiết Hồ sơ ở tab mới, so that tôi xem được toàn bộ thông tin mà không mất vị trí đang xem.
18. As a SUPER_ADMIN, I want tab nhắc rằng nên chuẩn hoá Loại án ở tab "Loại án" trước, so that tôi hiểu lỗi chính tả (ví dụ "Hình sự" và "Hình sự sơ thẩm") đang làm số ca lệch cao hơn thực tế.
19. As a SUPER_ADMIN, I want so sánh Loại án là so sánh chính xác sau khi trim, không bỏ qua khác biệt cách viết, so that con số phản ánh đúng dữ liệu đang lưu, và biến mất đúng lúc khi tôi đã chuẩn hoá xong.
20. As a SUPER_ADMIN, I want Hồ sơ đã xoá mềm (ARCHIVED) không được tính, so that danh sách chỉ phản ánh hồ sơ đang thực sự nằm trong kho.
21. As a SUPER_ADMIN, I want Hồ sơ chưa có Loại án không được tính là lệch, so that chúng chỉ được xử lý một chỗ duy nhất ở tab "Loại án".
22. As a SUPER_ADMIN, I want thấy trạng thái trống rõ ràng khi không còn Hộp nào lệch, so that tôi biết kho đã sạch.
23. As a SUPER_ADMIN, I want số liệu tab này tự làm mới sau khi tôi đổi tên hoặc điền Loại án ở tab "Loại án", so that tôi thấy ngay tác động của việc chuẩn hoá.
24. As an ADMIN, VIEWER hoặc COORDINATOR, I want không thấy tab này và API trả 403 nếu gọi trực tiếp, so that phạm vi quyền giữ nguyên như tab "Loại án".
25. As a SUPER_ADMIN, I want tab này không có bất kỳ nút sửa dữ liệu nào, so that tôi có thể xem xét thoải mái mà không lo vô tình thay đổi dữ liệu kho.

## Implementation Decisions

- **Vị trí UI**: trang Chuẩn hoá dữ liệu chuyển sang dạng tab; tab "Loại án" giữ nguyên nội dung hiện có, tab mới "Hộp lẫn loại án". Tab đang chọn nên phản ánh trên URL (query string) để có thể chia sẻ/tải lại đúng tab.
- **Phân quyền**: dùng permission `manageStorage` hiện có (chỉ SUPER_ADMIN), giống tab "Loại án". Không đổi bảng phân quyền.
- **Chỉ đọc**: không endpoint ghi, không thay đổi schema, không lưu trạng thái "đã xác nhận".
- **API mới** (chỉ đọc) trong cùng nhóm route Chuẩn hoá dữ liệu, trả về:
  - `summary`: số Hộp theo mức độ, theo kiểu vấn đề, tổng số Hộp lệch, tổng số Hồ sơ lệch.
  - `boxes`: mỗi Hộp gồm id, Hộp số, mã hộp, vị trí (Kho, Dãy, Kệ, Ô), nhãn Loại án (null nếu chưa có), kiểu vấn đề, mức độ, tổng số Hồ sơ được tính, số Hồ sơ lệch, tỉ lệ lệch, thành phần Loại án (mỗi Loại án kèm số Hồ sơ, sắp giảm dần), tổ hợp Loại án (chuỗi ổn định dùng để lọc), và danh sách Hồ sơ lệch (id, Mã hồ sơ, Tiêu đề, Năm, Loại án).
  - Trả toàn bộ danh sách trong một lần (quy mô ~100 Hộp, ~500 Hồ sơ lệch mỗi tỉnh); lọc và sắp xếp phía client.
- **Tập Hồ sơ được tính**: Hồ sơ có Hộp, không ARCHIVED, Loại án không rỗng sau trim.
- **Định nghĩa lệch**: Loại án của Hồ sơ (trim) khác nhãn Loại án của Hộp (trim), so sánh chính xác. Hộp có nhãn rỗng/null coi như chưa có nhãn.
- **Kiểu vấn đề** (mỗi Hộp đúng một kiểu):
  - `unlabeled` — Hộp chưa có nhãn nhưng có Hồ sơ được tính.
  - `mixed` — Hồ sơ được tính thuộc từ 2 Loại án trở lên (và Hộp có nhãn).
  - `label-mismatch` — Hồ sơ được tính chỉ có 1 Loại án và khác nhãn Hộp.
  - Hộp không có Hồ sơ lệch không xuất hiện trong kết quả.
- **Mức độ** theo tỉ lệ lệch = số Hồ sơ lệch / tổng số Hồ sơ được tính trong Hộp: `> 50%` → 🔴 Nhãn sai; `≥ 20%` → 🟠 Lẫn đáng kể; còn lại → 🟡 Lệch lẻ. Hộp `unlabeled` có tỉ lệ 100% nên luôn 🔴. Các ngưỡng đặt thành hằng số dễ chỉnh.
- **Sắp xếp mặc định**: mức độ (🔴 → 🟠 → 🟡), rồi tỉ lệ lệch giảm dần, rồi Hộp số (so sánh số tự nhiên).
- **Hàm phân loại thuần**: nhận dữ liệu thô (Hộp + các Hồ sơ được tính của nó) và trả về kiểu vấn đề, mức độ, tỉ lệ, thành phần, tổ hợp, danh sách Hồ sơ lệch; route chỉ lo truy vấn và gọi hàm này. Việc truy vấn chỉ lấy các Hộp có ít nhất một Hồ sơ lệch để giữ response nhỏ.
- **UI**:
  - Dòng nhắc chuẩn hoá Loại án trước, có liên kết sang tab "Loại án".
  - Ô tổng quan: 3 ô mức độ + các ô kiểu vấn đề + tổng Hồ sơ lệch; bấm ô mức độ/kiểu = áp bộ lọc tương ứng.
  - Bộ lọc: mức độ, kiểu vấn đề, tổ hợp Loại án (danh sách lấy từ dữ liệu).
  - Mỗi dòng Hộp: huy hiệu mức độ, huy hiệu kiểu vấn đề, Hộp số, nhãn (hiện "(chưa có nhãn)" nếu null), vị trí, "N/M hồ sơ lệch (x%)", thanh tỉ lệ Loại án có chú thích màu; mở rộng để xem Hồ sơ lệch và dòng "và K hồ sơ đúng nhãn".
  - Màu thanh tỉ lệ: Loại án trùng nhãn Hộp dùng màu trung tính, các Loại án khác dùng bảng màu phân loại; màu mức độ luôn kèm chữ/biểu tượng, không chỉ dựa vào màu.
  - Invalidate chung query key nhóm Chuẩn hoá dữ liệu, nên thao tác ở tab "Loại án" làm mới luôn tab này.
- Thuật ngữ theo `CONTEXT.md` (Hộp, Hồ sơ, Loại án, Hộp số, Mã hồ sơ).

## Testing Decisions

- Hai seam, đã thống nhất với người dùng:
  1. **Unit test cho hàm phân loại thuần** — kiểu vấn đề (`mixed` / `label-mismatch` / `unlabeled`), ngưỡng mức độ ở đúng biên (50%, 20%), so sánh sau trim nhưng không bỏ qua khác biệt cách viết ("Hình sự" ≠ "Hình sự sơ thẩm"), Hộp không lệch bị loại, thứ tự thành phần Loại án, chuỗi tổ hợp ổn định, sắp xếp mặc định.
  2. **Contract test tầng HTTP cho API** — 401/403 cho người chưa đăng nhập/ADMIN/VIEWER/COORDINATOR, 200 cho SUPER_ADMIN; hình dạng `summary` và `boxes`; điều kiện truy vấn loại Hồ sơ ARCHIVED và Hồ sơ có Loại án rỗng.
- Chỉ khẳng định hành vi bên ngoài (đầu vào → đầu ra), không kiểm tra cách hàm nội bộ được cài đặt.
- **Tiền lệ trong repo**: unit test hàm thuần và contract test của tab "Loại án" (dựng app với route Chuẩn hoá dữ liệu, fake DB qua cơ chế thay DB cho test, cookie phiên theo vai trò, gọi `app.handle()`).
- Không có test component UI riêng.

## Out of Scope

- Mọi thao tác sửa dữ liệu: đổi nhãn Hộp, chuyển Hồ sơ sang Hộp khác, sửa Loại án của Hồ sơ.
- Lưu trạng thái "đã xác nhận xếp gửi hợp lệ" cho Hộp hoặc Hồ sơ (cần thay đổi schema).
- Khai báo các cặp Loại án được phép xếp chung (ví dụ Dân sự sơ thẩm + Dân sự phúc thẩm).
- Xuất Excel danh sách Hộp lệch.
- Phân biệt "chỉ khác cách viết" với "khác Loại án thật" — việc này thuộc tab "Loại án".
- Cảnh báo khi gán Hồ sơ vào Hộp khác Loại án (form Hồ sơ, "Chuyển vào hộp", import Excel).
- Quyết định ý nghĩa nghiệp vụ của nhãn Loại án trên Hộp (nhãn bìa cho phép xếp gửi hay quy tắc bắt buộc) — để SUPER_ADMIN cân nhắc sau khi có dữ liệu từ tab này.
- Hiển thị Loại án cạnh Hộp số trên bảng Hồ sơ (vấn đề ban đầu).

## Further Notes

- Số liệu tham khảo từ bản sao `longan_db` (2026-09-26, đã loại Hồ sơ ARCHIVED và Loại án rỗng): 81 Hộp có Hồ sơ khác nhãn (498 Hồ sơ), trong đó 38 Hộp lẫn từ 2 Loại án trở lên, 43 Hộp chỉ một Loại án nhưng khác nhãn, 47 Hộp có đa số Hồ sơ khác nhãn. Phần lớn 43 Hộp "Nhãn khác hồ sơ" là do cách viết nhãn (ví dụ Hộp 1–34 nhãn "Hình sự" chứa Hồ sơ "Hình sự sơ thẩm") — sẽ giảm mạnh sau khi chuẩn hoá ở tab "Loại án".
- Tổ hợp thường gặp: Dân sự sơ thẩm + Hôn nhân sơ thẩm (26 Hộp), Dân sự phúc thẩm + Dân sự sơ thẩm (6), Hình sự sơ thẩm + Hôn nhân sơ thẩm (3), Dân sự sơ thẩm + Kinh doanh thương mại (2), Dân sự sơ thẩm + Hình sự sơ thẩm (1).
- Liên quan: `.scratch/case-type-cleanup/spec.md` (tab "Loại án", nền tảng của trang Chuẩn hoá dữ liệu).
