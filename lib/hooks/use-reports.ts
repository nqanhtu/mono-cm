import { useQuery } from '@tanstack/react-query'

import { apiJson } from '@/lib/api/client'
import type {
  BorrowItemDto,
  BorrowSlipDto,
  CaseDrilldownResponse,
  CaseMatrixResponse,
  FileDto,
  UserContributionsResponse,
} from '@/lib/api/types'
import { queryKeys } from '@/src/lib/query-keys'

type RecentBorrowSlip = BorrowSlipDto & {
  items: (BorrowItemDto & {
    file: FileDto
  })[]
}

interface ReportStats {
  totalBorrows: number
  activeBorrows: number
  overdueBorrows: number
  returnedRate: number
  recentBorrows: RecentBorrowSlip[]
}

const emptyStats: ReportStats = {
  totalBorrows: 0,
  activeBorrows: 0,
  overdueBorrows: 0,
  returnedRate: 0,
  recentBorrows: [],
}

export function useReportStats() {
  const query = useQuery({
    queryKey: queryKeys.reports.stats,
    queryFn: () => apiJson<ReportStats>('/api/reports/stats'),
  })

  return {
    stats: query.data || emptyStats,
    isLoading: query.isLoading,
    isError: query.error,
  }
}

export function useUserContributions(params: { userId?: string; from?: string; to?: string }) {
  // build query string
  const searchParams = new URLSearchParams()
  if (params.userId) searchParams.append('userId', params.userId)
  if (params.from) searchParams.append('from', params.from)
  if (params.to) searchParams.append('to', params.to)

  const query = useQuery({
    queryKey: queryKeys.reports.contributions(params),
    queryFn: () => apiJson<UserContributionsResponse>(`/api/reports/contributions?${searchParams.toString()}`),
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.error,
    refetch: query.refetch,
  }
}

export function useCaseMatrix(params: { fromYear?: number; toYear?: number; type?: string }) {
  const searchParams = new URLSearchParams()
  if (params.fromYear) searchParams.append('fromYear', String(params.fromYear))
  if (params.toYear) searchParams.append('toYear', String(params.toYear))
  if (params.type) searchParams.append('type', params.type)

  const query = useQuery({
    queryKey: queryKeys.reports.caseMatrix(params),
    queryFn: () => apiJson<CaseMatrixResponse>(`/api/reports/cases-matrix?${searchParams.toString()}`),
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.error,
    refetch: query.refetch,
  }
}

export function useCaseDrilldown(params: { year?: number | null; type?: string | null; enabled?: boolean }) {
  const searchParams = new URLSearchParams()
  if (params.year) searchParams.append('year', String(params.year))
  if (params.type) searchParams.append('type', params.type)

  const query = useQuery({
    queryKey: queryKeys.reports.caseDrilldown({ year: params.year || undefined, type: params.type || undefined }),
    queryFn: () => apiJson<CaseDrilldownResponse>(`/api/reports/cases-matrix/drilldown?${searchParams.toString()}`),
    enabled: Boolean(params.enabled && params.year && params.type),
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.error,
  }
}
