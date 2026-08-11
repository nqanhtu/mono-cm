# Prisma Performance Indexes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm 18 B-tree index vào schema Prisma (một migration) để tăng tốc list/sort/report và join FK trên các bảng nóng, không đổi hành vi app.

**Architecture:** Thêm `@@index` vào `prisma/schema.prisma`; sinh file migration **offline** bằng `prisma migrate diff` (so schema cũ lấy từ git với schema mới — không cần kết nối DB, tên index theo đúng convention Prisma). Áp lên các DB tỉnh production bằng `prisma migrate deploy` chạy qua `docker exec` trên VPS.

**Tech Stack:** Prisma 7, PostgreSQL, Bun, Docker Compose + Traefik (đa tỉnh).

## Global Constraints

- Chỉ dùng `CREATE INDEX` thường (KHÔNG `CONCURRENTLY`) — hợp transaction của Prisma migrate; áp giờ thấp tải.
- Chỉ thêm index B-tree; KHÔNG sửa query, KHÔNG thêm GIN/tsvector (đợt sau).
- KHÔNG đụng DB production từ máy dev; rollout prod do người vận hành chạy trên VPS.
- Tên index để Prisma tự sinh (convention `{Table}_{cols}_idx`) — không tự đặt tên tay để tránh drift.
- Migration folder name phải có timestamp > `20260520000000` (migration cuối hiện tại).
- Tổng đúng **18** index (xem checklist Task 2 Step 3).

---

### Task 1: Thêm `@@index` vào schema.prisma

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Consumes: schema hiện tại (models File, Document, BorrowSlip, BorrowItem, AuditLog, StorageBox, StorageBoxLabel, BorrowSlipEvent).
- Produces: schema có 18 `@@index` mới; là đầu vào cho Task 2 sinh migration.

- [ ] **Step 1: Thêm block index vào model `File`**

Thêm ngay trước dấu `}` đóng model `File` (sau field `updatedBy`, quanh dòng 155):
```prisma
  @@index([createdAt])
  @@index([status])
  @@index([type])
  @@index([year])
  @@index([boxId])
  @@index([createdById, createdAt])
```

- [ ] **Step 2: Thêm block index vào model `Document`**

Thêm ngay trước dấu `}` đóng model `Document`:
```prisma
  @@index([fileId, order])
  @@index([createdById, createdAt])
```

- [ ] **Step 3: Thêm block index vào model `BorrowSlip`**

Thêm ngay trước dấu `}` đóng model `BorrowSlip`:
```prisma
  @@index([createdAt])
  @@index([status, dueDate])
  @@index([lenderId])
```

- [ ] **Step 4: Thêm index vào model `BorrowItem`**

Thêm ngay sau dòng `@@unique([borrowSlipId, fileId])`:
```prisma
  @@index([fileId, status])
```

- [ ] **Step 5: Thêm block index vào model `AuditLog`**

Thêm ngay trước dấu `}` đóng model `AuditLog`:
```prisma
  @@index([createdAt])
  @@index([action, createdAt])
  @@index([userId, createdAt])
```

- [ ] **Step 6: Thêm index vào model `StorageBox`**

Thêm ngay sau dòng `@@index([warehouse, line, shelf, slot])`:
```prisma
  @@index([agencyId])
```

- [ ] **Step 7: Thêm index vào `StorageBoxLabel` và `BorrowSlipEvent`**

`StorageBoxLabel` — trước dấu `}` đóng model:
```prisma
  @@index([storageBoxId])
```
`BorrowSlipEvent` — trước dấu `}` đóng model:
```prisma
  @@index([borrowSlipId])
```

- [ ] **Step 8: Format + validate schema**

Run:
```bash
bunx prisma format
bunx prisma validate
```
Expected: `prisma format` chạy sạch; `prisma validate` in `The schema at prisma/schema.prisma is valid 🚀`.

- [ ] **Step 9: Không commit ở task này** — schema và migration của nó phải land cùng nhau (commit ở Task 2).

---

### Task 2: Sinh file migration (offline) + regenerate client + commit

**Files:**
- Create: `prisma/migrations/<timestamp>_add_performance_indexes/migration.sql`
- Modify: `generated/prisma/**` (do `prisma generate` — thư mục này đã gitignore, không vào commit)

**Interfaces:**
- Consumes: `prisma/schema.prisma` đã sửa ở Task 1; phiên bản schema TRƯỚC khi sửa (lấy từ `git show HEAD:prisma/schema.prisma`).
- Produces: một migration `add_performance_indexes` chứa 18 `CREATE INDEX`; là đầu vào cho Task 3 (verify) và Task 4 (rollout).

- [ ] **Step 1: Tạo thư mục migration với timestamp hợp lệ**

Run:
```bash
MIG_DIR="prisma/migrations/$(date -u +%Y%m%d%H%M%S)_add_performance_indexes"
mkdir -p "$MIG_DIR"
echo "$MIG_DIR"
```
Ghi lại đường dẫn `$MIG_DIR` in ra để dùng ở các step sau.

- [ ] **Step 2: Sinh migration.sql offline (so schema cũ từ git vs schema mới)**

Run:
```bash
git show HEAD:prisma/schema.prisma > /tmp/old-schema.prisma
bunx prisma migrate diff \
  --from-schema-datamodel /tmp/old-schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script > "$MIG_DIR/migration.sql"
```
Không cần kết nối DB (so sánh hai datamodel thuần).

- [ ] **Step 3: Kiểm tra migration.sql — phải đúng 18 CREATE INDEX, không có lệnh phá huỷ**

Run:
```bash
grep -c 'CREATE INDEX' "$MIG_DIR/migration.sql"      # kỳ vọng: 18
grep -Ei 'DROP|ALTER TABLE .* DROP|TRUNCATE|DELETE' "$MIG_DIR/migration.sql"  # kỳ vọng: rỗng
cat "$MIG_DIR/migration.sql"
```
Expected: đếm ra `18`; lệnh grep phá huỷ trả rỗng. Đối chiếu đủ 18 tên index (theo convention `{Table}_{cols}_idx`):
`File_createdAt_idx`, `File_status_idx`, `File_type_idx`, `File_year_idx`, `File_boxId_idx`, `File_createdById_createdAt_idx`, `Document_fileId_order_idx`, `Document_createdById_createdAt_idx`, `BorrowSlip_createdAt_idx`, `BorrowSlip_status_dueDate_idx`, `BorrowSlip_lenderId_idx`, `BorrowItem_fileId_status_idx`, `AuditLog_createdAt_idx`, `AuditLog_action_createdAt_idx`, `AuditLog_userId_createdAt_idx`, `StorageBox_agencyId_idx`, `StorageBoxLabel_storageBoxId_idx`, `BorrowSlipEvent_borrowSlipId_idx`.

Nếu số đếm ≠ 18 hoặc thiếu tên: quay lại Task 1 sửa `@@index` còn thiếu, xoá `$MIG_DIR`, làm lại Step 1–3.

- [ ] **Step 4: Regenerate Prisma client (đảm bảo schema hợp lệ end-to-end)**

Run:
```bash
bunx prisma generate
```
Expected: `Generated Prisma Client` thành công (client vào `generated/prisma`, đã gitignore).

- [ ] **Step 5: Commit schema + migration**

Run:
```bash
git add prisma/schema.prisma "$MIG_DIR/migration.sql"
git status --short   # xác nhận chỉ có schema.prisma (M) và migration.sql (A), không có generated/
git commit -m "perf: add B-tree indexes for hot query paths (#29-35 + FKs)

18 indexes across File, Document, BorrowSlip, BorrowItem, AuditLog,
StorageBox, StorageBoxLabel, BorrowSlipEvent. Plain CREATE INDEX;
per-province rollout via prisma migrate deploy on the VPS.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01YM29gZrCrhi9ez8CugBcr6"
```

---

### Task 3: (Tuỳ chọn) Verify trên DB dev/local bằng EXPLAIN

Chỉ làm nếu có DB dev truy cập được qua `DATABASE_URL` trong `.env`. Nếu không có, **bỏ qua Task này** — file migration đã được kiểm tra tĩnh ở Task 2; verify thật sẽ diễn ra khi rollout prod (Task 4).

**Files:** không tạo/sửa file (chỉ chạy lệnh đọc).

**Interfaces:**
- Consumes: migration từ Task 2; `DATABASE_URL` dev.
- Produces: bằng chứng index được dùng (EXPLAIN) — không có artifact commit.

- [ ] **Step 1: Áp migration lên DB dev**

Run:
```bash
set -a; source .env; set +a
bunx prisma migrate deploy
```
Expected: `add_performance_indexes` báo applied.

- [ ] **Step 2: Xác nhận index tồn tại**

Run (psql với cùng DATABASE_URL):
```bash
psql "$DATABASE_URL" -c "SELECT tablename, indexname FROM pg_indexes WHERE schemaname='public' AND indexname LIKE '%_idx' ORDER BY tablename, indexname;"
```
Expected: thấy 18 tên index ở Task 2 Step 3 (cùng các index cũ).

- [ ] **Step 3: EXPLAIN 2 query nóng — xác nhận không Seq Scan**

Run:
```bash
psql "$DATABASE_URL" -c "EXPLAIN ANALYZE SELECT * FROM \"File\" WHERE status <> 'ARCHIVED' ORDER BY \"createdAt\" DESC LIMIT 20;"
psql "$DATABASE_URL" -c "EXPLAIN ANALYZE SELECT * FROM \"AuditLog\" WHERE action = 'LOGIN' ORDER BY \"createdAt\" DESC LIMIT 20;"
```
Expected: kế hoạch dùng `Index Scan`/`Bitmap Index Scan` trên index tương ứng (`File_createdAt_idx`, `AuditLog_action_createdAt_idx`).
Lưu ý: trên bảng ít dữ liệu Postgres có thể vẫn chọn Seq Scan — chấp nhận được; điều quan trọng là index tồn tại và sẽ được dùng khi dữ liệu tăng.

---

### Task 4: Rollout production đa tỉnh (người vận hành chạy trên VPS)

Đây là runbook thực thi bằng tay sau khi Task 2 đã push. KHÔNG chạy từ máy dev.

**Files:** không tạo/sửa file trong repo.

**Interfaces:**
- Consumes: commit từ Task 2 đã ở `origin/main`.
- Produces: 18 index hiện diện trên DB của từng tỉnh.

- [ ] **Step 1: Push để CI build image mới (đã nhúng migration)**

Run (máy dev):
```bash
git push origin main
```
Chờ workflow `deploy-server.yml` xong (Actions tab): image mới build + VPS pull + container restart.
An toàn thứ tự: index là additive — app chạy bình thường kể cả khi migration chưa áp.

- [ ] **Step 2: SSH vào VPS và áp migration cho từng tỉnh**

Run (trên VPS):
```bash
for svc in $(docker compose -f /opt/mono-cm/docker-compose.server.yml config --services | grep -v cm-redis); do
  echo "== migrate $svc =="
  docker exec "$svc" bunx prisma migrate deploy
done
```
Expected: mỗi tỉnh in `add_performance_indexes` applied (hoặc "No pending migrations" nếu chạy lại — idempotent).

- [ ] **Step 3: Verify trên một tỉnh đại diện**

Run (trên VPS, ví dụ tỉnh dongnai):
```bash
docker exec dongnai_server bunx prisma migrate status
```
Expected: `Database schema is up to date!`.

- [ ] **Step 4: Cập nhật catalog — đánh dấu #29–35, #99, #100, #164 DONE**

Sau khi rollout xong, sửa `scratchpad/issues-catalog.md` (hoặc nơi theo dõi) đánh dấu các mục index là ✅ DONE kèm ngày.

---

## Follow-up (không thuộc plan này)

- Tự động hoá migrate deploy per-tỉnh trong `deploy-server.yml` (thêm bước SSH loop `docker exec ... migrate deploy` sau khi pull) để bỏ bước thủ công Task 4 Step 2.
- Full-text: cân nhắc GIN/tsvector cho tìm kiếm `party/q` (`files.routes.ts:41-66`).
