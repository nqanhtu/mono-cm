# Design: Prisma Performance Indexes

**Ngày:** 2026-08-11
**Phạm vi catalog:** #29–#35 (High) + gộp FK liên quan #99, #100, #164 (Medium/Low)
**Trạng thái:** Đã duyệt thiết kế — chờ viết implementation plan

## 1. Vấn đề & mục tiêu

Hầu hết cột dùng để lọc/sắp xếp và các khóa ngoại (FK) trên các bảng nóng (`File`, `Document`,
`BorrowSlip`, `BorrowItem`, `AuditLog`) **chưa có index**. Postgres không tự tạo index cho cột FK,
và Prisma chỉ tạo index cho `@id`/`@unique`. Khi dữ liệu tăng, các truy vấn list/sort/report và
count-khi-xóa sẽ chậm tuyến tính (seq scan).

Index hiện có (xác minh trong `prisma/schema.prisma`):
- `StorageBox @@index([warehouse, line, shelf, slot])`
- `UserAccessLog @@index([userId, occurredAt])`, `@@index([event, occurredAt])`
- Các `@unique`/`@id` (auto): `User.username`, `StorageBox.code`, `File.code`, `FileIndex.fileId`,
  `BorrowSlip.code`, `BorrowItem @@unique([borrowSlipId, fileId])`.

**Mục tiêu:** thêm bộ index sát query thật để tăng tốc list/sort/report và join FK, không thay đổi
hành vi ứng dụng, rủi ro thấp, áp được lên các DB tỉnh production đang chạy live.

**Không làm (out of scope):** tối ưu lại câu query (N+1, phân trang), GIN/tsvector cho full-text
`party/q` (`files.routes.ts:41-66`) — để đợt sau; đây chỉ là thêm index B-tree.

## 2. Bộ index (Hybrid: đơn cột + composite nơi cột dẫn đầu là equality)

Cơ sở chọn cột lấy từ query thật trong `server/api-routes/*`:

| Model | Index | Query phục vụ (tham chiếu) |
|-------|-------|----------------------------|
| **File** | `@@index([createdAt])` | listing mặc định `orderBy createdAt desc` (status=NOT ARCHIVED, chọn lọc thấp) — `files.routes.ts:115` |
| | `@@index([status])` | count stats BORROWED/IN_STOCK — `files.routes.ts:210-211` |
| | `@@index([type])` | filter type (bitmap-AND) — `files.routes.ts:86` |
| | `@@index([year])` | filter year — `files.routes.ts:87` |
| | `@@index([boxId])` | FK: count khi xóa box + join box |
| | `@@index([createdById, createdAt])` | COORDINATOR isolation + báo cáo đóng góp — `files.routes.ts:106`, `reports.routes.ts:137` |
| **Document** | `@@index([fileId, order])` | join theo file + list mục lục `orderBy order asc` — `files.routes.ts:284` |
| | `@@index([createdById, createdAt])` | báo cáo đóng góp document — `reports.routes.ts:144` |
| **BorrowSlip** | `@@index([createdAt])` | list + reports `orderBy createdAt desc` — `borrow.routes.ts:18`, `reports.routes.ts:45` |
| | `@@index([status, dueDate])` | alerts/overdue (status equality + dueDate) — `reports.routes.ts:18`, `files.routes.ts:212` |
| | `@@index([lenderId])` | FK + filter report borrows (#99) — `reports.routes.ts:218` |
| **BorrowItem** | `@@index([fileId, status])` | reserved-check khi tạo phiếu + FK join (#34) — `borrow.routes.ts:34-37` |
| **AuditLog** | `@@index([createdAt])` | reports audit (range + sort) — `reports.routes.ts:56-63` |
| | `@@index([action, createdAt])` | audit list lọc action + sort — `audit.routes.ts:33,42` |
| | `@@index([userId, createdAt])` | audit list lọc user + sort — `audit.routes.ts:34,42` |
| **StorageBox** | `@@index([agencyId])` | FK count admin (#100) |
| **StorageBoxLabel** | `@@index([storageBoxId])` | FK (#164) |
| **BorrowSlipEvent** | `@@index([borrowSlipId])` | FK findMany events (#164) |

**Tổng: 18 index.** Composite chỉ dùng nơi cột dẫn đầu là equality (`createdById`, `action`,
`userId`, `status`+`dueDate`, `fileId`+`status`); còn lại đơn cột cho linh hoạt (Postgres bitmap-AND
được nhiều index đơn).

**Ghi chú thiết kế:**
- `File.[status, createdAt]` **không** chọn vì listing mặc định lọc `NOT status='ARCHIVED'`
  (bất đẳng thức, chọn lọc thấp) → composite kém hiệu quả; dùng `[status]` (cho count equality) +
  `[createdAt]` (cho sort) riêng.
- `BorrowItem @@unique([borrowSlipId, fileId])` đã phủ prefix `borrowSlipId`; thêm `[fileId, status]`
  để phủ chiều `fileId` (reserved-check) mà unique kia không phủ.

## 3. Cơ chế migration

1. Thêm các dòng `@@index(...)` vào `prisma/schema.prisma`.
2. Sinh file migration **không cần kết nối DB** bằng migrate diff:
   ```bash
   prisma migrate diff \
     --from-migrations prisma/migrations \
     --to-schema-datamodel prisma/schema.prisma \
     --script > prisma/migrations/<timestamp>_add_performance_indexes/migration.sql
   ```
   (Tạo thư mục migration với timestamp đúng định dạng Prisma trước khi ghi.)
3. SQL sinh ra là các câu `CREATE INDEX "..."` thường (đã chốt — chấp nhận khóa-ghi ngắn, chạy giờ
   thấp tải). Kiểm tra file SQL: đủ 18 `CREATE INDEX`, không có `DROP`/`ALTER` ngoài ý muốn.
4. `prisma generate` để cập nhật client (không đổi API code).

## 4. Rollout đa tỉnh (thủ công qua docker exec)

Mỗi container tỉnh mang sẵn `DATABASE_URL` (qua `env_file: .env.<tỉnh>`) và image có sẵn
`bun`+`prisma`+`prisma/migrations`.

1. Commit + push schema + migration → CI `deploy-server.yml` build image mới (nhúng migration) →
   VPS pull → container restart. *An toàn thứ tự:* index là additive, app chạy được khi chưa có index.
2. Trên VPS, áp migration cho từng tỉnh:
   ```bash
   for svc in $(docker compose -f /opt/mono-cm/docker-compose.server.yml config --services | grep -v cm-redis); do
     echo "== migrate $svc =="
     docker exec "$svc" bunx prisma migrate deploy
   done
   ```
   `migrate deploy` idempotent — chạy lại vô hại.

**Tùy chọn nâng cao (không làm trong đợt này):** thêm bước migrate deploy per-tỉnh vào
`deploy-server.yml` để tự động hóa — ghi chú lại như follow-up.

## 5. Verify

- Danh sách index thực tế mỗi DB:
  ```sql
  SELECT tablename, indexname FROM pg_indexes
  WHERE schemaname='public' ORDER BY tablename, indexname;
  ```
- `EXPLAIN ANALYZE` vài query nóng (files list sort createdAt, audit list lọc action) → xác nhận
  dùng Index Scan/Bitmap thay vì Seq Scan.
- Trên local (nếu có DB dev theo `.env`): chạy `prisma migrate deploy` + EXPLAIN trước khi lên prod.

## 6. Rollback

- Prisma không auto-down. Nếu cần gỡ: tạo migration mới `DROP INDEX`.
- `CREATE INDEX` là non-destructive → rủi ro thấp; xấu nhất là tốn dung lượng + chậm ghi nhẹ.

## 7. Tiêu chí hoàn thành

- `schema.prisma` có đủ 18 `@@index`; `prisma validate` pass.
- File migration `add_performance_indexes` sinh đúng (18 CREATE INDEX), `prisma generate` OK.
- Có runbook rollout (đoạn lệnh docker exec) trong plan để bạn chạy trên VPS.
- (Nếu có DB dev) EXPLAIN xác nhận index được dùng cho ≥2 query nóng.
