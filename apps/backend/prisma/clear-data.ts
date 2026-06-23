import 'dotenv/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'

const connectionString = process.env.DATABASE_URL
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })
async function main() {
  console.log('Bắt đầu xoá dữ liệu...')

  try {
    // Xoá dữ liệu theo thứ tự từ bảng con đến bảng cha để tránh lỗi khoá ngoại (Foreign Key)
    await prisma.$transaction([
      prisma.auditLog.deleteMany(),
      prisma.borrowSlipEvent.deleteMany(),
      prisma.borrowItem.deleteMany(),
      prisma.borrowSlip.deleteMany(),
      prisma.document.deleteMany(),
      prisma.fileIndex.deleteMany(),
      prisma.file.deleteMany(),
      prisma.storageBoxLabel.deleteMany(),
      prisma.storageBox.deleteMany(),
      prisma.agencyHistory.deleteMany(),
      // Không xoá bảng User
    ])

    console.log('✅ Đã xoá toàn bộ dữ liệu thành công (ngoại trừ bảng User).')
  } catch (error) {
    console.error('❌ Lỗi khi xoá dữ liệu:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
