import { useQuery } from '@tanstack/react-query'

import { apiJson } from '@/lib/api/client'
import type { AuditLogDto, UserDto } from '@/lib/api/types'
import { queryKeys } from '@/src/lib/query-keys'

export type AuditLogWithUser = AuditLogDto & {
  user: UserDto
}

interface UseAuditParams {
  query?: string
  action?: string
  userId?: string
  target?: string
  ip?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
}

function getAuditQueryString(params: UseAuditParams) {
  const queryString = new URLSearchParams()
  if (params.query) queryString.set('q', params.query)
  if (params.action && params.action !== 'ALL') queryString.set('action', params.action)
  if (params.userId && params.userId !== 'ALL') queryString.set('userId', params.userId)
  if (params.target) queryString.set('target', params.target)
  if (params.ip) queryString.set('ip', params.ip)
  if (params.from) queryString.set('from', params.from)
  if (params.to) queryString.set('to', params.to)
  if (params.limit) queryString.set('limit', params.limit.toString())
  if (params.offset) queryString.set('offset', params.offset.toString())
  return queryString.toString()
}

export function useAudit(params: UseAuditParams) {
  const queryString = getAuditQueryString(params)
  const query = useQuery({
    queryKey: queryKeys.audit.list(queryString),
    queryFn: () => apiJson<{ logs: AuditLogWithUser[]; total: number }>(`/api/audit?${queryString}`),
  })

  return {
    logs: query.data?.logs || [],
    total: query.data?.total || 0,
    isLoading: query.isLoading,
    isError: query.error,
    mutate: query.refetch,
  }
}
