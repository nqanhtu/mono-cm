import { useMutation, useQuery } from '@tanstack/react-query'

import { apiFetch, apiJson } from '@/lib/api/client'
import type { AgencyHistoryDto, StorageBoxDto } from '@/lib/api/types'
import { queryClient } from '@/src/lib/query-client'
import { queryKeys } from '@/src/lib/query-keys'

export type StorageBoxesParams = {
  search?: string
  year?: string
  warehouse?: string
  line?: string
  shelf?: string
}

export type StorageBoxPayload = {
  warehouse: string
  line: string
  shelf: string
  slot: string
  boxNumber: string
  code: string
  agencyId?: string | null
  caseType?: string | null
  year?: number | null
  fromFileCode?: string | null
  toFileCode?: string | null
  retention?: string | null
  autoGenerateCode?: boolean
}

function getStorageBoxesQueryString(params: StorageBoxesParams) {
  const queryString = new URLSearchParams()
  if (params.search) queryString.set('search', params.search)
  if (params.year) queryString.set('year', params.year)
  if (params.warehouse) queryString.set('warehouse', params.warehouse)
  if (params.line) queryString.set('line', params.line)
  if (params.shelf) queryString.set('shelf', params.shelf)
  return queryString.toString()
}

function normalizeAgencyResponse(data: unknown): AgencyHistoryDto[] {
  if (Array.isArray(data)) return data as AgencyHistoryDto[]
  if (
    data &&
    typeof data === 'object' &&
    'success' in data &&
    'data' in data &&
    Array.isArray((data as { data?: unknown }).data)
  ) {
    return (data as { data: AgencyHistoryDto[] }).data
  }
  return []
}

function invalidateStorageBoxDomains() {
  queryClient.invalidateQueries({ queryKey: queryKeys.boxes.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.files.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.files.stats })
}

export function useStorageBoxes(params: StorageBoxesParams, enabled = true) {
  const queryString = getStorageBoxesQueryString(params)
  const query = useQuery({
    queryKey: queryKeys.boxes.list(queryString),
    queryFn: async () => {
      const data = await apiJson<unknown>(`/api/admin/boxes?${queryString}`)
      return Array.isArray(data) ? (data as StorageBoxDto[]) : []
    },
    enabled,
  })

  return {
    boxes: query.data || [],
    isLoading: query.isLoading,
    isError: query.error,
    mutate: query.refetch,
  }
}

export function useAgencies(enabled = true) {
  const query = useQuery({
    queryKey: queryKeys.agencies.list,
    queryFn: async () => normalizeAgencyResponse(await apiJson<unknown>('/api/admin/agency')),
    enabled,
  })

  return {
    agencies: query.data || [],
    isLoading: query.isLoading,
    isError: query.error,
  }
}

export function useCreateStorageBox() {
  return useMutation({
    mutationFn: (payload: StorageBoxPayload) =>
      apiJson<StorageBoxDto>('/api/admin/boxes', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: invalidateStorageBoxDomains,
  })
}

export function useUpdateStorageBox() {
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: StorageBoxPayload }) =>
      apiJson<StorageBoxDto>(`/api/admin/boxes/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: invalidateStorageBoxDomains,
  })
}

export function useDeleteStorageBox() {
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiFetch(`/api/admin/boxes/${id}`, { method: 'DELETE' })
      const result = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(result?.error || result?.message || 'Không thể xoá hộp lưu trữ')
      }
      return result
    },
    onSuccess: invalidateStorageBoxDomains,
  })
}
