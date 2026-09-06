import "dotenv/config";
import readline from "node:readline";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ Lỗi: Biến môi trường DATABASE_URL chưa được cấu hình.");
  process.exit(1);
}

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
            stdin.removeListener("data", onData);
            if (stdin.setRawMode) stdin.setRawMode(wasRaw);
            process.stdout.write("\n");
            resolve(secret);
            return;
          } else if (c === "\u0003") {
            process.stdout.write("\n");
            process.exit(1);
          } else if (c === "\b" || c === "\x7f") {
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

async function main() {
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 10000 });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const args = process.argv.slice(2);
    let username = args[0];
    let newPassword = args[1];

    if (!username || !newPassword) {
      console.log("\n========================================================");
      console.log(" 🔑 ĐỔI MẬT KHẨU TÀI KHOẢN HỆ THỐNG");
      console.log("========================================================\n");

      const prompt = createPrompt();
      if (!username) {
        username = await prompt.question("Nhập Username cần đổi mật khẩu", "superadmin");
      }

      while (!newPassword) {
        newPassword = await prompt.questionSecret("Nhập Mật khẩu mới");
        if (!newPassword) {
          console.log("   ⚠️ Mật khẩu không được để trống.");
        } else if (newPassword.length < 6) {
          console.log("   ⚠️ Mật khẩu nên có ít nhất 6 ký tự.");
        }
      }
      prompt.close();
    }

    // Kiểm tra user có tồn tại không
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      console.error(`\n❌ Không tìm thấy người dùng với username: "${username}"`);
      process.exitCode = 1;
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const updatedUser = await prisma.user.update({
      where: { username },
      data: {
        password: hashedPassword,
      },
    });

    console.log("\n✅ Đổi mật khẩu thành công!");
    console.log(`   - Username : ${updatedUser.username}`);
    console.log(`   - Họ tên   : ${updatedUser.fullName}`);
    console.log(`   - Vai trò  : ${updatedUser.role}`);
    console.log("   - Trạng thái: Mật khẩu mới đã được cập nhật vào database.\n");
  } catch (error: any) {
    console.error("\n❌ Lỗi khi đổi mật khẩu:", error.message || error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
