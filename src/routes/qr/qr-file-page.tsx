'use client'

import { useEffect, useState } from 'react'
import type React from 'react'
import { Link } from 'react-router-dom'
import { useParams } from '@/src/lib/router'
import { Loader2, QrCode } from 'lucide-react'

import { apiFetch } from '@/lib/api/client'
import type { FileDto } from '@/lib/api/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/common/status-badge'

export default function QrFilePage() {
  const params = useParams<{ token: string }>()
  const [file, setFile] = useState<FileDto | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function resolveQr() {
      setIsLoading(true)
      try {
        if (!params.token) throw new Error('Thiếu mã QR')
        const response = await apiFetch(`/api/qr/files/${encodeURIComponent(params.token)}`)
        const result = await response.json()
        if (!response.ok || !result.success) throw new Error(result.message || 'QR không hợp lệ')
        setFile(result.file)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không thể mở QR')
      } finally {
        setIsLoading(false)
      }
    }

    if (params.token) resolveQr()
  }, [params.token])

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !file) {
    return (
      <div className="mx-auto flex h-full max-w-lg items-center">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <QrCode className="h-5 w-5" />
              Không thể mở QR
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{error || 'Không tìm thấy hồ sơ.'}</p>
            <Button asChild>
              <Link to="/">Về danh sách hồ sơ</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            Hồ sơ từ QR
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="font-mono text-sm text-muted-foreground">{file.code}</p>
            <h1 className="text-2xl font-bold">{file.title}</h1>
          </div>
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <Info label="Loại án" value={file.type} />
            <Info label="Năm" value={file.year || '-'} />
            <Info label="Trạng thái" value={<StatusBadge status={file.status} />} />
            <Info label="Vị trí" value={file.box ? `${file.box.warehouse}-${file.box.line}-${file.box.shelf}-${file.box.slot}` : '-'} />
          </div>
          <Button asChild>
            <Link to={`/files/${file.id}`}>Mở chi tiết hồ sơ</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  )
}
