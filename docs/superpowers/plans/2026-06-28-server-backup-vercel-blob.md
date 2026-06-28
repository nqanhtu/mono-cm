# Server Backup (Lưu trên máy chủ) via Vercel Blob Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a platform-independent, JS-native database backup and restore system (`.json.gz`) integrated with Vercel Blob, presented to users as "Lưu trên máy chủ" (Server Backup) and "Tải về máy cá nhân" (Local Download) on the admin dashboard, and scheduled via Vercel Crons.

**Architecture:** Use Prisma Client to query all database tables dynamically and serialize data to JSON, n压缩 with Node's native `zlib` module. Store server backups in Vercel Blob, using a cron route triggered hourly with secret verification to check if a backup is due and enforce retention settings.

**Tech Stack:** Bun, ElysiaJS, Prisma, React, `@vercel/blob`.

## Global Constraints
- Do not use placeholders (TBD, TODO, etc.).
- Wording on UI: display "Lưu trên máy chủ" instead of "Vercel Blob", and "Tải về máy cá nhân" instead of "local".
- Run tests after each code modification and commit frequently.

---

### Task 1: Install Dependencies and Create Vercel Blob Helper

**Files:**
- Create: `server/lib/services/vercel-blob.ts`
- Create: `server/lib/services/vercel-blob.test.ts`

**Interfaces:**
- Consumes: `process.env.BLOB_READ_WRITE_TOKEN`
- Produces:
  * `uploadBackupToBlob(filename: string, buffer: Buffer): Promise<string>`
  * `cleanExpiredBlobs(retentionDays: number): Promise<string[]>`

- [ ] **Step 1: Install @vercel/blob dependency**

Run: `bun add @vercel/blob`
Expected: Installs `@vercel/blob` successfully in the workspace.

- [ ] **Step 2: Write failing test for vercel-blob service**

Create `server/lib/services/vercel-blob.test.ts` containing:
```typescript
import { expect, test, mock, describe, beforeEach, afterEach } from "bun:test";
import { uploadBackupToBlob, cleanExpiredBlobs } from "./vercel-blob";

describe("vercel-blob service", () => {
  test("uploadBackupToBlob throws if token is missing", async () => {
    const originalToken = process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    try {
      await expect(uploadBackupToBlob("test.gz", Buffer.from("test"))).rejects.toThrow("BLOB_READ_WRITE_TOKEN is not configured");
    } finally {
      process.env.BLOB_READ_WRITE_TOKEN = originalToken;
    }
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test server/lib/services/vercel-blob.test.ts`
Expected: FAIL due to missing `./vercel-blob` module.

- [ ] **Step 4: Create vercel-blob service implementation**

Create `server/lib/services/vercel-blob.ts` containing:
```typescript
import { put, list, del } from '@vercel/blob';

export async function uploadBackupToBlob(filename: string, buffer: Buffer): Promise<string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not configured');
  }

  const blob = await put(`backups/${filename}`, buffer, {
    access: 'public',
    addRandomSuffix: false,
    token,
  });

  return blob.url;
}

export async function cleanExpiredBlobs(retentionDays: number): Promise<string[]> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not configured');
  }

  const prefix = 'backups/court-management-';
  const { blobs } = await list({ prefix, token });

  const expireTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const deletedUrls: string[] = [];

  for (const blob of blobs) {
    // Extract date from filename: backups/court-management-YYYY-MM-DDTHH-mm-ss.json.gz
    const match = blob.pathname.match(/court-management-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
    if (match) {
      const dateStr = match[1].replace(/-/g, ':').replace(/(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
      const fileDate = new Date(dateStr).getTime();
      if (!isNaN(fileDate) && fileDate < expireTime) {
        await del(blob.url, { token });
        deletedUrls.push(blob.url);
      }
    }
  }

  return deletedUrls;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun test server/lib/services/vercel-blob.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

Run:
```bash
git add package.json bun.lock server/lib/services/vercel-blob.ts server/lib/services/vercel-blob.test.ts
git commit -m "feat: implement vercel-blob upload and cleanup service"
```

---

### Task 2: Implement JS-Native Backup Generator

**Files:**
- Modify: `server/lib/services/database-backup.ts`
- Create: `server/lib/services/database-backup.test.ts`

**Interfaces:**
- Consumes: Prisma database tables.
- Produces:
  * `createPostgresBackup(): Promise<{ filename: string, size: number, buffer: Buffer, stream: () => ReadableStream<Uint8Array>, cleanup: () => Promise<void> }>`

- [ ] **Step 1: Write test for JS-native backup**

Create `server/lib/services/database-backup.test.ts` containing:
```typescript
import { expect, test, describe } from "bun:test";
import { createPostgresBackup } from "./database-backup";
import * as zlib from "zlib";

describe("database-backup service", () => {
  test("creates a valid gzipped json backup", async () => {
    const backup = await createPostgresBackup();
    expect(backup.filename).toStartWith("court-management-");
    expect(backup.filename).toEndWith(".json.gz");
    expect(backup.size).toBeGreaterThan(0);
    expect(backup.buffer).toBeInstanceOf(Buffer);

    // Decompress and verify JSON structure
    const jsonStr = zlib.gunzipSync(backup.buffer).toString("utf-8");
    const parsed = JSON.parse(jsonStr);
    expect(parsed.metadata).toBeDefined();
    expect(parsed.metadata.version).toBe("1.0");
    expect(parsed.data).toBeDefined();
    expect(parsed.data.User).toBeInstanceOf(Array);

    await backup.cleanup();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test server/lib/services/database-backup.test.ts`
Expected: FAIL due to incorrect return structure / old pg_dump code.

- [ ] **Step 3: Modify database-backup.ts to use JS-native backup**

Replace content of `server/lib/services/database-backup.ts` with:
```typescript
import { db } from '../db';
import * as zlib from 'node:zlib';
import { Readable } from 'node:stream';

export type DatabaseBackup = {
  filename: string
  size: number
  buffer: Buffer
  stream: () => ReadableStream<Uint8Array>
  cleanup: () => Promise<void>
}

const MODELS = [
  'user',
  'agencyHistory',
  'storageLayout',
  'backupSchedule',
  'backupRun',
  'storageBox',
  'auditLog',
  'userAccessLog',
  'storageBoxLabel',
  'file',
  'borrowSlip',
  'fileIndex',
  'document',
  'borrowItem',
  'borrowSlipEvent'
];

let backupInProgress = false;

export async function createPostgresBackup(): Promise<DatabaseBackup> {
  if (backupInProgress) {
    throw new Error('A database backup is already in progress');
  }

  backupInProgress = true;

  try {
    const backupData: Record<string, any[]> = {};
    for (const model of MODELS) {
      if (model in db) {
        backupData[model] = await (db as any)[model].findMany();
      }
    }

    const payload = {
      metadata: {
        version: '1.0',
        timestamp: new Date().toISOString(),
      },
      data: backupData,
    };

    const jsonString = JSON.stringify(payload);
    const compressedBuffer = zlib.gzipSync(Buffer.from(jsonString, 'utf-8'));

    const filename = `court-management-${new Date().toISOString().replace(/[:.]/g, '-')}.json.gz`;

    const stream = () => {
      const readable = new Readable({
        read() {
          this.push(compressedBuffer);
          this.push(null);
        }
      });
      return Readable.toWeb(readable) as unknown as ReadableStream<Uint8Array>;
    };

    return {
      filename,
      size: compressedBuffer.length,
      buffer: compressedBuffer,
      stream,
      cleanup: async () => {
        // No-op for memory backup buffer
      },
    };
  } finally {
    backupInProgress = false;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test server/lib/services/database-backup.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

Run:
```bash
git add server/lib/services/database-backup.ts server/lib/services/database-backup.test.ts
git commit -m "feat: implement JS-native gzip-compressed database backup"
```

---

### Task 3: Implement JS-Native Restore Engine

**Files:**
- Modify: `server/lib/services/database-restore.ts`
- Create: `server/lib/services/database-restore.test.ts`

**Interfaces:**
- Consumes: `.json.gz` backup payload.
- Produces:
  * `restorePostgresBackup(input: PostgresRestoreInput): Promise<DatabaseRestoreResult>`

- [ ] **Step 1: Write restore verification test**

Create `server/lib/services/database-restore.test.ts` containing:
```typescript
import { expect, test, describe, beforeAll } from "bun:test";
import { createPostgresBackup } from "./database-backup";
import { restorePostgresBackup } from "./database-restore";

describe("database-restore service", () => {
  test("restores database successfully from a backup", async () => {
    const backup = await createPostgresBackup();
    
    const file = new File([backup.buffer], backup.filename, { type: "application/gzip" });
    const result = await restorePostgresBackup({
      file,
      filename: backup.filename,
      size: backup.size
    });

    expect(result.filename).toBe(backup.filename);
    expect(result.size).toBe(backup.size);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test server/lib/services/database-restore.test.ts`
Expected: FAIL due to old restoration code throwing errors or attempting `pg_restore`.

- [ ] **Step 3: Modify database-restore.ts to use JS-native restore**

Replace content of `server/lib/services/database-restore.ts` with:
```typescript
import { db } from '../db';
import * as zlib from 'node:zlib';

export type PostgresRestoreInput = {
  file: File
  filename: string
  size: number
}

export type DatabaseRestoreResult = {
  filename: string
  size: number
}

const MODELS = [
  'borrowSlipEvent',
  'borrowItem',
  'borrowSlip',
  'fileIndex',
  'document',
  'file',
  'storageBoxLabel',
  'storageBox',
  'auditLog',
  'userAccessLog',
  'agencyHistory',
  'storageLayout',
  'backupRun',
  'user',
  'backupSchedule',
];

let restoreInProgress = false;

function convertDates(obj: any): any {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) {
    return obj.map(convertDates);
  }
  const result = { ...obj } as Record<string, any>;
  for (const key of Object.keys(result)) {
    const val = result[key];
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
      result[key] = new Date(val);
    } else if (typeof val === 'object' && val !== null) {
      result[key] = convertDates(val);
    }
  }
  return result;
}

export async function restorePostgresBackup(input: PostgresRestoreInput): Promise<DatabaseRestoreResult> {
  if (restoreInProgress) {
    throw new Error('A database restore is already in progress');
  }

  restoreInProgress = true;

  try {
    const arrayBuffer = await input.file.arrayBuffer();
    const gzipBuffer = Buffer.from(arrayBuffer);
    const jsonString = zlib.gunzipSync(gzipBuffer).toString('utf-8');
    const payload = JSON.parse(jsonString);

    if (!payload.metadata || payload.metadata.version !== '1.0' || !payload.data) {
      throw new Error('Invalid backup file format');
    }

    const backupData = convertDates(payload.data);

    await db.$transaction(async (tx) => {
      // 1. Disable triggers and foreign keys check in PG
      await tx.$executeRawUnsafe("SET session_replication_role = 'replica';");

      // 2. Clear all tables in child-to-parent order
      for (const model of MODELS) {
        if (model in tx) {
          await (tx as any)[model].deleteMany();
        }
      }

      // 3. Populate tables in reverse order (parent-to-child or as specified)
      // Since replication role is replica, insertion order doesn't fail on FKs.
      for (const model of [...MODELS].reverse()) {
        if (model in tx && backupData[model]) {
          const records = backupData[model];
          if (records.length > 0) {
            await (tx as any)[model].createMany({
              data: records,
              skipDuplicates: true
            });
          }
        }
      }

      // 4. Restore trigger settings
      await tx.$executeRawUnsafe("SET session_replication_role = 'origin';");
    }, {
      timeout: 30000 // 30s timeout for import transaction
    });

    return {
      filename: input.filename,
      size: input.size,
    };
  } finally {
    restoreInProgress = false;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test server/lib/services/database-restore.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

Run:
```bash
git add server/lib/services/database-restore.ts server/lib/services/database-restore.test.ts
git commit -m "feat: implement JS-native gzip-compressed database restore"
```

---

### Task 4: Upgrade Server API Routes and Add Cron Route

**Files:**
- Modify: `server/api-routes/admin.routes.ts`
- Modify: `vercel.json`

**Interfaces:**
- Modify `POST /api/admin/database/backup` to accept `{ target: 'local' | 'server-cloud' }`.
- Create `POST /api/cron/backup` with `CRON_SECRET` headers verification.

- [ ] **Step 1: Run server test suite to make sure we don't break existing endpoints**

Run: `bun test server/`
Expected: Runs all server tests successfully.

- [ ] **Step 2: Update admin.routes.ts**

Modify `server/api-routes/admin.routes.ts` in lines 490-540 and add the cron route.
Ensure the following logic changes:
- `POST /api/admin/database/backup`:
  ```typescript
  // Read body target
  const body = await request.json().catch(() => ({})) as { target?: string };
  const target = body.target === 'server-cloud' ? 'server-cloud' : 'local';
  
  backup = await createPostgresBackup();
  // ... audit logging ...
  
  if (target === 'server-cloud') {
    const url = await uploadBackupToBlob(backup.filename, backup.buffer);
    await recordBackupRun({
      status: 'SUCCESS',
      filename: backup.filename,
      size: backup.size,
      target: 'server-cloud'
    });
    // Trigger retention
    const schedule = await db.backupSchedule.findUnique({ where: { id: 'default' } });
    if (schedule && schedule.enabled) {
      await cleanExpiredBlobs(schedule.retentionDays);
      await db.backupRun.deleteMany({
        where: {
          startedAt: { lt: new Date(Date.now() - schedule.retentionDays * 24 * 60 * 60 * 1000) }
        }
      });
    }
    return { success: true, url, size: backup.size, filename: backup.filename };
  } else {
    // Local download
    await recordBackupRun({
      status: 'SUCCESS',
      filename: backup.filename,
      size: backup.size,
      target: 'local'
    });
    return new Response(backup.stream(), { ...headers... });
  }
  ```

- Add `POST /api/cron/backup` handler:
  ```typescript
  .post('/api/cron/backup', async ({ request, set }) => {
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.CRON_SECRET;
    
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    try {
      const schedule = await db.backupSchedule.findUnique({ where: { id: 'default' } });
      if (!schedule || !schedule.enabled) {
        return { success: true, message: 'Backup schedule is disabled' };
      }

      // Check if backup is due
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const [scheduledHour, scheduledMinute] = schedule.timeOfDay.split(':').map(Number);

      // Verify trigger window (hourly trigger triggers at matching hour)
      if (currentHour !== scheduledHour) {
        return { success: true, message: `Skipping: scheduled at ${schedule.timeOfDay}, current hour is ${currentHour}` };
      }

      // Ensure we haven't run it in the last 20 hours to prevent duplicate runs
      if (schedule.lastRunAt) {
        const hoursSinceLastRun = (now.getTime() - new Date(schedule.lastRunAt).getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastRun < 20) {
          return { success: true, message: 'Backup already run recently' };
        }
      }

      const backup = await createPostgresBackup();
      const url = await uploadBackupToBlob(backup.filename, backup.buffer);

      await recordBackupRun({
        status: 'SUCCESS',
        filename: backup.filename,
        size: backup.size,
        target: schedule.target || 'server-cloud',
      });

      // Cleanup
      await cleanExpiredBlobs(schedule.retentionDays);
      await db.backupRun.deleteMany({
        where: {
          startedAt: { lt: new Date(Date.now() - schedule.retentionDays * 24 * 60 * 60 * 1000) }
        }
      });

      return { success: true, filename: backup.filename, url };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown cron backup error';
      console.error('Scheduled backup error:', errMsg);
      await recordBackupRun({
        status: 'FAILED',
        message: errMsg,
        target: 'server-cloud',
      });
      set.status = 500;
      return { error: errMsg };
    }
  })
  ```

- [ ] **Step 3: Update vercel.json**

Add a `crons` block to `vercel.json`:
```json
  "crons": [
    {
      "path": "/api/cron/backup",
      "schedule": "0 * * * *"
    }
  ]
```

- [ ] **Step 4: Run server tests**

Run: `bun test server/`
Expected: PASS

- [ ] **Step 5: Commit**

Run:
```bash
git add server/api-routes/admin.routes.ts vercel.json
git commit -m "feat: upgrade backup route to support target option and add cron endpoint"
```

---

### Task 5: Upgrade Frontend UI Dashboard

**Files:**
- Modify: `src/routes/admin/backup-page.tsx`

- [ ] **Step 1: Modify types and states in backup-page.tsx**

Update `BackupSchedule` type to include `target: string;`:
```typescript
type BackupSchedule = {
  enabled: boolean;
  frequency: string;
  timeOfDay: string;
  retentionDays: number;
  target: string; // Add target here
  lastRunAt: string | null;
  lastStatus: string | null;
  lastMessage: string | null;
};
```
Initialize `target: "server-cloud"` in the default `schedule` state.

- [ ] **Step 2: Add target options select input in Schedule Card**

In the "Lập lịch sao lưu tự động" card, add a Form field for "Nơi lưu trữ":
```tsx
<div className="space-y-1.5">
    <Label htmlFor="target" className="text-xs text-muted-foreground">Nơi lưu trữ</Label>
    <Select
        value={schedule.target || "server-cloud"}
        onValueChange={(val) => setSchedule({ ...schedule, target: val })}
        disabled={!schedule.enabled}
    >
        <SelectTrigger id="target" className="h-9 rounded-lg">
            <SelectValue />
        </SelectTrigger>
        <SelectContent>
            <SelectItem value="server-cloud">Lưu trên máy chủ</SelectItem>
            <SelectItem value="local">Tải về máy cá nhân</SelectItem>
        </SelectContent>
    </Select>
</div>
```

- [ ] **Step 3: Modify manual backup card**

Update "Sao lưu thủ công" card code to show two buttons:
- **Button 1 (Tải về máy cá nhân)**:
  ```tsx
  const handleBackupLocal = async () => {
    setIsBackingUp(true);
    toast.info("Đang chuẩn bị bản sao lưu để tải về...");
    try {
      const response = await apiDownload("/api/admin/database/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: "local" }),
      });
      // ... existing download code ...
      toast.success("Tải bản sao lưu thành công");
      fetchBackupData();
    } catch {
      toast.error("Không thể tải bản sao lưu");
    } finally {
      setIsBackingUp(false);
    }
  };
  ```
- **Button 2 (Lưu trên máy chủ)**:
  ```tsx
  const [isCloudBackingUp, setIsCloudBackingUp] = useState(false);
  const handleBackupCloud = async () => {
    setIsCloudBackingUp(true);
    toast.info("Đang tiến hành sao lưu và lưu trên máy chủ...");
    try {
      const response = await apiFetch("/api/admin/database/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: "server-cloud" }),
      });
      if (response.ok) {
        toast.success("Sao lưu và lưu trên máy chủ thành công");
        fetchBackupData();
      } else {
        toast.error("Sao lưu thất bại");
      }
    } catch {
      toast.error("Có lỗi xảy ra");
    } finally {
      setIsCloudBackingUp(false);
    }
  };
  ```

- [ ] **Step 4: Update display names in run history table**

Translate `target` in the Table render:
- `run.target === 'server-cloud' ? 'Lưu trên máy chủ' : 'Tải về máy cá nhân'`
Translate `status` states in the Table render if applicable.

- [ ] **Step 5: Verify build**

Run: `bun run build`
Expected: Frontend builds successfully without syntax or type errors.

- [ ] **Step 6: Commit**

Run:
```bash
git add src/routes/admin/backup-page.tsx
git commit -m "feat: design backup-page UI to hide vercel blob terms and show user-friendly labels"
```
