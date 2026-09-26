# Chuẩn hoá Loại án

Status: done

## Problem Statement

Loại án được nhập dưới dạng chuỗi tự do trên cả Hộp và Hồ sơ, nên dữ liệu thực tế đã bị bẩn: ở Long An (kiểm tra ngày 2026-09-26), riêng "Hôn nhân sơ thẩm" có 11 cách viết khác nhau trên Hộp ("Hơn nhân sơ thẩm", "oon nhân sơ thẩm", "Hôn Nhânsưo thẩm"…), Hồ sơ có cả "Dân sự" lẫn "Dân sự sơ thẩm", và có hai giá trị "Hình sự" chỉ khác nhau ở khoảng trắng. Điều này chặn mọi cải tiến hiển thị Loại án cạnh Hộp số trên bảng hồ sơ (vấn đề ban đầu), làm sai số liệu thống kê/lọc theo Loại án, và không có công cụ nào để người dùng tự nhìn thấy và sửa.

## Solution

Một trang admin mới "Chuẩn hoá dữ liệu", tính năng đầu tiên là chuẩn hoá Loại án. Trang liệt kê mọi giá trị Loại án đang tồn tại (group theo chuỗi chính xác), mỗi dòng cho biết bao nhiêu Hộp và bao nhiêu Hồ sơ đang mang đúng giá trị đó, sắp theo chuỗi đã bỏ dấu để các biến thể sai chính tả nằm cạnh nhau. Admin sửa từng dòng bằng cách gõ lại giá trị đúng (có autocomplete từ các giá trị đang có); hệ thống cho biết đây là gộp vào nhóm có sẵn hay tạo Loại án mới, hiện xem trước số bản ghi sẽ đổi, và khi xác nhận thì cập nhật mọi Hộp và Hồ sơ đang mang đúng chuỗi cũ trong một transaction, ghi audit log. Hộp và Hồ sơ chưa có Loại án cũng được liệt kê thành một dòng riêng; mở ra để điền Loại án cho từng bản ghi. Đồng thời server trim khoảng trắng khi lưu Loại án để lỗi khoảng trắng không phát sinh lại. Chỉ SUPER_ADMIN được dùng tính năng này.

## User Stories

1. As a SUPER_ADMIN, I want thấy toàn bộ các giá trị Loại án đang tồn tại trong dữ liệu của tỉnh mình, so that tôi phát hiện được các cách viết sai chính tả.
2. As a SUPER_ADMIN, I want mỗi giá trị hiện số Hộp và số Hồ sơ đang mang đúng giá trị đó, so that tôi biết lỗi đó ảnh hưởng tới bao nhiêu bản ghi.
3. As a SUPER_ADMIN, I want các giá trị được sắp theo chuỗi đã bỏ dấu tiếng Việt, so that "Hôn nhân sơ thẩm", "Hơn nhân sơ thẩm", "Hôn nhấn sơ thẩm" nằm gần nhau và tôi dễ so sánh.
4. As a SUPER_ADMIN, I want các giá trị có khoảng trắng thừa (đầu/cuối/liên tiếp) được đánh dấu rõ ràng, so that tôi phân biệt được hai dòng trông giống hệt nhau như "Hình sự" và "Hình sự ".
5. As a SUPER_ADMIN, I want sửa một giá trị bằng cách gõ lại giá trị đúng, so that mọi Hộp và Hồ sơ đang dùng giá trị sai đều được cập nhật một lần.
6. As a SUPER_ADMIN, I want ô nhập có autocomplete từ các giá trị đang tồn tại, so that tôi không gõ sai thêm lần nữa khi sửa.
7. As a SUPER_ADMIN, I want được báo rõ "Sẽ gộp vào nhóm X (N hộp, M hồ sơ)" khi giá trị tôi gõ trùng một nhóm có sẵn, so that tôi biết mình đang gộp chứ không tạo mới.
8. As a SUPER_ADMIN, I want được cảnh báo "Tạo Loại án mới" khi giá trị tôi gõ chưa tồn tại, so that tôi nhận ra nếu mình vừa gõ sai.
9. As a SUPER_ADMIN, I want thấy xem trước số Hộp và số Hồ sơ sẽ bị đổi trước khi xác nhận, so that tôi tránh sửa nhầm hàng loạt.
10. As a SUPER_ADMIN, I want việc sửa chỉ đụng tới các bản ghi mang đúng chuỗi cũ, so that Loại án của Hồ sơ không bị ghi đè chỉ vì Hồ sơ đó nằm trong một Hộp có Loại án sai.
11. As a SUPER_ADMIN, I want danh sách tự làm mới sau khi sửa, so that tôi thấy ngay dòng cũ biến mất và số liệu nhóm đích tăng lên.
12. As a SUPER_ADMIN, I want mọi lần sửa Loại án được ghi audit log (giá trị cũ, giá trị mới, người sửa, danh sách ID bị đổi), so that tôi truy vết và khôi phục thủ công được nếu cần.
13. As an ADMIN, VIEWER hoặc COORDINATOR, I want không thấy trang này và API trả 403 nếu gọi trực tiếp, so that chỉ người có trách nhiệm mới được sửa dữ liệu hàng loạt.
14. As a SUPER_ADMIN, I want thấy một dòng "(Chưa có Loại án)" với số Hộp và số Hồ sơ đang để trống, so that tôi biết còn bao nhiêu bản ghi thiếu phân loại.
15. As a SUPER_ADMIN, I want mở dòng đó ra để xem từng Hộp/Hồ sơ thiếu Loại án (Hộp số, Mã hồ sơ, Tiêu đề, Hộp chứa) và điền Loại án cho từng bản ghi, so that mỗi bản ghi nhận đúng Loại án của nó thay vì bị gán hàng loạt.
16. As a SUPER_ADMIN điền Loại án cho một Hồ sơ đang nằm trong Hộp đã có Loại án, I want ô nhập gợi ý sẵn Loại án của Hộp đó, so that tôi điền nhanh trong trường hợp phổ biến.
17. As a SUPER_ADMIN, I want Loại án tôi nhập ở form Hộp, form Hồ sơ hay qua import Excel được tự động trim khoảng trắng, so that lỗi khoảng trắng không quay lại sau khi đã dọn.

## Implementation Decisions

- **Trang mới**: route admin mới "Chuẩn hoá dữ liệu", không đặt trong trang Quản lý hộp — thao tác sửa cả Hồ sơ, và trang này sẽ chứa các công cụ làm sạch tiếp theo.
- **Phân quyền**: chỉ SUPER_ADMIN. Trang Chuẩn hoá dữ liệu và các API của nó dùng permission `manageStorage` hiện có (`[SUPER_ADMIN]`), không đổi bảng phân quyền và không đụng các API ghi Hộp hiện tại.
- **Nguồn dữ liệu**: gộp các giá trị `StorageBox.caseType` và `File.type`, group theo chuỗi chính xác (không trim, không hạ chữ). Mỗi dòng: giá trị, số Hộp có `caseType` bằng đúng giá trị, số Hồ sơ có `type` bằng đúng giá trị, cờ "có khoảng trắng thừa". Hộp có `caseType` null/rỗng và Hồ sơ có `type` rỗng (sau trim) được gom thành một dòng đặc biệt "(Chưa có Loại án)", không đổi tên hàng loạt được.
- **Hồ sơ đã xoá mềm (`status = ARCHIVED`)**: nằm ngoài toàn bộ tính năng — không đếm, không đổi tên, không liệt kê/điền — vì đã bị ẩn khỏi danh sách hồ sơ chính. Nhờ vậy số liệu hiển thị luôn khớp số bản ghi thực sự bị đổi. (Ở Long An, 61 hồ sơ "Dân sự" đều là hồ sơ đã xoá mềm.)
- **Trim khi lưu**: thực hiện một lần tại điểm ghi dữ liệu chung (Prisma extension trong `server/lib/db.ts`, cùng chỗ chuẩn hoá NFC), nên bao mọi đường ghi hiện tại và tương lai.
- **Sắp xếp**: theo chuỗi đã bỏ dấu tiếng Việt (gồm đ→d) và hạ chữ; không có thuật toán gợi ý độ giống nhau.
- **Thao tác sửa**: một dòng mỗi lần. Đầu vào: giá trị cũ (chính xác) và giá trị mới (server trim trước khi dùng). Từ chối nếu giá trị mới rỗng hoặc bằng giá trị cũ. Cập nhật mọi `StorageBox` có `caseType = cũ` và mọi `File` có `type = cũ` sang giá trị mới, trong một transaction. Trả về số Hộp và số Hồ sơ thực sự đã đổi.
- **Điền Loại án còn trống**: dòng "(Chưa có Loại án)" mở ra danh sách từng Hộp và Hồ sơ thiếu Loại án. Mỗi bản ghi có ô nhập riêng (autocomplete như trên); với Hồ sơ nằm trong Hộp đã có Loại án thì gợi ý sẵn Loại án của Hộp. Lưu từng bản ghi một qua API riêng, chỉ cho phép khi bản ghi đó hiện đang trống (tránh ghi đè), trim giá trị, ghi audit log.
- **Xem trước**: dựa trên số liệu đã có trong danh sách (dòng nguồn + nhóm đích nếu trùng), không cần endpoint xem trước riêng. Số liệu thực tế trả về sau khi áp dụng là nguồn sự thật.
- **Audit log**: một bản ghi mỗi lần sửa, gồm giá trị cũ, giá trị mới, danh sách ID Hộp và ID Hồ sơ bị đổi. Không có undo.
- Thuật ngữ theo `CONTEXT.md` (Loại án, Hộp, Hồ sơ).

## Testing Decisions

- Contract test tầng HTTP theo pattern `server/contracts/*.contract.test.ts` (dựng app thật, mock DB, giả lập cookie theo vai trò, gọi `app.handle()`).
- Cover: 200 cho SUPER_ADMIN, 403 cho ADMIN/VIEWER/COORDINATOR; điền Loại án từ chối khi bản ghi đã có Loại án; danh sách group đúng số đếm, đúng thứ tự bỏ dấu, đánh dấu khoảng trắng; sửa chỉ truyền điều kiện bằng-chính-xác xuống DB; từ chối giá trị rỗng/trùng; giá trị mới được trim; audit log được ghi với đủ thông tin.
- Test đơn vị cho hàm sắp xếp bỏ dấu và hàm phát hiện khoảng trắng thừa (thuần, không cần DB).

## Out of Scope

- Mở tính năng cho ADMIN: cần cấp `manageStorage` cho ADMIN và chuyển các API ghi Hộp/sơ đồ kho khỏi `requireSuperAdmin` — đã cân nhắc và hoãn để giảm phạm vi.

- Rà soát Hộp chứa Hồ sơ lệch Loại án (Long An: 47 hộp, 609 hồ sơ) — bước tiếp theo trên cùng trang.
- Hộp có Hộp số không phải dạng số, Hồ sơ chưa có Hộp.
- Danh mục Loại án cố định có ký hiệu viết tắt; form chỉ cho chọn trong danh mục.
- Tách Loại án và Cấp xét xử thành hai chiều.
- Hiển thị Loại án cạnh Hộp số trên bảng hồ sơ (vấn đề ban đầu) — làm sau khi dữ liệu đã sạch.
- Danh sách gợi ý Loại án hardcode trong `files.routes.ts` (dùng "Hình sự", "Hôn nhân gia đình"…) lệch với dữ liệu thực tế ("… sơ thẩm") — xử lý cùng lúc với danh mục cố định.
- Bug import Excel ghép Hộp chỉ theo Hộp số.
- Kiểm tra cách đánh số Hộp ở 3 DB Đồng Nai.

## Further Notes

- Số liệu Long An (2026-09-26, read-only): 1.194 hộp, 11.986 hồ sơ; Hộp số là một dãy chung 1–1187, mỗi Loại án chiếm một khoảng liên tục.
- Khuyến nghị admin chạy backup (trang Backup) trước khi chuẩn hoá hàng loạt.
