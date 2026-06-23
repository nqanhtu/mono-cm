/**
 * Export toàn bộ dữ liệu từ DB staging ra file JSON trên máy LOCAL
 *
 * Cách dùng:
 *   bun prisma/scripts/export-staging.ts --url="<staging_db_url>"
 *   hoặc đọc từ .env nếu không truyền --url
 *
 * Output: ./backups/<timestamp>/ (trên máy local đang chạy script)
 */
import "dotenv/config";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";

// Nhận URL qua argument --url="..." hoặc fallback về .env
const urlArg = process.argv.find((a) => a.startsWith("--url="))?.slice(6);
const connectionString = urlArg || process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ Cần cung cấp DATABASE_URL.");
  console.error('   Cách 1: bun prisma/scripts/export-staging.ts --url="postgresql://..."');
  console.error("   Cách 2: Đặt DATABASE_URL trong file .env");
  process.exit(1);
}

console.log(`Connecting to DB: ${connectionString.replace(/:[^:@]+@/, ":***@")}`);

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outDir = join(process.cwd(), "backups", timestamp);
  mkdirSync(outDir, { recursive: true });

  console.log(`\nExporting to local: ${outDir}\n`);

  const save = (filename: string, data: unknown[]) => {
    const filePath = join(outDir, filename);
    writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    console.log(`  [ok] ${filename} (${data.length} records)`);
  };

  // === TIER 0: Bảng độc lập (không FK) ===
  console.log("--- Tier 0: No FK ---");

  const users = await prisma.user.findMany();
  save("00_users.json", users);

  const agencies = await prisma.agencyHistory.findMany();
  save("01_agency_history.json", agencies);

  const storageLayout = await prisma.storageLayout.findMany();
  save("01_storage_layout.json", storageLayout);

  const backupSchedule = await prisma.backupSchedule.findMany();
  save("01_backup_schedule.json", backupSchedule);

  const backupRuns = await prisma.backupRun.findMany();
  save("01_backup_runs.json", backupRuns);

  // === TIER 1: Phụ thuộc Tier 0 ===
  console.log("\n--- Tier 1: Depends on Tier 0 ---");

  const boxes = await prisma.storageBox.findMany();
  save("02_storage_boxes.json", boxes);

  const auditLogs = await prisma.auditLog.findMany();
  save("02_audit_logs.json", auditLogs);

  const userAccessLogs = await prisma.userAccessLog.findMany();
  save("02_user_access_logs.json", userAccessLogs);

  // === TIER 2: Phụ thuộc Tier 1 ===
  console.log("\n--- Tier 2: Depends on Tier 1 ---");

  const boxLabels = await prisma.storageBoxLabel.findMany();
  save("03_storage_box_labels.json", boxLabels);

  const files = await prisma.file.findMany();
  save("03_files.json", files);

  const borrowSlips = await prisma.borrowSlip.findMany();
  save("03_borrow_slips.json", borrowSlips);

  // === TIER 3: Phụ thuộc Tier 2 ===
  console.log("\n--- Tier 3: Depends on Tier 2 ---");

  const fileIndexes = await prisma.fileIndex.findMany();
  save("04_file_indexes.json", fileIndexes);

  const documents = await prisma.document.findMany();
  save("04_documents.json", documents);

  const borrowItems = await prisma.borrowItem.findMany();
  save("04_borrow_items.json", borrowItems);

  const borrowSlipEvents = await prisma.borrowSlipEvent.findMany();
  save("04_borrow_slip_events.json", borrowSlipEvents);

  // === SUMMARY ===
  const total =
    users.length + agencies.length + boxes.length + boxLabels.length +
    files.length + fileIndexes.length + documents.length +
    borrowSlips.length + borrowItems.length + borrowSlipEvents.length +
    auditLogs.length + userAccessLogs.length;

  console.log(`\nExport done! Total: ${total} records`);
  console.log(`Backup saved to: ${outDir}`);
  console.log(`\nNext step - import to client DB:`);
  console.log(`  bun prisma/scripts/import-to-client.ts --url="<client_db_url>" --from="${outDir}"`);
}

main()
  .catch((error) => {
    console.error("[error] export failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
