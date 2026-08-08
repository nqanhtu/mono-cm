/**
 * Verify số bản ghi trong DB đích — có thể so sánh với DB nguồn
 *
 * Chế độ 1 — kiểm tra một DB:
 *   bun prisma/scripts/verify-migration.ts --url="<db_url>"
 *   hoặc set DATABASE_URL trong .env
 *
 * Chế độ 2 — so sánh source vs dest (dùng sau prod→dev migration):
 *   bun prisma/scripts/verify-migration.ts \
 *     --source="postgresql://<prod_url>" \
 *     --dest="postgresql://<dev_url>"
 */
import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";

// === Parse arguments ===
const sourceArg = process.argv.find((a) => a.startsWith("--source="))?.slice(9);
const destArg   = process.argv.find((a) => a.startsWith("--dest="))?.slice(7);
const urlArg    = process.argv.find((a) => a.startsWith("--url="))?.slice(6);

// Chế độ so sánh (--source + --dest) hoặc chế độ đơn (--url / DATABASE_URL)
const isCompareMode = !!(sourceArg && destArg);
const singleUrl = urlArg || process.env.DATABASE_URL;

if (!isCompareMode && !singleUrl) {
  console.error("❌ Thiếu thông tin kết nối.");
  console.error("   Chế độ 1: bun prisma/scripts/verify-migration.ts --url=\"postgresql://...\"");
  console.error("   Chế độ 2: bun prisma/scripts/verify-migration.ts --source=\"<prod>\" --dest=\"<dev>\"");
  process.exit(1);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function maskUrl(url: string) {
  return url.replace(/:[^:@]+@/, ":***@");
}

function makePrisma(url: string) {
  const pool = new Pool({ connectionString: url });
  const adapter = new PrismaPg(pool);
  const client = new PrismaClient({ adapter });
  return { client, pool };
}

async function getCounts(prisma: PrismaClient) {
  const rows = await Promise.all([
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
  return rows;
}

// ─── Chế độ 1: kiểm tra một DB ───────────────────────────────────────────────

async function runSingleMode(url: string) {
  console.log(`Kiểm tra DB: ${maskUrl(url)}\n`);
  const { client, pool } = makePrisma(url);

  try {
    const counts = await getCounts(client);
    const total = counts.reduce((sum, r) => sum + r.count, 0);

    const maxLen = Math.max(...counts.map((r) => r.table.length));
    console.log(`${"Table".padEnd(maxLen + 2)} | Count`);
    console.log(`${"-".repeat(maxLen + 2)}-+-------`);
    for (const row of counts) {
      const label = row.table.padEnd(maxLen + 2);
      const count = String(row.count).padStart(6);
      const icon  = row.count === 0 ? " [empty]" : "";
      console.log(`${label} | ${count}${icon}`);
    }
    console.log(`${"-".repeat(maxLen + 2)}-+-------`);
    console.log(`${"TOTAL".padEnd(maxLen + 2)} | ${String(total).padStart(6)}`);
  } finally {
    await client.$disconnect();
    await pool.end();
  }
}

// ─── Chế độ 2: so sánh source vs dest ────────────────────────────────────────

async function runCompareMode(srcUrl: string, dstUrl: string) {
  console.log(`So sánh hai DB:`);
  console.log(`  SOURCE (prod): ${maskUrl(srcUrl)}`);
  console.log(`  DEST   (dev) : ${maskUrl(dstUrl)}\n`);

  const src = makePrisma(srcUrl);
  const dst = makePrisma(dstUrl);

  try {
    const [srcCounts, dstCounts] = await Promise.all([
      getCounts(src.client),
      getCounts(dst.client),
    ]);

    const maxLen = Math.max(...srcCounts.map((r) => r.table.length));
    const header = `${"Table".padEnd(maxLen + 2)} | ${"SOURCE".padStart(8)} | ${"DEST".padStart(8)} | OK?`;
    const sep    = `${"-".repeat(maxLen + 2)}-+---------+---------+-----`;

    console.log(header);
    console.log(sep);

    let allMatch = true;
    let totalSrc = 0;
    let totalDst = 0;

    for (const srcRow of srcCounts) {
      const dstRow = dstCounts.find((r) => r.table === srcRow.table)!;
      const match = srcRow.count === dstRow.count;
      if (!match) allMatch = false;
      totalSrc += srcRow.count;
      totalDst += dstRow.count;

      const label  = srcRow.table.padEnd(maxLen + 2);
      const srcN   = String(srcRow.count).padStart(8);
      const dstN   = String(dstRow.count).padStart(8);
      const status = match ? "  ✓" : "  ✗ LỆCH";
      console.log(`${label} | ${srcN} | ${dstN} |${status}`);
    }

    console.log(sep);
    console.log(`${"TOTAL".padEnd(maxLen + 2)} | ${String(totalSrc).padStart(8)} | ${String(totalDst).padStart(8)} |`);

    if (allMatch) {
      console.log("\n┌────────────────────────────────────┐");
      console.log("│  ✅  ĐẠT — source và dest khớp nhau  │");
      console.log("└────────────────────────────────────┘");
    } else {
      console.log("\n┌────────────────────────────────────────────┐");
      console.log("│  ❌  KHÔNG ĐẠT — có bảng bị lệch số bản ghi │");
      console.log("└────────────────────────────────────────────┘");
      console.log("  Hành động: kiểm tra lại bước export/import, chạy lại import-to-client.ts");
      process.exitCode = 1;
    }
  } finally {
    await src.client.$disconnect();
    await dst.client.$disconnect();
    await src.pool.end();
    await dst.pool.end();
  }
}

// ─── Entry point ──────────────────────────────────────────────────────────────

if (isCompareMode) {
  runCompareMode(sourceArg!, destArg!).catch((e) => {
    console.error("[error]", e);
    process.exit(1);
  });
} else {
  runSingleMode(singleUrl!).catch((e) => {
    console.error("[error]", e);
    process.exit(1);
  });
}
