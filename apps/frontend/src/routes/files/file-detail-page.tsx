'use client'

import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { FileDetailContent } from '@/components/files/file-detail-content'
import { useParams } from '@/src/lib/router'

export default function FileDetailPage() {
    const params = useParams()
    const id = params.id as string

    return (
        <div className="flex flex-col h-full space-y-4 w-full">
            <div className="shrink-0">
                <Button variant="ghost" asChild>
                    <Link to="/">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Quay lại
                    </Link>
                </Button>
            </div>

            <FileDetailContent id={id} />
        </div>
    )
}
