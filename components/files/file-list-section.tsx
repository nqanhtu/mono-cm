'use client'

import * as React from 'react'
import { useSearchParams, useRouter } from '@/src/lib/router'
import { useFiles } from '@/lib/hooks/use-files'
import { FileTable } from '@/components/files/file-table'
import type { SortingState } from '@tanstack/react-table'
import { useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/lib/hooks/use-auth'
import { can } from '@/lib/rbac'
import { queryKeys } from '@/src/lib/query-keys'

interface FileListSectionProps {
    onCreate?: () => void
}

export function FileListSection({ onCreate }: FileListSectionProps) {
    const searchParams = useSearchParams()
    const q = searchParams.get('q') || undefined
    const type = searchParams.get('type') || undefined
    const status = searchParams.get('status') || undefined
    const judgmentNumber = searchParams.get('judgmentNumber') || undefined
    const party = searchParams.get('party') || undefined
    const warehouse = searchParams.get('warehouse') || undefined
    const line = searchParams.get('line') || undefined
    const shelf = searchParams.get('shelf') || undefined
    const slot = searchParams.get('slot') || undefined
    const createdById = searchParams.get('createdById') || undefined
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const sortField = searchParams.get('sortField') || undefined
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || undefined

    const { files, total, isLoading, mutate } = useFiles({
        query: q,
        type,
        status,
        judgmentNumber,
        party,
        warehouse,
        line,
        shelf,
        slot,
        createdById,
        limit,
        offset: (page - 1) * limit,
        sortField,
        sortOrder,
    })

    const queryClient = useQueryClient()
    const { session } = useSession()
    const canCreateFiles = can(session?.role, 'createFiles')
    const canManageFiles = can(session?.role, 'manageFiles')
    const canManageBorrow = can(session?.role, 'manageBorrow')

    const router = useRouter()

    const activeSorting = React.useMemo<SortingState>(() => {
        if (sortField && sortOrder) {
            return [{ id: sortField, desc: sortOrder === 'desc' }]
        }
        return []
    }, [sortField, sortOrder])

    const handlePaginationChange = (newPage: number, newPageSize: number) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('page', newPage.toString())
        params.set('limit', newPageSize.toString())
        router.replace(`/?${params.toString()}`)
    }

    const handleSortingChange = (sortingState: SortingState) => {
        const params = new URLSearchParams(searchParams.toString())
        if (sortingState.length > 0) {
            params.set('sortField', sortingState[0].id)
            params.set('sortOrder', sortingState[0].desc ? 'desc' : 'asc')
        } else {
            params.delete('sortField')
            params.delete('sortOrder')
        }
        params.set('page', '1') // Reset to page 1 on sorting change
        router.replace(`/?${params.toString()}`)
    }

    return (
        <div>
            <FileTable
                files={files}
                isLoading={isLoading}
                role={session?.role}
                onCreate={canCreateFiles ? onCreate : undefined}
                canManageFiles={canManageFiles}
                canBorrow={canManageBorrow}
                total={total}
                page={page}
                pageSize={limit}
                onPaginationChange={handlePaginationChange}
                sorting={activeSorting}
                onSortingChange={handleSortingChange}
                onRefresh={() => {
                    mutate();
                    queryClient.invalidateQueries({ queryKey: queryKeys.files.stats });
                }}
            />
        </div>
    )
}
