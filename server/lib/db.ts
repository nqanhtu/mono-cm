import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/generated/prisma/client'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is not defined in environment variables')
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)

const defaultDb =
  globalForPrisma.prisma ||
  new PrismaClient({ adapter })

export let db: PrismaClient = defaultDb

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

export function setDbForTesting(testDb: unknown) {
  db = testDb as PrismaClient
}

export function resetDbForTesting() {
  db = defaultDb
}
