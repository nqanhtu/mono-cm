#!/usr/bin/env bun
/**
 * init-new-database.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Script tương tác để khởi tạo một database PostgreSQL trắng mới:
 *   1. Mở SSH Tunnel tự động đến VPS DB (hoặc tái sử dụng nếu đã mở).
 *   2. Nhập tương tác: Database Name, DB User, DB Password (ẩn ký tự),
 *      Superadmin Username, Họ tên, Superadmin Password (ẩn ký tự).
 *   3. Kiểm tra kết nối Database.
 *   4. Tự động chạy Prisma Migrate Deploy để sinh toàn bộ bảng & chỉ mục.
 *   5. Seed tài khoản Superadmin với mật khẩu vừa nhập.
 *   6. In tóm tắt kết nối cho .env.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import readline from "node:readline";
import { spawn, type ChildProcess } from "node:child_process";
import { createConnection } from "node:net";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../../generated/prisma/client";
import { UserRole } from "../../generated/prisma/enums";

// ─── Cấu hình mặc định ───────────────────────────────────────────────────────
const DEFAULT_SSH_HOST = "root@160.30.160.49";
const DEFAULT_SSH_PORT = "8686";
const DEFAULT_LOCAL_TUNNEL_PORT = 15432;
const DEFAULT_SUPERADMIN_USER = "superadmin";
const DEFAULT_SUPERADMIN_NAME = "Quản trị hệ thống";

// ─── Helpers: Interactive Prompt (with masked password support) ─────────────
function createPrompt() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (query: string, defaultValue = ""): Promise<string> => {
    return new Promise((resolve) => {
      const display = defaultValue ? `${query} [${defaultValue}]: ` : `${query}: `;
      rl.question(display, (answer) => {
        resolve(answer.trim() || defaultValue);
      });
    });
  };

  const questionSecret = (query: string): Promise<string> => {
    return new Promise((resolve) => {
      process.stdout.write(`${query}: `);
      const stdin = process.stdin;
      const wasRaw = stdin.isRaw;
      if (stdin.setRawMode) stdin.setRawMode(true);
      stdin.resume();

      let secret = "";

      const onData = (chunk: Buffer) => {
        const char = chunk.toString();
        for (let i = 0; i < char.length; i++) {
          const c = char[i];
          if (c === "\n" || c === "\r" || c === "\u0004") {
            // Enter or EOF
            stdin.removeListener("data", onData);
            if (stdin.setRawMode) stdin.setRawMode(wasRaw);
            process.stdout.write("\n");
            resolve(secret);
            return;
          } else if (c === "\u0003") {
            // Ctrl+C
            process.stdout.write("\n");
            process.exit(1);
          } else if (c === "\b" || c === "\x7f") {
            // Backspace
            if (secret.length > 0) {
              secret = secret.slice(0, -1);
              process.stdout.write("\b \b");
            }
          } else if (c.charCodeAt(0) >= 32) {
            secret += c;
            process.stdout.write("*");
          }
        }
      };

      stdin.on("data", onData);
    });
  };

  return { question, questionSecret, close: () => rl.close() };
}

// ─── Helpers: Port & SSH Tunnel ─────────────────────────────────────────────
async function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = createConnection({ port, host: "127.0.0.1" });
    sock.once("connect", () => {
      sock.destroy();
      resolve(true);
    });
    sock.once("error", () => {
      resolve(false);
    });
  });
}

async function waitForPort(port: number, timeoutMs = 15000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isPortInUse(port)) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Quá thời gian (${timeoutMs}ms) chờ mở cổng localhost:${port}`);
}

async function ensureSshTunnel(sshHost: string, sshPort: string, localPort: number): Promise<{ proc: ChildProcess | null; wasAlreadyOpen: boolean }> {
  const inUse = await isPortInUse(localPort);
  if (inUse) {
    // Kiểm tra xem port này có phải là Postgres tunnel không
    try {
      const pool = new Pool({
        host: "127.0.0.1",
        port: localPort,
        connectionTimeoutMillis: 1500,
      });
      await pool.query("SELECT 1;").catch(() => {});
      await pool.end();
      console.log(`ℹ️  Cổng local ${localPort} đã sẵn sàng (đang mở tunnel). Tái sử dụng.`);
      return { proc: null, wasAlreadyOpen: true };
    } catch {
      // ignore
    }
  }

  console.log(`🔌 Đang mở SSH tunnel: localhost:${localPort} → remote 127.0.0.1:5432 (qua ${sshHost}:${sshPort})...`);
  const proc = spawn(
    "ssh",
    [
      "-N",
      "-o", "StrictHostKeyChecking=no",
      "-o", "ExitOnForwardFailure=yes",
      "-o", "ServerAliveInterval=30",
      "-o", "ServerAliveCountMax=3",
      "-p", sshPort,
      "-L", `${localPort}:127.0.0.1:5432`,
      sshHost,
    ],
    { stdio: ["ignore", "ignore", "pipe"], detached: false }
  );

  let tunnelError: Error | null = null;
  proc.on("exit", (code) => {
    if (code !== null && code !== 0) {
      tunnelError = new Error(`SSH tunnel kết thúc với code ${code}.`);
    }
  });

  await waitForPort(localPort, 15000);
  console.log(`✅ SSH tunnel đã kết nối thành công tại localhost:${localPort}`);
  return { proc, wasAlreadyOpen: false };
}

// ─── Main Flow ───────────────────────────────────────────────────────────────
async function main() {
  console.log("\n========================================================");
  console.log(" 🚀 KHỞI TẠO & SEED DATABASE TRẮNG MỚI (QUA SSH TUNNEL)");
  console.log("========================================================\n");

  const prompt = createPrompt();
  let tunnelProc: ChildProcess | null = null;

  try {
    // 1. Nhập thông tin SSH
    const sshHost = await prompt.question("1. SSH Host (User@Host)", DEFAULT_SSH_HOST);
    const sshPort = await prompt.question("2. SSH Port", DEFAULT_SSH_PORT);
    const localPortStr = await prompt.question("3. Local Tunnel Port", String(DEFAULT_LOCAL_TUNNEL_PORT));
    const localPort = parseInt(localPortStr, 10);

    // Mở SSH Tunnel
    const tunnelResult = await ensureSshTunnel(sshHost, sshPort, localPort);
    tunnelProc = tunnelResult.proc;

    console.log("\n--------------------------------------------------------");
    console.log(" 📝 NHẬP THÔNG TIN DATABASE TRẮNG CẦN KHỞI TẠO");
    console.log("--------------------------------------------------------");

    // 2. Nhập thông tin Database
    let dbName = "";
    while (!dbName) {
      dbName = await prompt.question("4. Tên Database (Database Name)");
      if (!dbName) console.log("   ⚠️  Tên database không được để trống.");
    }

    let dbUser = "";
    while (!dbUser) {
      dbUser = await prompt.question("5. Tên DB User (DB Username)");
      if (!dbUser) console.log("   ⚠️  DB User không được để trống.");
    }

    let dbPass = "";
    while (!dbPass) {
      dbPass = await promptSecret("6. Mật khẩu DB User (DB Password)");
      if (!dbPass) console.log("   ⚠️  Mật khẩu DB không được để trống.");
    }

    console.log("\n--------------------------------------------------------");
    console.log(" 👤 NHẬP THÔNG TIN TÀI KHOẢN SUPERADMIN CẦN TẠO");
    console.log("--------------------------------------------------------");

    // 3. Nhập thông tin Superadmin
    const superadminUser = await prompt.question("7. Superadmin Username", DEFAULT_SUPERADMIN_USER);
    const superadminName = await prompt.question("8. Superadmin Họ tên", DEFAULT_SUPERADMIN_NAME);
    let superadminPass = "";
    while (!superadminPass) {
      superadminPass = await promptSecret("9. Superadmin Password (Mật khẩu đăng nhập)");
      if (!superadminPass) console.log("   ⚠️  Mật khẩu Superadmin không được để trống.");
      if (superadminPass.length < 6) {
        console.log("   ⚠️  Mật khẩu Superadmin nên có ít nhất 6 ký tự.");
      }
    }

    prompt.close();

    // 4. Kiểm tra kết nối DB qua tunnel
    console.log("\n🔄 Đang kiểm tra kết nối tới database...");
    const encodedUser = encodeURIComponent(dbUser);
    const encodedPass = encodeURIComponent(dbPass);
    const tunnelDbUrl = `postgresql://${encodedUser}:${encodedPass}@127.0.0.1:${localPort}/${dbName}`;

    const testPool = new Pool({ connectionString: tunnelDbUrl });
    try {
      const res = await testPool.query("SELECT current_database(), current_user, version();");
      console.log(`✅ Kết nối thành công tới [${res.rows[0].current_database}] với user [${res.rows[0].current_user}]`);
    } catch (err: any) {
      throw new Error(`Không thể kết nối vào database [${dbName}] qua tunnel: ${err.message}`);
    } finally {
      await testPool.end();
    }

    // 5. Chạy Prisma Migrate Deploy
    console.log("\n📦 Đang chạy Prisma Migrate Deploy để tạo bảng và cấu trúc schema...");
    const migrateProc = spawn("bunx", ["prisma", "migrate", "deploy"], {
      env: { ...process.env, DATABASE_URL: tunnelDbUrl },
      stdio: "inherit",
    });

    await new Promise<void>((resolve, reject) => {
      migrateProc.on("exit", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Prisma migrate deploy thất bại với mã thoát: ${code}`));
      });
      migrateProc.on("error", reject);
    });

    console.log("✅ Toàn bộ Migration đã được áp dụng thành công!");

    // 6. Seed Superadmin
    console.log("\n👑 Đang khởi tạo tài khoản Superadmin...");
    const pool = new Pool({ connectionString: tunnelDbUrl });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    const hashedPassword = await bcrypt.hash(superadminPass, 10);
    const createdUser = await prisma.user.upsert({
      where: { username: superadminUser },
      update: {
        fullName: superadminName,
        role: UserRole.SUPER_ADMIN,
        status: true,
        unit: "Ban Quản trị",
        password: hashedPassword,
      },
      create: {
        username: superadminUser,
        fullName: superadminName,
        role: UserRole.SUPER_ADMIN,
        password: hashedPassword,
        status: true,
        unit: "Ban Quản trị",
      },
    });

    await prisma.$disconnect();
    await pool.end();

    console.log("\n========================================================");
    console.log(" 🎉 KHỞI TẠO HOÀN TẤT THÀNH CÔNG!");
    console.log("========================================================");
    console.log(`- Database:            ${dbName}`);
    console.log(`- Superadmin Username: ${createdUser.username}`);
    console.log(`- Superadmin FullName: ${createdUser.fullName}`);
    console.log(`- Superadmin Role:     ${createdUser.role}`);
    console.log("\n💡 Cấu hình .env khi muốn kết nối local qua SSH Tunnel:");
    console.log(`DATABASE_URL="${tunnelDbUrl}"\n`);
  } catch (error: any) {
    console.error("\n❌ LỖI:", error.message || error);
    process.exitCode = 1;
  } finally {
    // Nếu script tự mở tunnel mới và tiến trình kết thúc, giữ hoặc đóng
    if (tunnelProc && !tunnelProc.killed) {
      tunnelProc.kill();
      console.log("🔒 Đã đóng SSH tunnel tạm thời.");
    }
  }

  function promptSecret(q: string) {
    return prompt.questionSecret(q);
  }
}

main();
