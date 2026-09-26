import { Elysia } from 'elysia'

import { sessionOrDenied } from '@/api-routes/_shared'
import { jsonError, type AppSet } from '@/lib/http'
import { getClientIp } from '@/lib/request'
import {
  CaseTypeCleanupError,
  fillBlankCaseType,
  listBlankCaseTypeRecords,
  listCaseTypes,
  listMismatchedBoxes,
  renameCaseType,
} from '@/lib/services/case-type-cleanup'

function handleError(set: AppSet, error: unknown, context: string) {
  if (error instanceof CaseTypeCleanupError) return jsonError(set, error.message, error.status)
  console.error(context, error)
  return jsonError(set, 'Internal Server Error', 500)
}

export const dataCleanupRoutes = new Elysia()
  .get('/api/admin/data-cleanup/case-types', async ({ request, set }) => {
    try {
      const { denied } = await sessionOrDenied({ request, set }, 'manageStorage')
      if (denied) return denied
      return await listCaseTypes()
    } catch (error) {
      return handleError(set, error, 'Error listing case types:')
    }
  })
  .post('/api/admin/data-cleanup/case-types/rename', async ({ request, set }) => {
    try {
      const { denied, session } = await sessionOrDenied({ request, set }, 'manageStorage')
      if (denied) return denied
      const body = (await request.json().catch(() => null)) as { from?: unknown; to?: unknown } | null
      return await renameCaseType({ from: body?.from, to: body?.to }, { userId: session!.id, ipAddress: getClientIp(request) })
    } catch (error) {
      return handleError(set, error, 'Error renaming case type:')
    }
  })
  .get('/api/admin/data-cleanup/case-types/blank', async ({ request, set }) => {
    try {
      const { denied } = await sessionOrDenied({ request, set }, 'manageStorage')
      if (denied) return denied
      return await listBlankCaseTypeRecords()
    } catch (error) {
      return handleError(set, error, 'Error listing blank case types:')
    }
  })
  .post('/api/admin/data-cleanup/case-types/fill', async ({ request, set }) => {
    try {
      const { denied, session } = await sessionOrDenied({ request, set }, 'manageStorage')
      if (denied) return denied
      const body = (await request.json().catch(() => null)) as { kind?: unknown; id?: unknown; value?: unknown } | null
      return await fillBlankCaseType({ kind: body?.kind, id: body?.id, value: body?.value }, { userId: session!.id, ipAddress: getClientIp(request) })
    } catch (error) {
      return handleError(set, error, 'Error filling case type:')
    }
  })
  .get('/api/admin/data-cleanup/mismatched-boxes', async ({ request, set }) => {
    try {
      const { denied } = await sessionOrDenied({ request, set }, 'manageStorage')
      if (denied) return denied
      return await listMismatchedBoxes()
    } catch (error) {
      return handleError(set, error, 'Error listing mismatched boxes:')
    }
  })
