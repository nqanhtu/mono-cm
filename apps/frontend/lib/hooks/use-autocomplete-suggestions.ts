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
      types: (rawSuggestions.types || []).map(t => {
        if (t === 'Hình sự') return 'Hình sự sơ thẩm'
        if (t === 'Dân sự') return 'Dân sự sơ thẩm'
        return t
      })
    }
  }, [rawSuggestions])

  return {
    suggestions,
    isLoading: query.isLoading,
    isError: query.error,
  }
}
