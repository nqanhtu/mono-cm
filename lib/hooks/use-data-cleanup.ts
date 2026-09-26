import { useMutation, useQuery } from '@tanstack/react-query'

import { apiJson } from '@/lib/api/client'
import type { BlankCaseTypeRecords, CaseTypeGroups } from '@/lib/data-cleanup/case-types'
import type { MismatchedBoxesResponse } from '@/lib/data-cleanup/mismatched-boxes'
import { queryClient } from '@/src/lib/query-client'
import { queryKeys } from '@/src/lib/query-keys'

function invalidateCaseTypeDomains() {
  queryClient.invalidateQueries({ queryKey: queryKeys.dataCleanup.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.boxes.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.files.all })
}

export function useCaseTypeGroups() {
  return useQuery({
    queryKey: queryKeys.dataCleanup.caseTypes,
    queryFn: () => apiJson<CaseTypeGroups>('/api/admin/data-cleanup/case-types'),
  })
}

export function useBlankCaseTypeRecords(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.dataCleanup.blankCaseTypes,
    queryFn: () => apiJson<BlankCaseTypeRecords>('/api/admin/data-cleanup/case-types/blank'),
    enabled,
  })
}

export function useMismatchedBoxes() {
  return useQuery({
    queryKey: queryKeys.dataCleanup.mismatchedBoxes,
    queryFn: () => apiJson<MismatchedBoxesResponse>('/api/admin/data-cleanup/mismatched-boxes'),
  })
}

export function useRenameCaseType() {
  return useMutation({
    mutationFn: (payload: { from: string; to: string }) =>
      apiJson<{ boxesUpdated: number; filesUpdated: number }>('/api/admin/data-cleanup/case-types/rename', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: invalidateCaseTypeDomains,
  })
}

export function useFillCaseType() {
  return useMutation({
    mutationFn: (payload: { kind: 'box' | 'file'; id: string; value: string }) =>
      apiJson<{ ok: true }>('/api/admin/data-cleanup/case-types/fill', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: invalidateCaseTypeDomains,
  })
}
