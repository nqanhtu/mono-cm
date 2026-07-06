---
name: db-query-migrate
description: >
  Skill cho mọi tác vụ liên quan đến database của court-management-api:
  query dữ liệu nhanh, export từ staging, import sang client DB.
---

# Skill: DB Query & Migration

## Triggers

**Query / kiểm tra dữ liệu:**
- "check dữ liệu bảng ...", "có bao nhiêu ... trong DB"
- "query bảng User", "tìm hồ sơ ...", "check log"

**Export / Import / Migrate:**
- "muốn migrate", "export data staging", "import vào client"
- "backup DB", "đồng bộ data", "copy data sang DB mới"

---

## Kịch bản 1 — Query nhanh (Read-Only)

1. Viết script tạm `prisma/_temp_query.ts` dùng Prisma Client
2. Chạy: `bun prisma/_temp_query.ts`
3. Hiển thị kết quả dạng Markdown Table trong chat
4. Xóa file tạm sau khi xong

**Template:**
```typescript
import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const result = await prisma.<model>.findMany({ where: {}, take: 50 });
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error).finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
```

---

## Kịch bản 2 — Migrate staging → client

Tất cả chạy từ **máy local**, kết nối thẳng tới remote Postgres. Không cần SSH.

### Bước 1 — Export từ staging
```bash
bun prisma/scripts/export-staging.ts --url="<STAGING_DATABASE_URL>"
# Output: ./backups/<timestamp>/ trên máy local
```

### Bước 2 — Import vào client
```bash
bun prisma/scripts/import-to-client.ts \
  --url="<CLIENT_DATABASE_URL>" \
  --from="./backups/<timestamp>"
# Xoa toan bo data cu cua client roi insert lai theo thu tu FK
```

### Bước 3 — Verify
```bash
bun prisma/scripts/verify-migration.ts --url="<CLIENT_DATABASE_URL>"
# In bang dem so ban ghi tung table
```

---

## Thứ tự FK (tham khảo)

```
Tier 0 (no FK):   User, AgencyHistory, StorageLayout, BackupSchedule, BackupRun
Tier 1:           StorageBox, AuditLog, UserAccessLog
Tier 2:           StorageBoxLabel, File, BorrowSlip
Tier 3:           FileIndex, Document, BorrowItem, BorrowSlipEvent
```

Xóa ngược lại: Tier 3 → 2 → 1 → 0.

---

## Lưu ý

- Prisma Client phải khởi tạo với `PrismaPg` adapter, không dùng `new PrismaClient()` trần
- Không hardcode `DATABASE_URL` — đọc từ `.env` hoặc truyền qua `--url`
- Giữ nguyên UUID gốc khi import để không break FK
- `StorageLayout` và `BackupSchedule` dùng `id = "default"` — phải `upsert` thay vì `create`