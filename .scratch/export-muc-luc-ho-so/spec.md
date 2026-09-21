# Xuất Excel toàn bộ Mục lục hồ sơ

Status: ready-for-agent

## Problem Statement

Người dùng cần in đối chiếu toàn bộ Mục lục hồ sơ trong kho lưu trữ với hồ sơ giấy vật lý. Hiện tại không có cách nào xuất toàn bộ danh sách Hồ sơ (có thể hàng chục nghìn dòng) phục vụ mục đích này: export Excel hiện có ở trang Reports bị giới hạn 100 dòng cho hầu hết vai trò, thiếu các cột quan trọng (Số tờ, Nguyên đơn/Bị hại, Bị cáo/Bị đơn, STT), và không sắp xếp theo vị trí lưu trữ vật lý (Hộp số → Mã hồ sơ) nên khó dùng để đối chiếu tuần tự trong kho.

## Solution

Thêm một nút "Xuất Excel toàn bộ" trên màn hình danh sách Hồ sơ, tách biệt với export Excel ở trang Reports và với các thao tác hàng loạt theo lựa chọn dòng. Khi bấm, hệ thống hiện dialog xác nhận ghi rõ số dòng sẽ xuất (theo bộ lọc/tìm kiếm đang áp dụng trên màn hình), sau đó tải về một file `.xlsx` chứa toàn bộ Hồ sơ khớp bộ lọc đó — không giới hạn số dòng — với 9 cột (STT, Hộp số, Mã hồ sơ, Nguyên đơn/Bị hại, Bị cáo/Bị đơn, Tiêu đề, Loại án, Năm, Số tờ), sắp xếp cố định theo Hộp số → Mã hồ sơ để phục vụ đối chiếu vật lý trong kho. Chỉ vai trò SUPER_ADMIN và ADMIN được phép thực hiện thao tác này.

## User Stories

1. As a SUPER_ADMIN, I want xuất toàn bộ Mục lục hồ sơ ra Excel, so that tôi có thể in ra và đối chiếu với hồ sơ giấy trong kho lưu trữ.
2. As an ADMIN, I want xuất toàn bộ Mục lục hồ sơ ra Excel, so that tôi có thể thực hiện kiểm kê định kỳ kho lưu trữ mà không bị giới hạn số dòng.
3. As a VIEWER, I want nút "Xuất Excel toàn bộ" bị ẩn hoặc vô hiệu hóa (và API trả 403 nếu cố gọi trực tiếp), so that tôi không thể xuất hàng loạt dữ liệu nhạy cảm (tên bị cáo, bị hại) mà mình không có quyền.
4. As a COORDINATOR, I want nút "Xuất Excel toàn bộ" bị ẩn hoặc vô hiệu hóa (và API trả 403 nếu cố gọi trực tiếp), so that phạm vi dữ liệu tôi truy cập chỉ giới hạn ở các hồ sơ tôi tạo, không được xuất toàn hệ thống.
5. As an ADMIN đang lọc theo Hộp số cụ thể, I want file xuất ra chỉ chứa các Hồ sơ khớp bộ lọc đó, so that tôi có thể đối chiếu đúng một hộp thay vì toàn bộ kho.
6. As an ADMIN đang tìm kiếm theo tên đương sự, I want file xuất ra chỉ chứa kết quả khớp tìm kiếm, so that tôi nhận đúng tập dữ liệu mình đang xem trên màn hình.
7. As an ADMIN không áp dụng bộ lọc nào, I want file xuất ra chứa toàn bộ Hồ sơ trong hệ thống (ví dụ 10.000 dòng), so that tôi có một Mục lục hồ sơ đầy đủ của toàn bộ kho.
8. As an ADMIN, I want thấy dialog xác nhận ghi rõ số dòng sẽ được xuất trước khi bắt đầu tải, so that tôi tránh bấm nhầm khi số liệu lớn và mất thời gian chờ ngoài ý muốn.
9. As an ADMIN, I want có thể hủy thao tác xuất ở dialog xác nhận, so that tôi có thể điều chỉnh lại bộ lọc trước khi xuất nếu số dòng không như mong đợi.
10. As an ADMIN, I want các dòng trong file xuất ra được sắp xếp theo Hộp số rồi đến Mã hồ sơ, so that thứ tự trên giấy khớp với thứ tự vật lý của Hồ sơ trong kho, bất kể tôi đang sắp xếp cột nào trên màn hình.
11. As an ADMIN, I want mỗi dòng có số thứ tự (STT) liên tục 1..N theo đúng thứ tự Hộp số → Mã hồ sơ, so that tôi dễ dàng đếm và đối chiếu tuần tự khi kiểm kê.
12. As an ADMIN, I want cột "Nguyên đơn/Bị hại" và "Bị cáo/Bị đơn" hiển thị đầy đủ tất cả các bên liên quan trong một ô (nối bằng dấu phẩy) khi một Hồ sơ có nhiều người, so that tôi không bị mất thông tin so với những gì hiển thị trên màn hình danh sách.
13. As an ADMIN, I want Hồ sơ chưa gán vào Hộp nào hiển thị ô "Hộp số" trống trong file xuất, so that tôi biết đây là hồ sơ cần xử lý xếp hộp, không bị nhầm là lỗi dữ liệu.
14. As an ADMIN, I want tên file tải về có định dạng `muc-luc-ho-so_YYYYMMDD_HHmm.xlsx`, so that tôi phân biệt được các lần xuất khác nhau khi lưu trữ nhiều file.
15. As an ADMIN, I want thao tác xuất hoàn tất trong một lần tải (không cần theo dõi tiến trình nền), so that trải nghiệm đơn giản, không cần quay lại kiểm tra trạng thái sau.
16. As a maintainer của module RBAC, I want permission `exportFiles` được định nghĩa độc lập với `manageFiles`, so that thay đổi phạm vi `manageFiles` trong tương lai không vô tình ảnh hưởng tới ai được xuất Mục lục hồ sơ.
17. As a developer viết test cho endpoint này, I want có thể assert trực tiếp trên nội dung buffer `.xlsx` trả về (cột, thứ tự, giá trị), so that tôi xác nhận đúng hành vi mà không phải dựng UI thật.
18. As an ADMIN xuất khi không có Hồ sơ nào khớp bộ lọc, I want nhận được file Excel hợp lệ chỉ có dòng tiêu đề (0 dòng dữ liệu) thay vì lỗi, so that tôi không bị gián đoạn bởi trường hợp biên.
19. As an ADMIN, I want nút "Xuất Excel toàn bộ" tách biệt rõ ràng khỏi các nút thao tác hàng loạt theo lựa chọn dòng (ví dụ "In bìa hồ sơ", "Chuyển vào hộp"), so that tôi không nhầm lẫn giữa xuất toàn bộ theo bộ lọc và thao tác trên các dòng đã chọn.
20. As an ADMIN, I want thao tác xuất không bị chặn bởi giới hạn 100-dòng đang áp dụng cho export ở trang Reports, so that tôi có thể xuất đúng số lượng Hồ sơ thực tế (có thể hàng chục nghìn).
21. As a developer bảo trì hệ thống, I want endpoint export mới tái sử dụng thư viện `xlsx` đã có trong dự án, so that không phải thêm phụ thuộc mới chỉ cho tính năng này.
22. As an ADMIN, I want giá trị cột "Loại án" trong file xuất khớp với giá trị đang lọc/hiển thị trên màn hình, so that dữ liệu xuất ra nhất quán với những gì tôi thấy trước khi xuất.

## Implementation Decisions

- **Endpoint mới**: một route export riêng trong cùng nhóm API của Hồ sơ (cạnh `GET /api/files`), tái sử dụng logic xây dựng điều kiện lọc (`where`) hiện có của danh sách Hồ sơ — bộ lọc đầy đủ hơn so với export ở Reports (vốn chỉ hỗ trợ một tập con: `from/to`, `type`, `status`, `warehouse`). Không tái sử dụng route export của Reports.
- **Sắp xếp**: bỏ qua tham số sort trên query string của màn hình; luôn sắp xếp kết quả theo Hộp số (qua quan hệ tới Hộp) rồi đến Mã hồ sơ.
- **Định dạng phản hồi**: buffer `.xlsx`, dùng lại thư viện `xlsx` (SheetJS) đã có trong dự án, theo cùng cách dựng sheet (`json_to_sheet` + `write`) như export ở Reports hiện tại. Header `Content-Disposition` đặt tên file theo mẫu `muc-luc-ho-so_YYYYMMDD_HHmm.xlsx` (thời điểm xuất).
- **Ánh xạ cột → dữ liệu**:
  - STT: số thứ tự dòng trong kết quả đã sắp xếp, không lưu trong schema.
  - Hộp số: lấy từ Hộp liên kết với Hồ sơ; để trống nếu Hồ sơ chưa gán Hộp.
  - Mã hồ sơ, Tiêu đề, Loại án, Năm, Số tờ: lấy trực tiếp từ các trường tương ứng của Hồ sơ.
  - Nguyên đơn/Bị hại: nối các giá trị bằng dấu phẩy trong một ô.
  - Bị cáo/Bị đơn: gộp và nối bằng dấu phẩy các giá trị từ hai trường Bị cáo (hình sự) và Bị đơn dân sự.
- **Không giới hạn số dòng**: khác với export ở Reports (giới hạn 100 dòng trừ SUPER_ADMIN), endpoint mới không áp dụng giới hạn này.
- **Xử lý đồng bộ**: toàn bộ truy vấn + dựng file diễn ra trong một request/response duy nhất, không dùng job nền.
- **Phân quyền**: thêm permission mới `exportFiles = [SUPER_ADMIN, ADMIN]` vào cả hai bảng permission (client và server). Không sửa permission `manageFiles` hiện có, dù nó đang không nhất quán giữa hai bảng (xem `docs/adr/0001-export-files-permission.md`) — nằm ngoài phạm vi tính năng này.
- **Giao diện**: nút "Xuất Excel toàn bộ" mới trên toolbar của màn hình danh sách Hồ sơ, tách biệt khỏi vùng thao tác hàng loạt theo lựa chọn dòng. Chỉ hiển thị/kích hoạt cho vai trò có quyền `exportFiles`. Bấm nút mở dialog xác nhận hiển thị số dòng sẽ xuất (tái sử dụng tổng số đã có sẵn từ truy vấn phân trang hiện tại của màn hình, không gọi thêm API đếm riêng). Xác nhận thì gọi endpoint export mới với đúng các tham số bộ lọc đang áp dụng, rồi kích hoạt tải file về.

## Testing Decisions

- **Một seam duy nhất**: contract test ở tầng HTTP cho endpoint export mới, theo đúng pattern đã có trong `server/contracts/files.contract.test.ts` và `server/contracts/cases-reports.contract.test.ts` — dựng app thật, mock tầng DB, giả lập cookie phiên đăng nhập theo vai trò, gọi trực tiếp qua `app.handle()`.
- Test chỉ khẳng định **hành vi bên ngoài** (request vào → response ra: status code, header, nội dung buffer `.xlsx`, các tham số được truyền xuống tầng DB mock), không test chi tiết cách hàm nội bộ được cài đặt.
- Các trường hợp cần cover:
  - 200 cho `SUPER_ADMIN`/`ADMIN`; 403 cho `VIEWER`/`COORDINATOR`.
  - Điều kiện lọc truyền xuống DB phản ánh đúng tham số query string.
  - Thứ tự sắp xếp truyền xuống DB luôn cố định theo Hộp số → Mã hồ sơ, bất kể tham số sort trong query.
  - Nội dung buffer (parse lại bằng thư viện `xlsx`) đúng 9 cột theo thứ tự, STT liên tục, các trường nhiều giá trị nối đúng bằng dấu phẩy, tên file trong header `Content-Disposition` đúng định dạng.
  - Trường hợp không có Hồ sơ nào khớp bộ lọc: trả về file hợp lệ chỉ có dòng tiêu đề.
- **Tiền lệ trong repo**: `cases-reports.contract.test.ts` (test export `.xlsx` — kiểm tra status và content-type), `audit-reports.contract.test.ts` (test giới hạn số dòng theo vai trò), `files.contract.test.ts` (test 403 theo vai trò, test tham số `where`/`orderBy` truyền xuống DB mock).
- Không cần seam kiểm thử riêng ở tầng UI/component (nút + dialog xác nhận) — đã thống nhất với người dùng chỉ dùng một seam duy nhất ở tầng contract test.

## Out of Scope

- Sửa sự không nhất quán của permission `manageFiles` giữa bảng phân quyền phía client và phía server — đã ghi nhận ở ADR-0001, để lại cho một thay đổi riêng.
- Xử lý xuất theo kiểu chạy nền/hàng đợi cho quy mô rất lớn — bản đầu xử lý đồng bộ trong một request; sẽ xem xét lại nếu số Hồ sơ thực tế vượt xa mức đã ước lượng (~10.000 dòng).
- Tách "Nguyên đơn" và "Bị hại" thành hai trường dữ liệu riêng biệt trong schema (hiện đang gộp chung, xem `CONTEXT.md`) — không nằm trong phạm vi tính năng này.
- Mẫu mục lục hồ sơ theo quy định lưu trữ nhà nước (nếu có) — chưa có yêu cầu/tài liệu xác nhận trong repo, không áp dụng ở bản đầu.
- Nhóm các dòng theo Hộp số (ngắt dòng phân cách/tổng theo hộp trong file Excel) — bản đầu là một bảng phẳng.
- Gộp chung logic với export ở trang Reports — hai tính năng export vẫn tách biệt hoàn toàn.

## Further Notes

- Export ở trang Reports hiện tại có ghi log kiểm toán khi xuất (thấy trong test hiện có của `cases-reports.contract.test.ts`, route Reports gọi tạo bản ghi `auditLog`). Tính năng này nên cân nhắc áp dụng cùng convention (ghi lại ai xuất, khi nào, bao nhiêu dòng) vì đây là thao tác xuất hàng loạt dữ liệu nhạy cảm (tên bị cáo, bị hại) — quyết định cụ thể chưa được chốt trong phiên grilling ban đầu, cần xác nhận thêm khi triển khai.
- Thuật ngữ trong spec này dùng đúng theo `CONTEXT.md` của repo (Hồ sơ, Mục lục hồ sơ, Hộp, Mã hồ sơ, Nguyên đơn/Bị hại, Bị cáo/Bị đơn).
- Quyết định phân quyền tham chiếu `docs/adr/0001-export-files-permission.md`.
