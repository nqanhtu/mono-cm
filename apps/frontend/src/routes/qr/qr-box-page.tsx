'use client'

import { useEffect, useState } from 'react'
import type React from 'react'
import { Link } from 'react-router-dom'
import { useParams } from '@/src/lib/router'
import { Archive, Box, Calendar, FileText, FolderOpen, Loader2, MapPin, QrCode } from 'lucide-react'

import { apiFetch } from '@/lib/api/client'
import type { FileDto, StorageBoxDto } from '@/lib/api/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StatusBadge } from '@/components/common/status-badge'

type QrBoxResponse = {
  success: boolean
  message?: string
  box?: StorageBoxDto
  files?: Pick<FileDto, 'id' | 'code' | 'title' | 'type' | 'year' | 'status'>[]
}

export default function QrBoxPage() {
  const params = useParams<{ id: string }>()
  const [box, setBox] = useState<StorageBoxDto | null>(null)
  const [files, setFiles] = useState<QrBoxResponse['files']>([])
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function resolveQr() {
      setIsLoading(true)
      try {
        if (!params.id) throw new Error('Thiếu mã hộp lưu trữ')
        const response = await apiFetch(`/api/qr/boxes/${encodeURIComponent(params.id)}`)
        const result = await response.json() as QrBoxResponse
        if (!response.ok || !result.success || !result.box) {
          throw new Error(result.message || 'QR hộp lưu trữ không hợp lệ')
        }
        setBox(result.box)
        setFiles(result.files || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không thể mở QR hộp lưu trữ')
      } finally {
        setIsLoading(false)
      }
    }

    if (params.id) resolveQr()
  }, [params.id])

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !box) {
    return (
      <div className="mx-auto flex h-full max-w-lg items-center px-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <QrCode className="h-5 w-5" />
              Không thể mở QR hộp lưu trữ
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{error || 'Không tìm thấy hộp lưu trữ.'}</p>
            <Button asChild>
              <Link to="/admin/boxes">Về danh sách hộp</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const location = [box.warehouse, box.line, box.shelf, box.slot, box.boxNumber].filter(Boolean).join(' - ')
  const fileRange = box.fromFileCode || box.toFileCode
    ? `${box.fromFileCode || '?'} - ${box.toFileCode || '?'}`
    : '-'

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-4 sm:space-y-6 sm:py-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <Archive className="h-5 w-5 text-primary" />
              Hộp lưu trữ từ QR
            </span>
            <Badge variant="secondary" className="max-w-full break-all font-mono">{box.code}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            <Info icon={<MapPin className="h-4 w-4" />} label="Vị trí" value={location} />
            <Info icon={<Box className="h-4 w-4" />} label="Phông lưu trữ" value={box.agency?.name || '-'} />
            <Info icon={<Calendar className="h-4 w-4" />} label="Năm" value={box.year || '-'} />
            <Info icon={<FileText className="h-4 w-4" />} label="Loại hồ sơ" value={box.caseType || '-'} />
            <Info icon={<FolderOpen className="h-4 w-4" />} label="Khoảng hồ sơ" value={fileRange} />
            <Info icon={<Archive className="h-4 w-4" />} label="Thời hạn bảo quản" value={box.retention || '-'} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base">
            <span>Danh sách hồ sơ trong hộp</span>
            <Badge variant="outline">{files?.length || 0} hồ sơ</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 md:hidden">
            {files && files.length > 0 ? (
              files.map((file) => (
                <div key={file.id} className="rounded-md border bg-background p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-all font-mono text-sm font-semibold">{file.code}</p>
                      <h3 className="mt-1 break-words font-medium">{file.title}</h3>
                    </div>
                    <StatusBadge status={file.status} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <Info icon={<FileText className="h-4 w-4" />} label="Loại" value={file.type} />
                    <Info icon={<Calendar className="h-4 w-4" />} label="Năm" value={file.year || '-'} />
                  </div>
                  <Button asChild size="sm" variant="outline" className="mt-3 w-full">
                    <Link to={`/files/${file.id}`}>Chi tiết</Link>
                  </Button>
                </div>
              ))
            ) : (
              <div className="rounded-md border border-dashed p-6 text-center text-muted-foreground">
                Hộp này chưa có hồ sơ.
              </div>
            )}
          </div>

          <div className="hidden overflow-x-auto rounded-md border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã hồ sơ</TableHead>
                  <TableHead>Tiêu đề</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead className="text-center">Năm</TableHead>
                  <TableHead className="text-center">Trạng thái</TableHead>
                  <TableHead className="text-right">Mở</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files && files.length > 0 ? (
                  files.map((file) => (
                    <TableRow key={file.id}>
                      <TableCell className="font-mono font-medium">{file.code}</TableCell>
                      <TableCell>{file.title}</TableCell>
                      <TableCell>{file.type}</TableCell>
                      <TableCell className="text-center">{file.year || '-'}</TableCell>
                      <TableCell className="text-center">
                        <StatusBadge status={file.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link to={`/files/${file.id}`}>Chi tiết</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      Hộp này chưa có hồ sơ.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  )
}
