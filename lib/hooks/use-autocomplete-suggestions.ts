import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { apiJson } from '@/lib/api/client'
import type { AutocompleteSuggestions } from '@/lib/api/types'
import { queryKeys } from '@/src/lib/query-keys'

export function useAutocompleteSuggestions() {
  const query = useQuery({
    queryKey: queryKeys.files.autocompleteSuggestions,
    queryFn: () => apiJson<AutocompleteSuggestions>('/api/files/autocomplete-suggestions'),
  })

  const rawSuggestions = query.data;

  const suggestions = useMemo(() => {
    if (!rawSuggestions) return { types: [], retentions: [], titles: [], documentTitles: [] }
    return {
      ...rawSuggestions,
      documentTitles: rawSuggestions.documentTitles || [],
      types: Array.from(
        new Set(
          (rawSuggestions.types || [])
            .map((t) => {
              if (!t) return ""
              const trimmed = t.trim()
              if (!trimmed) return ""
              
              // Standardize: Capitalize only the first letter, lowercase the rest
              const normalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase()
              
              return normalized
            })
            .filter(Boolean)
        )
      )
    }
  }, [rawSuggestions])

  return {
    suggestions,
    isLoading: query.isLoading,
    isError: query.error,
  }
}
