/**
 * Import dữ liệu từ thư mục backup (JSON) trên máy LOCAL vào DB client (remote)
 *
 * Cách dùng:
 *   bun prisma/scripts/import-to-client.ts --url="<client_db_url>" --from="./backups/<timestamp>"
 *   hoặc đọc DATABASE_URL từ .env nếu không truyền --url
 *
 * ⚠️  Script sẽ XÓA toàn bộ dữ liệu hiện tại của DB client trước khi import!
 *     Đảm bảo đã chạy export-staging.ts để có backup trước.
 */
import "dotenv/config";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";

// Nhận --url và --from qua argument
const urlArg = process.argv.find((a) => a.startsWith("--url="))?.slice(6);
const fromArg = process.argv.find((a) => a.startsWith("--from="))?.slice(7);
// Fallback: đọc url từ .env, đọc path từ positional arg (backward compat)
const connectionString = urlArg || process.env.DATABASE_URL;
const backupDir = fromArg || process.argv[2];

if (!connectionString) {
  console.error("[error] Missing client DB URL.");
  console.error('  Usage: bun prisma/scripts/import-to-client.ts --url="postgresql://..." --from="./backups/<ts>"');
  console.error("  Or set DATABASE_URL in .env");
  process.exit(1);
}
if (!backupDir || !existsSync(backupDir)) {
  console.error("[error] Backup directory not found.");
  console.error('  Pass --from="./backups/<timestamp>" or run export-staging.ts first.');
  process.exit(1);
}

console.log(`Connecting to client DB: ${connectionString.replace(/:[^:@]+@/, ":***@")}`);

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function loadJson<T>(filename: string): T[] {
  const filePath = join(backupDir, filename);
  if (!existsSync(filePath)) {
    console.warn(`  [warn] File ${filename} not found, skipping.`);
    return [];
  }
  const raw = readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw) as T[];
  // Chuyển lại các trường ngày tháng từ string về Date
  return data.map((row) => convertDates(row)) as T[];
}

// Chuyển đổi string ISO về Date object cho Prisma
function convertDates<T>(obj: T): T {
  if (typeof obj !== "object" || obj === null) return obj;
  const result = { ...obj } as Record<string, unknown>;
  for (const key of Object.keys(result)) {
    const val = result[key];
    if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
      result[key] = new Date(val);
    } else if (typeof val === "object" && val !== null && !Array.isArray(val)) {
      result[key] = convertDates(val);
    }
  }
  return result as T;
}

async function clearAll() {
  console.log("Clearing existing data (child tables first)...");

  await prisma.$transaction([
    // Tier 3 – xóa trước
    prisma.borrowSlipEvent.deleteMany(),
    prisma.borrowItem.deleteMany(),
    prisma.borrowSlip.deleteMany(),
    prisma.fileIndex.deleteMany(),
    prisma.document.deleteMany(),
    // Tier 2
    prisma.file.deleteMany(),
    prisma.storageBoxLabel.deleteMany(),
    // Tier 1
    prisma.storageBox.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.userAccessLog.deleteMany(),
    // Tier 0
    prisma.agencyHistory.deleteMany(),
    prisma.storageLayout.deleteMany(),
    prisma.backupRun.deleteMany(),
    // User last (có thể bỏ qua nếu muốn giữ lại)
    prisma.user.deleteMany(),
  ]);

  // BackupSchedule dùng id="default" cố định, reset riêng
  await prisma.backupSchedule.deleteMany();

  console.log("  [ok] Cleared all existing data\n");
}

async function importAll() {
  const batchInsert = async (name: string, data: unknown[], fn: (data: unknown[]) => Promise<{ count: number }>) => {
    if (data.length === 0) { console.log(`  [skip] ${name}: empty`); return; }
    const result = await fn(data);
    console.log(`  [ok] ${name}: ${result.count} records`);
  };

  console.log("--- Tier 0: No FK ---");
  const users = loadJson("00_users.json");
  await batchInsert("User", users, (d) => prisma.user.createMany({ data: d as never[], skipDuplicates: true }));

  const agencies = loadJson("01_agency_history.json");
  await batchInsert("AgencyHistory", agencies, (d) => prisma.agencyHistory.createMany({ data: d as never[], skipDuplicates: true }));

  const storageLayout = loadJson("01_storage_layout.json");
  for (const layout of storageLayout as Array<{ id: string; data: unknown; createdAt: Date; updatedAt: Date }>) {
    await prisma.storageLayout.upsert({
      where: { id: layout.id },
      update: { data: layout.data as never },
      create: layout as never,
    });
  }
  console.log(`  [ok] StorageLayout: ${storageLayout.length} records`);

  const backupSchedule = loadJson("01_backup_schedule.json");
  for (const bs of backupSchedule as Array<{ id: string; [key: string]: unknown }>) {
    await prisma.backupSchedule.upsert({
      where: { id: bs.id },
      update: bs as never,
      create: bs as never,
    });
  }
  console.log(`  [ok] BackupSchedule: ${backupSchedule.length} records`);

  const backupRuns = loadJson("01_backup_runs.json");
  await batchInsert("BackupRun", backupRuns, (d) => prisma.backupRun.createMany({ data: d as never[], skipDuplicates: true }));

  console.log("\n--- Tier 1: Depends on Tier 0 ---");
  const boxes = loadJson("02_storage_boxes.json");
  await batchInsert("StorageBox", boxes, (d) => prisma.storageBox.createMany({ data: d as never[], skipDuplicates: true }));

  const auditLogs = loadJson("02_audit_logs.json");
  await batchInsert("AuditLog", auditLogs, (d) => prisma.auditLog.createMany({ data: d as never[], skipDuplicates: true }));

  const userAccessLogs = loadJson("02_user_access_logs.json");
  await batchInsert("UserAccessLog", userAccessLogs, (d) => prisma.userAccessLog.createMany({ data: d as never[], skipDuplicates: true }));

  console.log("\n--- Tier 2: Depends on Tier 1 ---");
  const boxLabels = loadJson("03_storage_box_labels.json");
  await batchInsert("StorageBoxLabel", boxLabels, (d) => prisma.storageBoxLabel.createMany({ data: d as never[], skipDuplicates: true }));

  const files = loadJson("03_files.json");
  await batchInsert("File", files, (d) => prisma.file.createMany({ data: d as never[], skipDuplicates: true }));

  const borrowSlips = loadJson("03_borrow_slips.json");
  await batchInsert("BorrowSlip", borrowSlips, (d) => prisma.borrowSlip.createMany({ data: d as never[], skipDuplicates: true }));

  console.log("\n--- Tier 3: Depends on Tier 2 ---");
  const fileIndexes = loadJson("04_file_indexes.json");
  await batchInsert("FileIndex", fileIndexes, (d) => prisma.fileIndex.createMany({ data: d as never[], skipDuplicates: true }));

  const documents = loadJson("04_documents.json");
  await batchInsert("Document", documents, (d) => prisma.document.createMany({ data: d as never[], skipDuplicates: true }));

  const borrowItems = loadJson("04_borrow_items.json");
  await batchInsert("BorrowItem", borrowItems, (d) => prisma.borrowItem.createMany({ data: d as never[], skipDuplicates: true }));

  const borrowSlipEvents = loadJson("04_borrow_slip_events.json");
  await batchInsert("BorrowSlipEvent", borrowSlipEvents, (d) => prisma.borrowSlipEvent.createMany({ data: d as never[], skipDuplicates: true }));
}

async function main() {
  console.log(`Importing from local backup: ${backupDir}\n`);

  await clearAll();
  await importAll();

  console.log("\nImport done!");
  console.log("Verify result:");
  console.log(`   bun prisma/scripts/verify-migration.ts --url="${connectionString!.replace(/:[^:@]+@/, ":***@")}"`);
}

main()
  .catch((error) => {
    console.error("[error] import failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
