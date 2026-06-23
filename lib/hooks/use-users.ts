import { useQuery } from '@tanstack/react-query'

import { apiJson } from '@/lib/api/client'
import type { UserDto } from '@/lib/api/types'
import { queryKeys } from '@/src/lib/query-keys'

export function useUsers() {
  const query = useQuery({
    queryKey: queryKeys.users.list(),
    queryFn: () => apiJson<UserDto[]>('/api/users'),
  })

  return {
    users: query.data || [],
    isLoading: query.isLoading,
    isError: query.error,
    mutate: query.refetch,
  }
}
