import { db } from '@/lib/db'

/**
 * Vietnamese text can be typed/pasted as NFC or NFD (visually identical,
 * different bytes). All data at rest is guaranteed NFC by the write-time
 * normalization in server/lib/db.ts (Prisma $extends hook) plus the one-off
 * migration that cleaned up pre-existing rows, so these queries only need to
 * normalize the untrusted search term — not the stored column too. Wrapping
 * the column in normalize() as well would work but forces a per-row function
 * call that defeats any index on it, so it's intentionally left off here.
 */
export function normalizeNFC(text: string): string {
  return text.normalize('NFC')
}

function likePattern(term: string): string {
  return `%${normalizeNFC(term)}%`
}

export async function findFileIdsMatchingParty(term: string): Promise<string[]> {
  const pattern = likePattern(term)
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM "File"
    WHERE EXISTS (SELECT 1 FROM unnest(defendants) AS x WHERE x ILIKE ${pattern})
       OR EXISTS (SELECT 1 FROM unnest(plaintiffs) AS x WHERE x ILIKE ${pattern})
       OR EXISTS (SELECT 1 FROM unnest("civilDefendants") AS x WHERE x ILIKE ${pattern})
  `
  return rows.map((r) => r.id)
}

export async function findFileIdsMatchingText(term: string): Promise<string[]> {
  const pattern = likePattern(term)
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM "File"
    WHERE code ILIKE ${pattern}
       OR title ILIKE ${pattern}
       OR "judgmentNumber" ILIKE ${pattern}
       OR "indexCode" ILIKE ${pattern}
       OR EXISTS (SELECT 1 FROM unnest(defendants) AS x WHERE x ILIKE ${pattern})
       OR EXISTS (SELECT 1 FROM unnest(plaintiffs) AS x WHERE x ILIKE ${pattern})
       OR EXISTS (SELECT 1 FROM unnest("civilDefendants") AS x WHERE x ILIKE ${pattern})
  `
  return rows.map((r) => r.id)
}

export async function findUserIdsByFullName(term: string): Promise<string[]> {
  const pattern = likePattern(term)
  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM "user" WHERE "fullName" ILIKE ${pattern}
  `
  return rows.map((r) => r.id)
}
