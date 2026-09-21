import type { Prisma } from '@/generated/prisma/client'
import { findFileIdsMatchingParty, findFileIdsMatchingText } from '@/lib/vi-search'

export type FileListQuery = {
  q?: string
  type?: string
  year?: string | number
  status?: string
  judgmentNumber?: string
  party?: string
  warehouse?: string
  line?: string
  shelf?: string
  slot?: string
  hasBox?: string
  createdById?: string
}

export type FileListSession = { id?: string; role?: string } | null | undefined

const viCollator = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' })

export function compareVi(a: string, b: string): number {
  return viCollator.compare(a, b)
}

export async function buildFileWhere(query: FileListQuery, session: FileListSession): Promise<Prisma.FileWhereInput> {
  const q = query.q || undefined
  const type = query.type || undefined
  const year = query.year ? Number.parseInt(String(query.year), 10) : undefined
  const status = query.status || undefined
  const judgmentNumber = query.judgmentNumber || undefined
  const party = query.party || undefined
  const warehouse = query.warehouse || undefined
  const line = query.line || undefined
  const shelf = query.shelf || undefined
  const slot = query.slot || undefined
  const hasBox = query.hasBox || undefined

  let filterCreatedById: string | undefined = undefined
  if (session?.role === 'COORDINATOR') {
    filterCreatedById = session.id
  } else if (query.createdById) {
    filterCreatedById = String(query.createdById)
  }

  let partyFileIds: string[] | undefined = undefined
  if (party) {
    try {
      partyFileIds = await findFileIdsMatchingParty(party)
    } catch (err) {
      console.error('Error querying party with raw SQL:', err)
    }
  }

  let qFileIds: string[] | undefined = undefined
  if (q) {
    try {
      qFileIds = await findFileIdsMatchingText(q)
    } catch (err) {
      console.error('Error querying q with raw SQL:', err)
    }
  }

  return {
    AND: [
      q ? (
        qFileIds !== undefined
          ? { id: { in: qFileIds } }
          : {
              OR: [
                { code: { contains: q, mode: 'insensitive' } },
                { title: { contains: q, mode: 'insensitive' } },
                { judgmentNumber: { contains: q, mode: 'insensitive' } },
                { indexCode: { contains: q, mode: 'insensitive' } },
                { defendants: { has: q } },
                { plaintiffs: { has: q } },
                { civilDefendants: { has: q } },
              ],
            }
      ) : {},
      type && type !== 'all' ? { type: { equals: type } } : {},
      year ? { year: { equals: year } } : {},
      status && status !== 'all' ? { status: { equals: status } } : { NOT: { status: 'ARCHIVED' } },
      hasBox === 'false' ? { boxId: null } : {},
      hasBox === 'true' ? { boxId: { not: null } } : {},
      judgmentNumber ? { judgmentNumber: { contains: judgmentNumber, mode: 'insensitive' } } : {},
      party ? (
        partyFileIds !== undefined
          ? { id: { in: partyFileIds } }
          : { OR: [{ defendants: { has: party } }, { plaintiffs: { has: party } }, { civilDefendants: { has: party } }] }
      ) : {},
      warehouse || line || shelf || slot ? {
        box: {
          is: {
            ...(warehouse ? { warehouse: { contains: warehouse, mode: 'insensitive' as const } } : {}),
            ...(line ? { line: { contains: line, mode: 'insensitive' as const } } : {}),
            ...(shelf ? { shelf: { contains: shelf, mode: 'insensitive' as const } } : {}),
            ...(slot ? { slot: { contains: slot, mode: 'insensitive' as const } } : {}),
          },
        },
      } : {},
      filterCreatedById ? {
        createdById: {
          in: filterCreatedById === 'none' ? [] : filterCreatedById.split(','),
        },
      } : {},
    ],
  }
}
