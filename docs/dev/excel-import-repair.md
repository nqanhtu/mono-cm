# Bổ sung các trường bị thiếu khi import Excel

## Nguyên nhân và phòng ngừa

Parser cũ so khớp tuyệt đối tiêu đề cột. `Bị cáo/bị đơn` không khớp `Bị cáo/ bị đơn`, tương tự nguyên đơn, số và ngày bản án.

`server/lib/excel-parser.ts` hiện chuẩn hóa NFC, hoa/thường, khoảng trắng và khoảng trắng quanh `/` ở sheet hồ sơ. Cột trùng sau chuẩn hóa và ngày không hợp lệ tạo lỗi, chặn commit. Cột không nhận diện và thiếu cột tùy chọn tạo cảnh báo trong preview.

Ngày được lưu là 00:00 giờ Việt Nam (UTC+7), ví dụ `01/04/2023` → `2023-03-31T17:00:00Z`, giống thời điểm form nhập/sửa hồ sơ lưu từ trình duyệt ở Việt Nam. Kết quả không phụ thuộc múi giờ máy chủ; năm suy từ ngày cũng tính theo lịch Việt Nam. Ô Excel kiểu ngày được SheetJS dựng theo nửa đêm giờ máy chủ, đôi khi lệch vài giây (`2023-03-31T16:59:30Z` ở múi +07, hiển thị thành 31/03); parser lấy lại đúng ngày lịch trước khi quy đổi. Hồ sơ import trước bản sửa này lưu 00:00 UTC; vẫn hiển thị đúng ngày ở Việt Nam nhưng khác quy ước với form. Endpoint import cũ không có preview từ chối cả cảnh báo để tránh ghi thiếu không được xem trước. Ô nguồn trống vẫn hợp lệ. Cột `Bị đơn` riêng ánh xạ vào `civilDefendants`; cột gộp giữ quy ước cũ vào `defendants`.

Bản sửa chỉ có hiệu lực trên môi trường chạy code mới; sửa local không đồng nghĩa đã deploy.

## Script vận hành

`prisma/scripts/repair-excel-import.ts` mặc định chỉ đọc. Không import lại, không tạo hồ sơ, không đụng tài liệu hay lịch sử mượn/trả.

Kết nối qua `REPAIR_DATABASE_URL`, hoặc `--credentials-file /path/to/databases.md --port 25433`. Không truyền mật khẩu trực tiếp vào command hoặc ghi vào repo. Script xác minh database ở URL và `current_database()`.

### Xem trước

```sh
bun prisma/scripts/repair-excel-import.ts \
  --database tp_dongnai_db \
  --credentials-file /path/to/databases.md --port 25433 \
  --source /path/to/source.xlsx \
  --out /secure/path/preview.json
```

Preview chạy transaction `REPEATABLE READ READ ONLY`, ghép đúng mã hồ sơ, đối chiếu tiêu đề/loại án/năm/hộp. Bản báo cáo chứa SHA-256 nguồn, bản chụp trước và patch sau cho từng hồ sơ. Chỉ bổ sung `plaintiffs`, `defendants`, `judgmentNumber`, `judgmentDate` đang trống; đồng bộ các khóa tương ứng trong `details`, giữ nguyên khóa khác. Không chỉnh `datetime`, vị trí, số tờ, trạng thái, khóa hồ sơ hoặc người tạo. `updatedAt` thay đổi khi apply/rollback.

Mã trùng, không tìm thấy, sai nhận dạng, giá trị khác nguồn hoặc `details` xung đột đều chặn toàn bộ apply. Ô trống không xóa dữ liệu. Ngày nguồn không đọc được được ghi trong notes và bỏ qua riêng trường ngày, các trường hợp lệ còn lại vẫn có thể bổ sung sau khi duyệt.

### Duyệt và áp dụng

Chỉ chạy sau khi người vận hành đã duyệt báo cáo cụ thể và các notes. Dùng đúng digest in ra từ preview, không tự tính digest mới để bỏ qua báo cáo đã sửa.

```sh
bun prisma/scripts/repair-excel-import.ts \
  --database tp_dongnai_db --credentials-file /path/to/databases.md --port 25433 \
  --apply --plan /secure/path/preview.json --approve REVIEWED_DIGEST \
  --out /secure/path/receipt.json
```

Apply khóa các hồ sơ theo thứ tự ID và so sánh bản chụp hiện tại với preview, gồm `updatedAt`. Nếu dữ liệu đã thay đổi, toàn bộ transaction rollback; cần preview và duyệt lại. Script kiểm chứng giá trị sau cập nhật, lưu receipt quyền `0600` trước commit, ghi `AuditLog` trong cùng transaction. Receipt có trước/sau và danh sách trường để hoàn tác. Không ghi đè file báo cáo/receipt đã tồn tại. Giữ các file này trong thư mục riêng quyền `0700`, ngoài Git, không chia sẻ công khai vì có dữ liệu cá nhân.

Nếu kết nối mất lúc COMMIT, không suy đoán từ exit code hoặc sự tồn tại của receipt: kiểm tra `AuditLog.id = receipt.runId` và dữ liệu hiện tại để xác định transaction đã commit chưa. Receipt có thể đã được lưu dù transaction rollback.

### Hoàn tác

```sh
bun prisma/scripts/repair-excel-import.ts \
  --database tp_dongnai_db --credentials-file /path/to/databases.md --port 25433 \
  --rollback /secure/path/receipt.json --approve RECEIPT_DIGEST \
  --out /secure/path/rollback-receipt.json
```

Rollback yêu cầu nhật ký đợt vá và trạng thái hiện tại khớp receipt, không ghi đè chỉnh sửa phát sinh sau vá. Chỉ khôi phục các trường đã vá, cập nhật `updatedAt` và ghi audit mới; không xóa audit cũ. Sau apply nên preview lại: không còn thay đổi đề xuất cho phần đã bổ sung.

## Kiểm thử

```sh
bun test server/lib/excel-parser.test.ts server/lib/excel-repair.test.ts server/contracts/upload.contract.test.ts
```

Test SQL và CLI dùng PostgreSQL/WASM với dữ liệu giả, runtime cài ở thư mục tạm bên ngoài repo:

```sh
REPAIR_TEST_PGLITE=/absolute/path/to/@electric-sql/pglite/dist/index.js \
  bun test prisma/scripts/repair-excel-import.integration.test.ts
```

Kiểm tra preview không ghi, duyệt sai bị chặn, lỗi audit rollback toàn bộ cập nhật, apply, chạy lại không thay đổi, preview cũ bị chặn, rollback không ghi đè dữ liệu mới và khôi phục đúng trước vá. Runtime này một kết nối; không mô phỏng tranh chấp đa kết nối trên production.
