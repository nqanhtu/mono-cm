'use client'

import { useSearchParams, useRouter } from '@/src/lib/router'
import { useFiles } from '@/lib/hooks/use-files'
import { FileTable } from '@/components/files/file-table'
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
        offset: (page - 1) * limit
    })

    const queryClient = useQueryClient()
    const { session } = useSession()
    const canCreateFiles = can(session?.role, 'createFiles')
    const canManageFiles = can(session?.role, 'manageFiles')
    const canManageBorrow = can(session?.role, 'manageBorrow')

    const router = useRouter()

    const handlePaginationChange = (newPage: number, newPageSize: number) => {
        const params = new URLSearchParams(searchParams)
        params.set('page', newPage.toString())
        params.set('limit', newPageSize.toString())
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
                onRefresh={() => {
                    mutate();
                    queryClient.invalidateQueries({ queryKey: queryKeys.files.stats });
                }}
            />
        </div>
    )
}
