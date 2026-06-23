'use client'

import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRouter, useSearchParams } from '@/src/lib/router'

interface PaginationControlsProps {
    hasNextPage: boolean
    hasPrevPage: boolean
    totalPages: number
    currentPage: number
}

export function PaginationControls({
    hasNextPage,
    hasPrevPage,
    totalPages,
    currentPage,
}: PaginationControlsProps) {
    const router = useRouter()
    const searchParams = useSearchParams()

    const handlePageChange = (page: number) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('page', page.toString())
        router.push(`/?${params.toString()}`)
    }

    return (
        <div className="flex items-center justify-center gap-2 mt-4">
            <Button
                variant="outline"
                size="sm"
                disabled={!hasPrevPage}
                onClick={() => handlePageChange(currentPage - 1)}
            >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Trước
            </Button>

            <div className="text-sm font-medium">
                Trang {currentPage} / {totalPages}
            </div>

            <Button
                variant="outline"
                size="sm"
                disabled={!hasNextPage}
                onClick={() => handlePageChange(currentPage + 1)}
            >
                Sau
                <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
        </div>
    )
}
