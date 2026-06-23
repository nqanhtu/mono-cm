/**
 * Verify số bản ghi giữa hai DB sau khi migration
 * Dùng: DATABASE_URL="<db_url>" bun prisma/scripts/verify-migration.ts
 */
import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not configured");

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Checking record counts in database...\n");

  const counts = await Promise.all([
    prisma.user.count().then((n) => ({ table: "User", count: n })),
    prisma.agencyHistory.count().then((n) => ({ table: "AgencyHistory", count: n })),
    prisma.storageBox.count().then((n) => ({ table: "StorageBox", count: n })),
    prisma.storageBoxLabel.count().then((n) => ({ table: "StorageBoxLabel", count: n })),
    prisma.storageLayout.count().then((n) => ({ table: "StorageLayout", count: n })),
    prisma.file.count().then((n) => ({ table: "File", count: n })),
    prisma.fileIndex.count().then((n) => ({ table: "FileIndex", count: n })),
    prisma.document.count().then((n) => ({ table: "Document", count: n })),
    prisma.borrowSlip.count().then((n) => ({ table: "BorrowSlip", count: n })),
    prisma.borrowItem.count().then((n) => ({ table: "BorrowItem", count: n })),
    prisma.borrowSlipEvent.count().then((n) => ({ table: "BorrowSlipEvent", count: n })),
    prisma.auditLog.count().then((n) => ({ table: "AuditLog", count: n })),
    prisma.userAccessLog.count().then((n) => ({ table: "UserAccessLog", count: n })),
    prisma.backupSchedule.count().then((n) => ({ table: "BackupSchedule", count: n })),
    prisma.backupRun.count().then((n) => ({ table: "BackupRun", count: n })),
  ]);

  const total = counts.reduce((sum, r) => sum + r.count, 0);

  // In bảng kết quả
  const maxLen = Math.max(...counts.map((r) => r.table.length));
  console.log(`${"Table".padEnd(maxLen + 2)} | Count`);
  console.log(`${"-".repeat(maxLen + 2)}-+-------`);
  for (const row of counts) {
    const label = row.table.padEnd(maxLen + 2);
    const count = String(row.count).padStart(6);
    const icon = row.count === 0 ? " [empty]" : "";
    console.log(`${label} | ${count}${icon}`);
  }
  console.log(`${"-".repeat(maxLen + 2)}-+-------`);
  console.log(`${"TOTAL".padEnd(maxLen + 2)} | ${String(total).padStart(6)}`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
