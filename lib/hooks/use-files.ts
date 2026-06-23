import { useQuery } from '@tanstack/react-query'

import { apiJson } from '@/lib/api/client'
import type { FileDto } from '@/lib/api/types'
import { queryKeys } from '@/src/lib/query-keys'

export interface SearchParams {
    query?: string
    type?: string
    year?: number
    status?: string
    judgmentNumber?: string
    party?: string
    warehouse?: string
    line?: string
    shelf?: string
    slot?: string
    limit?: number
    offset?: number
    createdById?: string
}

export function getFilesQueryString(params: SearchParams) {
    const queryString = new URLSearchParams()
    if (params.query) queryString.set('q', params.query)
    if (params.type && params.type !== 'all') queryString.set('type', params.type)
    if (params.year) queryString.set('year', params.year.toString())
    if (params.status && params.status !== 'all') queryString.set('status', params.status)
    if (params.judgmentNumber) queryString.set('judgmentNumber', params.judgmentNumber)
    if (params.party) queryString.set('party', params.party)
    if (params.warehouse) queryString.set('warehouse', params.warehouse)
    if (params.line) queryString.set('line', params.line)
    if (params.shelf) queryString.set('shelf', params.shelf)
    if (params.slot) queryString.set('slot', params.slot)
    if (params.createdById && params.createdById !== 'all') queryString.set('createdById', params.createdById)
    if (params.limit) queryString.set('limit', params.limit.toString())
    if (params.offset) queryString.set('offset', params.offset.toString())
    return queryString.toString()
}

export function useFiles(params: SearchParams) {
    const queryString = getFilesQueryString(params)
    const query = useQuery({
        queryKey: queryKeys.files.list(queryString),
        queryFn: () => apiJson<{ files: FileDto[]; total: number }>(`/api/files?${queryString}`),
    })

    return {
        files: query.data?.files || [],
        total: query.data?.total || 0,
        isLoading: query.isLoading,
        isError: query.error,
        mutate: query.refetch,
    }
}

export function useFile(id: string) {
    const query = useQuery({
        queryKey: queryKeys.files.detail(id),
        queryFn: () => apiJson<FileDto>(`/api/files/${id}`),
        enabled: Boolean(id),
    })

    return {
        file: query.data,
        isLoading: query.isLoading,
        isError: query.error,
        mutate: query.refetch,
    }
}

export function useFileStats() {
    const query = useQuery({
        queryKey: queryKeys.files.stats,
        queryFn: () => apiJson<{ total: number; borrowed: number; overdue: number; byType: { type: string; _count: number }[] }>('/api/files/stats'),
    })

    return {
        stats: query.data || { total: 0, borrowed: 0, overdue: 0, byType: [] },
        isLoading: query.isLoading,
        isError: query.error,
    }
}
