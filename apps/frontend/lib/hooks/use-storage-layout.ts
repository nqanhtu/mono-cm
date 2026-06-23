import { useMutation, useQuery } from "@tanstack/react-query";

import { apiJson } from "@/lib/api/client";
import type { StorageLayoutData, StorageLayoutOccupancyResponse, StorageLayoutSearch } from "@/lib/storage-layout/types";
import { queryClient } from "@/src/lib/query-client";
import { queryKeys } from "@/src/lib/query-keys";

export function useStorageLayout(enabled = true) {
  const query = useQuery({
    queryKey: queryKeys.boxes.layout,
    queryFn: () => apiJson<StorageLayoutData | null>("/api/admin/storage-layout"),
    enabled,
  });

  return {
    layout: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.error,
  };
}

export function useSaveStorageLayout() {
  return useMutation({
    mutationFn: (layout: StorageLayoutData) =>
      apiJson<StorageLayoutData>("/api/admin/storage-layout", {
        method: "PUT",
        body: JSON.stringify(layout),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.boxes.layout });
    },
  });
}

export type StorageLayoutOccupancyParams = {
  search?: string;
  year?: string;
} & Partial<StorageLayoutSearch>;

function getOccupancyQueryString(params: StorageLayoutOccupancyParams) {
  const queryString = new URLSearchParams();
  if (params.search) queryString.set("search", params.search);
  if (params.year) queryString.set("year", params.year);
  if (params.code) queryString.set("code", params.code);
  if (params.fond) queryString.set("fond", params.fond);
  if (params.caseType) queryString.set("caseType", params.caseType);
  if (params.documentNumber) queryString.set("documentNumber", params.documentNumber);
  return queryString.toString();
}

export function useStorageLayoutOccupancy(params: StorageLayoutOccupancyParams, enabled = true) {
  const queryString = getOccupancyQueryString(params);
  const query = useQuery({
    queryKey: queryKeys.boxes.layoutOccupancy(queryString),
    queryFn: () => apiJson<StorageLayoutOccupancyResponse>(`/api/admin/storage-layout/occupancy?${queryString}`),
    enabled,
  });

  return {
    occupancy: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.error,
    refetch: query.refetch,
  };
}
