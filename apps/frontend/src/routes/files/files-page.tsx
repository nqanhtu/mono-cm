'use client'

import { useEffect } from 'react'

import { OverviewStats } from '@/components/overview-stats'
import { FileListSection } from '@/components/files/file-list-section'
import { DataPageShell } from '@/components/common/data-page-shell'
import { useSearchParams, useRouter } from '@/src/lib/router'

export default function Home() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const createParam = searchParams.get('create')

  useEffect(() => {
    if (createParam === 'true') {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('create')
      router.replace(`/upload?mode=manual-entry&${params.toString()}`)
    }
  }, [createParam, searchParams, router])

  return (
    <DataPageShell
      header={
        <div className="space-y-3 md:space-y-4">
          <OverviewStats />
        </div>
      }
    >
      <FileListSection onCreate={() => router.push('/upload?mode=manual-entry')} />
    </DataPageShell>
  )
}
