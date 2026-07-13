import "dotenv/config";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { UserRole } from "../generated/prisma/enums";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Bắt đầu khởi tạo tài khoản superadmin...");

  const password = process.env.SUPERADMIN_PASSWORD;
  if (!password) {
    throw new Error("SUPERADMIN_PASSWORD is required");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const superadmin = await prisma.user.upsert({
    where: { username: "superadmin" },
    update: {
      fullName: "Quản trị hệ thống",
      role: UserRole.SUPER_ADMIN,
      status: true,
      unit: "Ban Quản trị",
      password: hashedPassword,
    },
    create: {
      username: "superadmin",
      fullName: "Quản trị hệ thống",
      role: UserRole.SUPER_ADMIN,
      password: hashedPassword,
      status: true,
      unit: "Ban Quản trị",
    },
  });

  console.log("✅ Khởi tạo tài khoản superadmin thành công:");
  console.log(`   Username: ${superadmin.username}`);
}

main()
  .catch((error) => {
    console.error("❌ Lỗi khi khởi tạo superadmin:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
