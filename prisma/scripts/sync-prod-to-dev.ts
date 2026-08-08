#!/usr/bin/env bun
/**
 * sync-prod-to-dev.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Đồng bộ dữ liệu MỚI NHẤT từ DB production về DB dev/test local.
 * Hỗ trợ SSH tunnel — tự mở, sync xong tự đóng.
 *
 * Cách dùng — kết nối thẳng:
 *   bun run db:sync \
 *     --source="postgresql://<user>:<pass>@<host>:5432/<db>" \
 *     --dest="postgresql://postgres:postgres@localhost:5432/dev_cm_local"
 *
 * Cách dùng — qua SSH tunnel (khi server không mở IP public):
 *   bun run db:sync \
 *     --source="postgresql://<user>:<pass>@<db_host>:5432/<db>" \
 *     --dest="postgresql://postgres:postgres@localhost:5432/dev_cm_local" \
 *     --ssh-host="<user>@<server_host>"
 *
 * Hoặc lưu vào .env.sync (không commit):
 *   SOURCE_DB_URL=postgresql://...
 *   DEV_DB_URL=postgresql://...
 *   SSH_HOST=deploy@103.152.164.153     # tuỳ chọn — bật SSH tunnel
 *   SSH_KEY=~/.ssh/id_rsa               # tuỳ chọn — mặc định dùng SSH agent
 *   SSH_PORT=22                         # tuỳ chọn — mặc định 22
 *   TUNNEL_LOCAL_PORT=15432             # tuỳ chọn — mặc định 15432
 *
 * Flow tự động:
 *   1. Kiểm tra kết nối cả hai DB (qua tunnel nếu cấu hình)
 *   2. Export toàn bộ dữ liệu từ SOURCE ra thư mục tạm
 *   3. Chạy prisma migrate deploy trên DEST (đồng bộ schema)
 *   4. Xóa data cũ + import data mới vào DEST (giữ FK order)
 *   5. So sánh số bản ghi SOURCE vs DEST
 *   6. Dọn dẹp thư mục tạm + đóng tunnel
 * ─────────────────────────────────────────────────────────────────────────────
 */
import "dotenv/config";
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "fs";
import { join } from "path";
import { execSync, spawn, type ChildProcess } from "child_process";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";

// ─── Parse args & env ────────────────────────────────────────────────────────

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  const lines = readFileSync(path, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

// Load .env.sync nếu có
loadEnvFile(join(process.cwd(), ".env.sync"));

const arg = (name: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

const sourceUrl = arg("source") || process.env.SOURCE_DB_URL;
const destUrl = arg("dest") || process.env.DEV_DB_URL;
const sshKey = arg("ssh-key") || process.env.SSH_KEY;
const tunnelPort = arg("tunnel-port") || process.env.TUNNEL_LOCAL_PORT || "15432";

// SSH_HOST có thể ở dạng "user@host" hoặc "user@host:port" — tự tách port
function parseSshHost(raw: string): { user_host: string; port: string } {
  // Tách phần sau @ để tránh nhầm @ trong username
  const atIdx = raw.lastIndexOf("@");
  const userPart = atIdx >= 0 ? raw.slice(0, atIdx + 1) : "";
  const hostPart = atIdx >= 0 ? raw.slice(atIdx + 1) : raw;

  // Nếu hostPart chứa ":" thì đó là host:port
  const colonIdx = hostPart.lastIndexOf(":");
  if (colonIdx >= 0) {
    const host = hostPart.slice(0, colonIdx);
    const port = hostPart.slice(colonIdx + 1).replace(/\D/g, ""); // chỉ giữ số
    return { user_host: userPart + host, port: port || "22" };
  }
  return { user_host: raw.trim().replace(/:$/, ""), port: "22" };
}

const rawSshHost = arg("ssh-host") || process.env.SSH_HOST;
const parsed_ssh = rawSshHost ? parseSshHost(rawSshHost) : null;
const sshHost = parsed_ssh?.user_host;
const sshPort = arg("ssh-port") || process.env.SSH_PORT || parsed_ssh?.port || "22";

const skipVerify = process.argv.includes("--skip-verify");
const keepBackup = process.argv.includes("--keep-backup");
const dryRun = process.argv.includes("--dry-run");

if (!sourceUrl || !destUrl) {
  console.error("❌  Thiếu thông tin kết nối.\n");
  console.error("Cách 1 — Kết nối thẳng:");
  console.error('  bun run db:sync \\');
  console.error('    --source="postgresql://<prod_url>" \\');
  console.error('    --dest="postgresql://<dev_url>"');
  console.error("\nCách 2 — SSH tunnel (server không mở IP public):");
  console.error('  bun run db:sync \\');
  console.error('    --source="postgresql://<prod_url>" \\');
  console.error('    --dest="postgresql://<dev_url>" \\');
  console.error('    --ssh-host="deploy@103.152.164.153"');
  console.error("\nCách 3 — File .env.sync (không commit):");
  console.error("  SOURCE_DB_URL=postgresql://...");
  console.error("  DEV_DB_URL=postgresql://...");
  console.error("  SSH_HOST=deploy@103.152.164.153   # tuỳ chọn");
  process.exit(1);
}

function maskUrl(url: string) {
  return url.replace(/:[^:@]+@/, ":***@");
}

// ─── SSH Tunnel ──────────────────────────────────────────────────────────────

/**
 * Phân tích DB host:port từ connection URL.
 * Dùng regex làm fallback khi URL chứa ký tự đặc biệt trong password.
 */
function parseDbHostPort(url: string): { host: string; port: number } {
  // Regex: postgresql://user:pass@HOST:PORT/db
  // Dùng regex vì new URL() có thể bị lỗi khi pass chứa ký tự đặc biệt
  const m = url.match(/@([^/:@]+)(?::(\d+))?\//);
  if (m) {
    return { host: m[1], port: parseInt(m[2] || "5432", 10) };
  }
  // Fallback về URL parser
  try {
    const parsed = new URL(url);
    return { host: parsed.hostname, port: parseInt(parsed.port || "5432", 10) };
  } catch {
    throw new Error(`Không parse được DB URL: ${maskUrl(url)}`);
  }
}

/**
 * Tạo URL mới trỏ về localhost tunnel port, giữ nguyên phần còn lại.
 * Dùng regex replace để tránh URL parser làm hỏng password đặc biệt.
 */
function patchUrlForTunnel(url: string, localPort: string): string {
  // Thay @HOST:PORT/ hoặc @HOST/ thành @127.0.0.1:PORT/
  return url.replace(
    /(@)([^/:@]+)(:\d+)?(\/)/,
    `$1127.0.0.1:${localPort}$4`,
  );
}

/**
 * Kiểm tra xem một port local có RẢNH hay không trước khi mở tunnel.
 */
async function isPortInUse(port: number): Promise<boolean> {
  const { createConnection } = await import("net");
  return new Promise((resolve) => {
    const sock = createConnection({ port, host: "127.0.0.1" });
    sock.once("connect", () => { sock.destroy(); resolve(true); });
    sock.once("error", () => { resolve(false); });
  });
}

/**
 * Mở SSH tunnel và chờ cho đến khi tunnel sẵn sàng.
 * Trả về ChildProcess để caller có thể kill khi xong.
 */
async function openSshTunnel(params: {
  sshHost: string;
  sshPort: string;
  sshKey?: string;
  dbHost: string;
  dbPort: number;
  localPort: string;
  remoteTarget?: string;
}): Promise<ChildProcess> {
  const { sshHost, sshPort, sshKey, dbHost, dbPort, localPort, remoteTarget } = params;
  const lPort = parseInt(localPort, 10);

  // 1. Kiểm tra nếu localPort đã bị chiếm trước khi mở tunnel
  const alreadyInUse = await isPortInUse(lPort);
  if (alreadyInUse) {
    throw new Error(
      `Cổng local ${localPort} đã bị chiếm dụng bởi dịch vụ khác (ví dụ: PostgreSQL local đang chạy trên máy bạn).\n` +
      `  Vui lòng đặt TUNNEL_LOCAL_PORT trong .env.sync thành một cổng khác (ví dụ: TUNNEL_LOCAL_PORT=15432).`
    );
  }

  // 2. Xác định remote target host (từ góc nhìn của SSH server):
  // Nếu SSH server là root@160.30.160.49, Postgres trên server đó nằm ở 127.0.0.1 đối với SSH server.
  // Tránh gửi 160.30.160.49 làm target vì Postgres trên server sẽ thấy request từ IP ngoài và bị pg_hba.conf chặn.
  const targetHostOnRemote = remoteTarget || (dbHost === "localhost" ? "127.0.0.1" : "127.0.0.1");

  const sshArgs = [
    "-N",                          // không chạy remote command
    "-o", "StrictHostKeyChecking=no",
    "-o", "ExitOnForwardFailure=yes",
    "-o", "ServerAliveInterval=30",
    "-o", "ServerAliveCountMax=3",
    "-p", sshPort,
    "-L", `${localPort}:${targetHostOnRemote}:${dbPort}`,
  ];

  if (sshKey) {
    sshArgs.push("-i", sshKey.replace(/^~/, process.env.HOME ?? "~"));
  }

  sshArgs.push(sshHost);

  console.log(`  Mở tunnel: localhost:${localPort} → ${targetHostOnRemote}:${dbPort} (qua ${sshHost})`);

  const proc = spawn("ssh", sshArgs, {
    stdio: ["ignore", "ignore", "pipe"],
    detached: false,
  });

  // In stderr của ssh để debug nếu cần
  proc.stderr?.on("data", (data: Buffer) => {
    const msg = data.toString().trim();
    if (msg) console.log(`  [ssh] ${msg}`);
  });

  proc.on("error", (e) => {
    console.error(`  ✗  SSH process error: ${e.message}`);
    console.error("     Kiểm tra: ssh có cài chưa? SSH_HOST đúng chưa? Key có quyền truy cập không?");
  });

  // Đợi tunnel sẵn sàng — poll TCP; nếu SSH exit sớm thì báo lỗi ngay
  let tunnelError: Error | null = null;
  proc.on("exit", (code) => {
    if (code !== null && code !== 0) {
      tunnelError = new Error(`SSH tunnel thoát với code ${code}. Kiểm tra SSH_HOST, key, và quyền truy cập.`);
    }
  });

  try {
    await waitForPort(lPort, 15000, () => tunnelError);
  } catch (e) {
    if (!proc.killed) proc.kill();
    throw e;
  }

  return proc;
}

/**
 * Poll localhost:<port> cho đến khi kết nối được (tunnel đã sẵn sàng).
 * getError: callback trả về lỗi nếu SSH process đã thoát sớm.
 */
async function waitForPort(
  port: number,
  timeoutMs = 15000,
  getError?: () => Error | null,
): Promise<void> {
  const { createConnection } = await import("net");
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    // Kiểm tra SSH có bị crash không
    const err = getError?.();
    if (err) throw err;

    const ok = await new Promise<boolean>((resolve) => {
      const sock = createConnection({ port, host: "127.0.0.1" });
      sock.once("connect", () => { sock.destroy(); resolve(true); });
      sock.once("error", () => { resolve(false); });
    });

    if (ok) {
      console.log(`  ✓  Tunnel đã sẵn sàng (localhost:${port})`);
      return;
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  throw new Error(
    `Timeout: tunnel localhost:${port} không mở được sau ${timeoutMs / 1000}s.\n` +
    `  Gợi ý: kiểm tra SSH_HOST ("${sshHost}"), SSH_KEY, và pg_hba.conf trên server.`,
  );
}

// ─── DB helpers ──────────────────────────────────────────────────────────────

function makePrisma(url: string) {
  const pool = new Pool({ connectionString: url });
  const adapter = new PrismaPg(pool);
  const client = new PrismaClient({ adapter });
  return { client, pool };
}

async function testConnection(url: string, label: string) {
  const { client, pool } = makePrisma(url);
  try {
    await client.$queryRaw`SELECT 1`;
    console.log(`  ✓  ${label}: ${maskUrl(url)}`);
  } catch (e) {
    console.error(`  ✗  ${label}: ${maskUrl(url)}`);
    console.error(`     ${(e as Error).message}`);
    throw e;
  } finally {
    await client.$disconnect();
    await pool.end();
  }
}

async function getCounts(prisma: PrismaClient) {
  return Promise.all([
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
}

// ─── Export từ SOURCE ─────────────────────────────────────────────────────────

async function exportFromSource(url: string, outDir: string) {
  console.log(`\n📤  Bước 2/5 — Export dữ liệu từ SOURCE...`);
  const { client, pool } = makePrisma(url);

  try {
    const save = (filename: string, data: unknown[]) => {
      writeFileSync(join(outDir, filename), JSON.stringify(data, null, 2), "utf-8");
      console.log(`  [ok] ${filename} (${data.length} records)`);
      return data.length;
    };

    let total = 0;

    console.log("  --- Tier 0 ---");
    total += save("00_users.json", await client.user.findMany());
    total += save("01_agency_history.json", await client.agencyHistory.findMany());
    total += save("01_storage_layout.json", await client.storageLayout.findMany());
    total += save("01_backup_schedule.json", await client.backupSchedule.findMany());
    total += save("01_backup_runs.json", await client.backupRun.findMany());

    console.log("  --- Tier 1 ---");
    total += save("02_storage_boxes.json", await client.storageBox.findMany());
    total += save("02_audit_logs.json", await client.auditLog.findMany());
    total += save("02_user_access_logs.json", await client.userAccessLog.findMany());

    console.log("  --- Tier 2 ---");
    total += save("03_storage_box_labels.json", await client.storageBoxLabel.findMany());
    total += save("03_files.json", await client.file.findMany());
    total += save("03_borrow_slips.json", await client.borrowSlip.findMany());

    console.log("  --- Tier 3 ---");
    total += save("04_file_indexes.json", await client.fileIndex.findMany());
    total += save("04_documents.json", await client.document.findMany());
    total += save("04_borrow_items.json", await client.borrowItem.findMany());
    total += save("04_borrow_slip_events.json", await client.borrowSlipEvent.findMany());

    console.log(`  Export xong: ${total} records`);
    return total;
  } finally {
    await client.$disconnect();
    await pool.end();
  }
}

// ─── Migrate schema trên DEST ─────────────────────────────────────────────────

function migrateSchema(url: string) {
  console.log(`\n🔧  Bước 3/5 — Đồng bộ schema (prisma migrate deploy)...`);
  try {
    execSync(`DATABASE_URL="${url}" bunx prisma migrate deploy`, {
      stdio: "pipe",
      encoding: "utf-8",
    });
    console.log("  ✓  Schema up to date");
  } catch (e: unknown) {
    const output = (e as { stdout?: string; stderr?: string });
    const out = (output.stdout ?? "") + (output.stderr ?? "");
    if (out.includes("up to date") || out.includes("No pending migrations")) {
      console.log("  ✓  Schema already up to date");
    } else {
      console.error("  ✗  migrate deploy failed:");
      console.error(out);
      throw new Error("Schema migration failed");
    }
  }
}

// ─── Import vào DEST ─────────────────────────────────────────────────────────

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

function loadJson<T>(dir: string, filename: string): T[] {
  const fp = join(dir, filename);
  if (!existsSync(fp)) return [];
  return (JSON.parse(readFileSync(fp, "utf-8")) as T[]).map(convertDates);
}

async function importToDestination(url: string, backupDir: string) {
  console.log(`\n📥  Bước 4/5 — Import vào DEST...`);
  const { client, pool } = makePrisma(url);

  try {
    console.log("  Đang xóa dữ liệu cũ...");
    await client.$transaction([
      client.borrowSlipEvent.deleteMany(),
      client.borrowItem.deleteMany(),
      client.borrowSlip.deleteMany(),
      client.fileIndex.deleteMany(),
      client.document.deleteMany(),
      client.file.deleteMany(),
      client.storageBoxLabel.deleteMany(),
      client.storageBox.deleteMany(),
      client.auditLog.deleteMany(),
      client.userAccessLog.deleteMany(),
      client.agencyHistory.deleteMany(),
      client.storageLayout.deleteMany(),
      client.backupRun.deleteMany(),
      client.user.deleteMany(),
    ]);
    await client.backupSchedule.deleteMany();
    console.log("  ✓  Cleared");

    const ins = async (label: string, data: unknown[], fn: () => Promise<{ count: number }>) => {
      if (data.length === 0) { console.log(`  [skip] ${label}: empty`); return; }
      const r = await fn();
      console.log(`  [ok]   ${label}: ${r.count} records`);
    };

    console.log("  --- Tier 0 ---");
    const users = loadJson(backupDir, "00_users.json");
    await ins("User", users, () => client.user.createMany({ data: users as never[], skipDuplicates: true }));

    const agencies = loadJson(backupDir, "01_agency_history.json");
    await ins("AgencyHistory", agencies, () => client.agencyHistory.createMany({ data: agencies as never[], skipDuplicates: true }));

    const layouts = loadJson<{ id: string; data: unknown; createdAt: Date; updatedAt: Date }>(backupDir, "01_storage_layout.json");
    for (const l of layouts) {
      await client.storageLayout.upsert({ where: { id: l.id }, update: { data: l.data as never }, create: l as never });
    }
    console.log(`  [ok]   StorageLayout: ${layouts.length} records`);

    const bsched = loadJson<{ id: string } & Record<string, unknown>>(backupDir, "01_backup_schedule.json");
    for (const s of bsched) {
      await client.backupSchedule.upsert({ where: { id: s.id }, update: s as never, create: s as never });
    }
    console.log(`  [ok]   BackupSchedule: ${bsched.length} records`);

    const bRuns = loadJson(backupDir, "01_backup_runs.json");
    await ins("BackupRun", bRuns, () => client.backupRun.createMany({ data: bRuns as never[], skipDuplicates: true }));

    console.log("  --- Tier 1 ---");
    const boxes = loadJson(backupDir, "02_storage_boxes.json");
    await ins("StorageBox", boxes, () => client.storageBox.createMany({ data: boxes as never[], skipDuplicates: true }));

    const auditLogs = loadJson(backupDir, "02_audit_logs.json");
    await ins("AuditLog", auditLogs, () => client.auditLog.createMany({ data: auditLogs as never[], skipDuplicates: true }));

    const accessLogs = loadJson(backupDir, "02_user_access_logs.json");
    await ins("UserAccessLog", accessLogs, () => client.userAccessLog.createMany({ data: accessLogs as never[], skipDuplicates: true }));

    console.log("  --- Tier 2 ---");
    const boxLabels = loadJson(backupDir, "03_storage_box_labels.json");
    await ins("StorageBoxLabel", boxLabels, () => client.storageBoxLabel.createMany({ data: boxLabels as never[], skipDuplicates: true }));

    const files = loadJson(backupDir, "03_files.json");
    await ins("File", files, () => client.file.createMany({ data: files as never[], skipDuplicates: true }));

    const slips = loadJson(backupDir, "03_borrow_slips.json");
    await ins("BorrowSlip", slips, () => client.borrowSlip.createMany({ data: slips as never[], skipDuplicates: true }));

    console.log("  --- Tier 3 ---");
    const fileIndexes = loadJson(backupDir, "04_file_indexes.json");
    await ins("FileIndex", fileIndexes, () => client.fileIndex.createMany({ data: fileIndexes as never[], skipDuplicates: true }));

    const docs = loadJson(backupDir, "04_documents.json");
    await ins("Document", docs, () => client.document.createMany({ data: docs as never[], skipDuplicates: true }));

    const items = loadJson(backupDir, "04_borrow_items.json");
    await ins("BorrowItem", items, () => client.borrowItem.createMany({ data: items as never[], skipDuplicates: true }));

    const events = loadJson(backupDir, "04_borrow_slip_events.json");
    await ins("BorrowSlipEvent", events, () => client.borrowSlipEvent.createMany({ data: events as never[], skipDuplicates: true }));

    console.log("  ✓  Import xong");
  } finally {
    await client.$disconnect();
    await pool.end();
  }
}

// ─── Verify ──────────────────────────────────────────────────────────────────

async function verify(srcUrl: string, dstUrl: string): Promise<boolean> {
  console.log(`\n🔍  Bước 5/5 — Kiểm tra số bản ghi SOURCE vs DEST...`);
  const src = makePrisma(srcUrl);
  const dst = makePrisma(dstUrl);

  try {
    const [srcCounts, dstCounts] = await Promise.all([
      getCounts(src.client),
      getCounts(dst.client),
    ]);

    let allMatch = true;
    const mismatches: string[] = [];

    for (const s of srcCounts) {
      const d = dstCounts.find((r) => r.table === s.table)!;
      if (s.count !== d.count) {
        allMatch = false;
        mismatches.push(`  ✗  ${s.table}: SOURCE=${s.count}, DEST=${d.count}`);
      } else {
        console.log(`  ✓  ${s.table}: ${s.count}`);
      }
    }

    if (!allMatch) {
      console.log("\nBảng bị lệch:");
      mismatches.forEach((m) => console.log(m));
    }

    return allMatch;
  } finally {
    await src.client.$disconnect();
    await dst.client.$disconnect();
    await src.pool.end();
    await dst.pool.end();
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();
  let tunnelProc: ChildProcess | null = null;

  // URL thực sự dùng để kết nối SOURCE (có thể đã được patch qua tunnel)
  let effectiveSourceUrl = sourceUrl!;
  let effectivedestUrl = destUrl!;
  // Cleanup function — đóng tunnel khi exit
  const cleanup = (label: string) => {
    if (tunnelProc && !tunnelProc.killed) {
      tunnelProc.kill("SIGTERM");
      console.log(`\n  [tunnel] Đã đóng SSH tunnel (${label})`);
    }
  };
  process.on("exit", () => cleanup("exit"));
  process.on("SIGINT", () => { cleanup("SIGINT"); process.exit(130); });
  process.on("SIGTERM", () => { cleanup("SIGTERM"); process.exit(143); });

  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║       sync-prod-to-dev — đồng bộ data từ prod        ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log(`  SOURCE: ${maskUrl(sourceUrl!)}`);
  console.log(`  DEST  : ${maskUrl(destUrl!)}`);
  if (sshHost) console.log(`  SSH   : ${sshHost} (port ${sshPort})`);
  if (dryRun) console.log("  [DRY RUN] — chỉ kiểm tra kết nối, không thay đổi data");

  // ── Mở SSH tunnel nếu cấu hình ──
  if (sshHost) {
    console.log(`\n🔑  Chuẩn bị SSH tunnel...`);
    const { host: dbHost, port: dbPort } = parseDbHostPort(sourceUrl!);
    tunnelProc = await openSshTunnel({
      sshHost,
      sshPort,
      sshKey,
      dbHost,
      dbPort,
      localPort: tunnelPort,
    });
    // Patch URL để kết nối qua tunnel
    effectiveSourceUrl = patchUrlForTunnel(sourceUrl!, tunnelPort);
    console.log(`  Kết nối SOURCE qua: ${maskUrl(effectiveSourceUrl)}`);
  }

  // ── Step 1: Test connections ──
  console.log("\n🔌  Bước 1/5 — Kiểm tra kết nối...");
  await testConnection(effectiveSourceUrl, "SOURCE (prod)");
  await testConnection(destUrl!, "DEST   (dev) ");

  if (dryRun) {
    console.log("\n✅  Dry run hoàn tất — kết nối OK.");
    return;
  }

  // Tạo thư mục tạm
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupDir = join(process.cwd(), ".sync-tmp", timestamp);
  mkdirSync(backupDir, { recursive: true });

  try {
    await exportFromSource(effectiveSourceUrl, backupDir);
    migrateSchema(effectivedestUrl);
    await importToDestination(effectivedestUrl, backupDir);

    if (!skipVerify) {
      const ok = await verify(effectiveSourceUrl, effectivedestUrl!);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      if (ok) {
        console.log("\n╔══════════════════════════════════════════════════════╗");
        console.log(`║  ✅  ĐỒNG BỘ THÀNH CÔNG  (${elapsed}s)`.padEnd(55) + "║");
        console.log("╚══════════════════════════════════════════════════════╝");
        console.log(`  Dev DB đã có data mới nhất từ prod.`);
        console.log(`  Cập nhật .env nếu chưa trỏ về: ${maskUrl(destUrl!)}\n`);
      } else {
        console.log("\n╔══════════════════════════════════════════════════════╗");
        console.log("║  ❌  CÓ BẢNG LỆCH — kiểm tra lại                    ║");
        console.log("╚══════════════════════════════════════════════════════╝");
        process.exitCode = 1;
      }
    } else {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`\n✅  Import xong (${elapsed}s) — bỏ qua verify (--skip-verify)`);
    }
  } finally {
    if (!keepBackup) {
      rmSync(join(process.cwd(), ".sync-tmp"), { recursive: true, force: true });
    } else {
      console.log(`\n  Backup tạm giữ lại tại: ${backupDir}`);
    }
  }
}

main().catch((e) => {
  console.error("\n[error]", e);
  process.exit(1);
});
