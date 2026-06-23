import { useQuery } from '@tanstack/react-query'

import { apiJson } from '@/lib/api/client'
import type { UserAccessEvent, UserAccessLogDto, UserAccessLogSummaryDto } from '@/lib/api/types'
import { queryKeys } from '@/src/lib/query-keys'

interface UseAccessLogsParams {
  query?: string
  userId?: string
  event?: string
  from?: string
  to?: string
  deviceType?: string
  browserName?: string
  osName?: string
  limit?: number
  offset?: number
}

type AccessLogsResponse = {
  logs: UserAccessLogDto[]
  total: number
  summary: UserAccessLogSummaryDto
}

const emptySummary: UserAccessLogSummaryDto = {
  totalLogins: 0,
  totalLogouts: 0,
  activeUsers: 0,
  lastAccessAt: null,
}

function getAccessLogQueryString(params: UseAccessLogsParams) {
  const queryString = new URLSearchParams()
  if (params.query) queryString.set('q', params.query)
  if (params.userId && params.userId !== 'ALL') queryString.set('userId', params.userId)
  if (params.event && params.event !== 'ALL') queryString.set('event', params.event as UserAccessEvent)
  if (params.from) queryString.set('from', params.from)
  if (params.to) queryString.set('to', params.to)
  if (params.deviceType) queryString.set('deviceType', params.deviceType)
  if (params.browserName) queryString.set('browserName', params.browserName)
  if (params.osName) queryString.set('osName', params.osName)
  if (params.limit) queryString.set('limit', params.limit.toString())
  if (params.offset) queryString.set('offset', params.offset.toString())
  return queryString.toString()
}

export function useAccessLogs(params: UseAccessLogsParams) {
  const queryString = getAccessLogQueryString(params)
  const query = useQuery({
    queryKey: queryKeys.audit.accessLogs(queryString),
    queryFn: () => apiJson<AccessLogsResponse>(`/api/admin/access-logs?${queryString}`),
  })

  return {
    logs: query.data?.logs || [],
    total: query.data?.total || 0,
    summary: query.data?.summary || emptySummary,
    isLoading: query.isLoading,
    isError: query.error,
    mutate: query.refetch,
  }
}
