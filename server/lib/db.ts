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

const DATA_WRITE_OPERATIONS = new Set(['create', 'update', 'createMany', 'updateMany'])

/**
 * Vietnamese text can be typed/pasted/imported as NFC or NFD (visually
 * identical, different bytes). Normalizing every string to NFC at this
 * single write choke point guarantees data at rest stays consistent, so
 * search code only has to normalize the (untrusted) search term rather
 * than every stored column too. See server/lib/vi-search.ts.
 */
function normalizeNFCDeep(value: unknown): unknown {
  if (typeof value === 'string') return value.normalize('NFC')
  if (value instanceof Date || value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(normalizeNFCDeep)
  const out: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    out[key] = normalizeNFCDeep(val)
  }
  return out
}

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({ adapter })
  return client.$extends({
    query: {
      $allModels: {
        $allOperations({ operation, args, query }) {
          let nextArgs: unknown = args
          if (operation === 'upsert' && args && typeof args === 'object') {
            const upsertArgs = args as { create?: unknown; update?: unknown }
            nextArgs = {
              ...args,
              ...(upsertArgs.create !== undefined ? { create: normalizeNFCDeep(upsertArgs.create) } : {}),
              ...(upsertArgs.update !== undefined ? { update: normalizeNFCDeep(upsertArgs.update) } : {}),
            }
          } else if (DATA_WRITE_OPERATIONS.has(operation) && args && typeof args === 'object' && 'data' in args) {
            nextArgs = { ...args, data: normalizeNFCDeep((args as { data: unknown }).data) }
          }
          return query(nextArgs as typeof args)
        },
      },
    },
  }) as unknown as PrismaClient
}

const defaultDb = globalForPrisma.prisma || createPrismaClient()

export let db: PrismaClient = defaultDb

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

export function setDbForTesting(testDb: unknown) {
  db = testDb as PrismaClient
}

export function resetDbForTesting() {
  db = defaultDb
}
