# Kế hoạch tài liệu và dọn dẹp repo

Cập nhật: 2026-09-20. Phạm vi kiểm kê: 39 file Markdown được Git theo dõi trước khi dọn, 13 file trong `.superpowers/sdd` bị Git bỏ qua, và các tham chiếu từ mã/cấu hình. Đây là kế hoạch dọn tài liệu; trạng thái tính năng cần kiểm chứng lại bằng test và môi trường chạy trước khi gọi là hoàn tất.

Kiến trúc triển khai hiện tại theo xác nhận của chủ dự án: **chỉ frontend chạy trên Vercel**. Backend được triển khai bằng Docker trên VPS qua GitHub Actions/GHCR. `vercel.json` chỉ cấu hình frontend; các mô tả backend Vercel Function trong tài liệu cũ đã lỗi thời.

## Giữ làm tài liệu sống

| File | Lý do | Việc cần làm |
| --- | --- | --- |
| `AGENTS.md` | Quy tắc dự án và điểm vào tài liệu nghiệp vụ mượn/trả | Giữ ngắn, kiểm tra lại khi đổi cấu trúc repo |
| `CLAUDE.md` | Cầu nối `@AGENTS.md` cho Claude | Giữ nếu còn dùng Claude |
| `Readme.md` | Điểm vào cho người phát triển | Đã viết lại theo frontend Vercel, backend VPS; tiếp tục cập nhật khi luồng deploy đổi |
| `docs/dev/borrow-return.md` | Trạng thái, quyền và các lỗi đã biết của nghiệp vụ mượn/trả | Giữ và đối chiếu lại với code mỗi khi sửa tính năng |
| `docs/BACKUP-RESTORE.md` | Runbook backup/restore có script tương ứng tại `scripts/pg-backup.sh`, `scripts/pg-verify-restore.sh` | Giữ; kiểm tra lại DB, phiên bản PostgreSQL, tên tỉnh và lệnh trước khi vận hành |
| `docs/DEPLOY.md` | Mô tả frontend Vercel và bốn backend service Docker theo cấu hình repo | Giữ và kiểm tra lại với workflow/compose mỗi khi deploy thay đổi |

`AGENTS.md` và `docs/dev/borrow-return.md` có tác dụng khác nhau: file đầu là chỉ dẫn cho agent, file sau là tài liệu nghiệp vụ. Không gộp nội dung chi tiết vào `AGENTS.md`.

## Hồ sơ thiết kế và kế hoạch theo phiên

Đã bỏ 16 plan và 15 spec dưới `docs/superpowers/`. Toàn bộ 16 plan còn checkbox chưa tích, nhưng nhiều tính năng đã có dấu vết trong source; checkbox cũ không dùng để xác định tình trạng thực tế. Git vẫn giữ lịch sử của các tài liệu đã xóa. Bảng dưới là danh mục chủ đề cần đối chiếu khi phát triển tiếp, không phải xác nhận tính năng đã hoàn tất.

| Chủ đề | Plan cũ | Spec cũ | Dấu vết cần kiểm chứng khi phát triển tiếp |
| --- | --- | --- | --- |
| Đồng bộ thời hạn lưu trữ | `2026-06-24-retention-sync.md` | `2026-06-24-retention-sync-design.md` | Đối chiếu ba form và khóa hồ sơ; chưa xác nhận trọn luồng |
| Backup Vercel Blob | `2026-06-28-server-backup-vercel-blob.md` | `2026-06-28-vercel-blob-backup-design.md` | Thiết kế cũ không phản ánh backend VPS hiện tại. Source vẫn còn dịch vụ Blob, nhánh `server-cloud` và cron backup; xác nhận mức dùng trước khi xóa mã |
| Cột nguyên/bị đơn | `2026-06-30-dossier-table-party-columns.md` | `2026-06-30-dossier-table-party-columns-design.md` | Có trường dữ liệu và UI; kiểm tra hành vi bảng |
| Sắp xếp hồ sơ/tài liệu | `2026-07-06-dossier-sorting-plan.md` | `2026-07-06-dossier-sorting-design.md` | Có `sortOrder` trong hook và danh sách; ledger `.superpowers/sdd/progress.md` ghi năm task đã hoàn tất |
| Quản lý loại vụ án | `2026-07-14-manage-case-types.md` | `2026-07-14-manage-case-types-design.md` | Có dấu vết `CaseType` trong source; kiểm tra API/UI |
| Autocomplete loại hồ sơ hộp | `2026-07-22-box-casetype-autocomplete.md` | `2026-07-22-box-casetype-autocomplete-design.md` | Kiểm tra form hộp và test |
| Kiểm tra Excel tự động | `2026-08-06-auto-excel-validation.md` | `2026-08-06-auto-excel-validation-design.md` | Kiểm tra upload UI và validation; tên `ExcelValidation` không xuất hiện trong source |
| Cập nhật hộp bằng Excel | `2026-08-07-excel-box-patch.md` | `2026-08-07-excel-box-patch-design.md` | Có dialog, endpoint và contract test |
| Prisma indexes | `2026-08-11-prisma-performance-indexes.md` | `2026-08-11-prisma-performance-indexes-design.md` | Có migration `20260811060252_add_performance_indexes`; ledger ghi rollout đã xong, cần xác nhận lại trên DB thực tế |
| Thông báo mạng | `2026-08-12-network-status-toast.md` | `2026-08-12-network-status-toast-design.md` | Có hook và app integration |
| Chuyển hộp hàng loạt | `2026-08-20-batch-assign-box-plan.md` | `2026-08-20-batch-assign-box-design.md` | Có dialog và bảng hồ sơ |
| Thống kê ma trận | `2026-08-20-case-statistics-matrix.md` | `2026-08-20-case-statistics-matrix-design.md` | Kiểm tra route báo cáo, UI và test; tên `case-statistics` không xuất hiện |
| Chọn đa trang và modal | `2026-08-20-cross-page-selection-and-modal-preview.md` | Không có spec riêng | Kiểm tra state trong bảng và dialog |
| Người mượn ngoài hệ thống | `2026-08-20-external-borrower.md` | `2026-08-20-external-borrower-design.md` | Có `borrowerName`; tài liệu sống `docs/dev/borrow-return.md` bao quát nghiệp vụ hiện tại |
| Lọc theo hộp | `2026-08-20-file-storage-box-filter.md` | `2026-08-20-file-storage-box-filter-design.md` | Có `hasBox` trong hook/UI |
| Mẫu import Excel 12 cột | `2026-08-23-new-excel-import-template.md` | `2026-08-23-new-excel-import-template-design.md` | Kiểm tra parser, mẫu tải về và contract test |

## Agent và skills

- `.gemini/skills/elysia-db-query/SKILL.md`: skill duy nhất thuộc repo; gỡ theo yêu cầu. Nội dung có lệnh import/ghi đè DB, không nên coi là runbook vận hành.
- `.gemini/antigravity/brain/AGENTS.md`: đã bỏ bản onboarding song song có thông tin lỗi thời (ví dụ liệt kê `BASIC_VIEWER` trong khi schema hiện không có vai trò đó). README và `AGENTS.md` là điểm vào hiện tại.
- `.superpowers/sdd/`: 13 file cục bộ bị Git bỏ qua, gồm ledger, brief, review và diff. Không tự xóa vì không thể phục hồi từ Git; có thể lưu ngoài repo hoặc xóa sau khi đối chiếu các ghi chú duy nhất.
- Skills được cài trong thư mục người dùng của Codex/agent nằm ngoài repo này và có thể được các dự án khác dùng chung. Kế hoạch này chỉ gỡ skill thuộc repo.

## Kế hoạch gỡ Vercel Blob khỏi ứng dụng

Theo định hướng dự án, Vercel Blob sẽ không còn là nơi lưu backup. **Phiên dọn tài liệu này không thay đổi source**, nên dịch vụ `vercel-blob`, dependency `@vercel/blob`, route cron Blob và các điều khiển Blob/lịch trong UI hiện vẫn tồn tại. Phần này là kế hoạch cho một phiên triển khai mã riêng sau khi kiểm chứng backup của cả bốn database.

### Kiểm tra luồng hiện tại với 4 instance backend

Phạm vi: kiểm tra source và cấu hình trong repo, không truy cập VPS, bốn database hoặc Blob store đang chạy. `docker-compose.server.yml` khai báo bốn service backend với bốn `env_file` riêng. Mỗi instance tạo backup từ `DATABASE_URL` của chính nó, còn `BackupSchedule` và `BackupRun` nằm trong database đó. Điều này phân tách cấu hình/lịch sử theo database, nhưng **không phân tách object trong Blob store**.

1. Nút “Sao lưu lên máy chủ ngay” gửi `target: server-cloud` đến `/api/admin/database/backup`; route tạo file JSON gzip trong bộ nhớ rồi `put` vào Vercel Blob. Nhãn “máy chủ” trong UI gây hiểu nhầm: object nằm ở Blob store, không phải thư mục trên VPS.
2. Object key là `backups/court-management-<timestamp>.json.gz`, không có định danh instance/database; `addRandomSuffix: false`. Nếu các instance dùng cùng token/store và tạo backup cùng thời điểm, tên có thể va chạm. Chưa kiểm tra hành vi thực tế của Blob khi va chạm.
3. `cleanExpiredBlobs()` dùng prefix chung `backups/court-management-` rồi xóa theo ngày trong tên. Nếu dùng chung token/store, cleanup từ một instance có thể xóa backup của instance khác theo retention của instance gọi.
4. `/api/cron/backup` không thấy job gọi trong `.github`, `docker-compose.server.yml` hay `vercel.json`; bật lịch trong UI chỉ lưu bản ghi. Route luôn upload Blob kể cả khi `schedule.target` là `local`; `frequency` không được dùng để quyết định lịch chạy. Giờ chạy so với `new Date().getHours()` của container, chưa thấy cấu hình timezone.
5. Route cron chỉ so Authorization khi `CRON_SECRET` tồn tại. Nếu không đặt secret và schedule được bật, request đến route có thể kích hoạt backup; `force=true` hoặc header `x-vercel-cron` bỏ qua kiểm tra giờ. Cần kiểm tra giá trị biến môi trường trên VPS mà không công bố secret.
6. Object được tạo với `access: public`; cần kiểm tra URL và chính sách truy cập của Blob store thực tế. Backup JSON gzip chứa dữ liệu từ nhiều bảng, bao gồm user/audit. Không dùng nút này như bản backup chính; runbook `pg_dump` là luồng backup/restore vận hành được mô tả riêng.

Ưu tiên tiếp theo: xác minh trên cả bốn instance `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET`, `BackupSchedule.enabled/target/lastRunAt`, các `BackupRun` gần nhất và job gọi cron. Đồng thời kiểm chứng `BACKUP_DATABASES` trên VPS liệt kê đúng cả bốn database, cron `pg-backup.sh` thực sự chạy, bản dump được chuyển ra nơi lưu khác và từng database restore thử thành công. Ví dụ trong `docs/BACKUP-RESTORE.md` hiện chỉ liệt kê hai database, không phải bằng chứng cấu hình production đã đủ bốn.

Khi thực hiện trong phiên mã riêng: kiểm tra backup thực tế trên VPS và bảo đảm cả bốn database đã có bản dump có thể restore; sau đó gỡ dịch vụ `vercel-blob`, dependency `@vercel/blob`, nhánh API `server-cloud`, route cron và các điều khiển lịch/Blob ở **cả** `src/routes/admin/backup-page.tsx` lẫn `src/routes/reset/reset-page.tsx`. Đánh giá `BackupSchedule`/`BackupRun` cùng dữ liệu lịch sử trước khi xóa schema hoặc migration; không xóa bản backup cũ trên Blob cho đến khi thời hạn lưu giữ và khả năng khôi phục đã được xác nhận. Luồng tải bản backup về máy/restore JSON gzip qua UI có thể giữ cho thao tác thủ công, nhưng không phải bản backup vận hành chính.

## Thứ tự thực hiện

1. Đã cập nhật `Readme.md`, chuyển hướng dẫn deploy thành `docs/DEPLOY.md` và sửa liên kết trong `docs/BACKUP-RESTORE.md`.
2. Đã bỏ 31 file trong `docs/superpowers/`, bản onboarding `.gemini/antigravity/brain/AGENTS.md` và skill `.gemini/skills/elysia-db-query/SKILL.md` khỏi cây làm việc.
3. Khi phát triển tiếp, kiểm tra các chủ đề còn nghi vấn ở bảng trên; đưa yêu cầu chưa hoàn thành vào issue/backlog cụ thể, không dùng checkbox trong plan cũ làm backlog ngầm.
4. Trong phiên sửa mã riêng, kiểm chứng backup của bốn database rồi mới gỡ luồng Vercel Blob theo mục trên.
