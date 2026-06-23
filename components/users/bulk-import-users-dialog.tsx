'use client';

import { apiFetch } from '@/lib/api/client';
import { useState } from 'react'
import { AlertCircle, CheckCircle2, FileSpreadsheet, Loader2, UploadCloud, Download } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface BulkImportUsersDialogProps {
  onSuccess: () => void
  onCancel: () => void
}

type UserPreviewRow = {
  username: string
  fullName: string
  role: string
  unit?: string
  status: boolean
  importStatus: 'ready' | 'error'
}

type IssueRow = {
  row: number
  column: string
  code?: string
  message: string
  severity: 'error' | 'warning'
}

type UserImportPreview = {
  summary: {
    users: number
    errors: number
    warnings: number
  }
  users: UserPreviewRow[]
  issues: IssueRow[]
}

type ApiResult<T> = {
  success: boolean
  data?: T
  message?: string
  errors?: unknown
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Quản trị toàn hệ thống',
  ADMIN: 'Quản trị',
  COORDINATOR: 'Điều phối',
  VIEWER: 'Chỉ xem',
  BASIC_VIEWER: 'Basic Viewer'
}

export function BulkImportUsersDialog({ onSuccess, onCancel }: BulkImportUsersDialogProps) {
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isCommitting, setIsCommitting] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<UserImportPreview | null>(null)

  const buildFormData = () => {
    const formData = new FormData()
    if (file) formData.append('file', file)
    return formData
  }

  const handlePreview = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!file) {
      toast.error('Vui lòng chọn file Excel hoặc CSV')
      return
    }

    setIsPreviewing(true)
    setPreview(null)

    try {
      const response = await apiFetch('/api/users/import/preview', {
        method: 'POST',
        body: buildFormData(),
      })
      const result: ApiResult<UserImportPreview> = await response.json()

      if (response.ok && result.success && result.data) {
        setPreview(result.data)
        if (result.data.summary.errors > 0) {
          toast.warning(`File có ${result.data.summary.errors} lỗi cần xử lý trước khi nhập`)
        } else {
          toast.success('File hợp lệ, có thể nhập danh sách người dùng')
        }
        return
      }

      toast.error(result.message || 'Không thể kiểm tra file')
    } catch {
      toast.error('Có lỗi xảy ra khi kiểm tra file')
    } finally {
      setIsPreviewing(false)
    }
  }

  const handleCommit = async () => {
    if (!file || !preview || preview.summary.errors > 0) return

    setIsCommitting(true)
    try {
      const response = await apiFetch('/api/users/import/commit', {
        method: 'POST',
        body: buildFormData(),
      })
      const result: ApiResult<{ stats: { success: number; failure: number } }> = await response.json()

      if (response.ok && result.success) {
        toast.success(`Đã nhập thành công ${result.data?.stats.success ?? 0} người dùng`)
        onSuccess()
        return
      }

      toast.error(result.message || 'Nhập danh sách người dùng thất bại')
    } catch {
      toast.error('Có lỗi xảy ra khi nhập dữ liệu')
    } finally {
      setIsCommitting(false)
    }
  }

  return (
    <div className="space-y-4 py-4 text-left">
      <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3 text-sm">
        <div className="space-y-1">
          <p className="font-medium">Tải file mẫu Excel (.xlsx)</p>
          <p className="text-xs text-muted-foreground">Sử dụng file mẫu này để nhập người dùng đúng định dạng.</p>
        </div>
        <a href="/templates/sample-users.xlsx" download="mau-danh-sach-nguoi-dung.xlsx">
          <Button size="sm" variant="outline" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Tải file mẫu
          </Button>
        </a>
      </div>

      <form onSubmit={handlePreview} className="space-y-4">
        <div
          className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors hover:bg-muted/50"
          onClick={() => document.getElementById('user-file-upload')?.click()}
        >
          <UploadCloud className="mb-2 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium">Bấm để chọn file hoặc kéo thả</p>
          <p className="mt-1 text-xs text-muted-foreground">Hỗ trợ .xlsx, .xls, .csv</p>
          <input
            id="user-file-upload"
            type="file"
            accept=".xlsx, .xls, .csv"
            className="hidden"
            onChange={(event) => {
              setFile(event.target.files?.[0] || null)
              setPreview(null)
            }}
          />
        </div>

        {file && (
          <div className="flex items-center gap-2 rounded-md bg-muted p-2 text-sm">
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">Tệp đã chọn:</span>
            <span className="truncate">{file.name}</span>
          </div>
        )}

        {preview && (
          <div className="space-y-4 rounded-md border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{preview.summary.users} người dùng</Badge>
              {preview.summary.errors > 0 ? (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {preview.summary.errors} lỗi
                </Badge>
              ) : (
                <Badge className="bg-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Sẵn sàng nhập
                </Badge>
              )}
            </div>

            {/* Preview user list */}
            <div className="max-h-56 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tên đăng nhập</TableHead>
                    <TableHead>Họ và tên</TableHead>
                    <TableHead>Vai trò</TableHead>
                    <TableHead>Đơn vị</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Kết quả kiểm tra</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.users.map((u, i) => (
                    <TableRow key={`${u.username}-${i}`}>
                      <TableCell className="font-medium">{u.username}</TableCell>
                      <TableCell>{u.fullName}</TableCell>
                      <TableCell>{ROLE_LABELS[u.role] || u.role}</TableCell>
                      <TableCell>{u.unit || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={u.status ? 'outline' : 'secondary'}>
                          {u.status ? 'Hoạt động' : 'Bị khóa'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {u.importStatus === 'ready' ? (
                          <span className="text-xs text-emerald-600 font-medium">Hợp lệ</span>
                        ) : (
                          <span className="text-xs text-red-600 font-medium">Có lỗi</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {preview.issues.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-destructive">Chi tiết lỗi cần chỉnh sửa:</p>
                <div className="max-h-40 overflow-auto rounded-md border border-destructive/20 bg-destructive/5 dark:bg-destructive/10">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Dòng</TableHead>
                        <TableHead>Cột</TableHead>
                        <TableHead>Giá trị</TableHead>
                        <TableHead>Lỗi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.issues.map((issue, index) => (
                        <TableRow key={`${issue.row}-${issue.column}-${index}`}>
                          <TableCell>{issue.row}</TableCell>
                          <TableCell>{issue.column}</TableCell>
                          <TableCell>{issue.code || '-'}</TableCell>
                          <TableCell className="text-destructive font-medium">{issue.message}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Hủy
          </Button>
          <Button type="submit" variant="secondary" disabled={isPreviewing || !file}>
            {isPreviewing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Kiểm tra file
          </Button>
          <Button
            type="button"
            disabled={!preview || preview.summary.errors > 0 || isCommitting}
            onClick={handleCommit}
          >
            {isCommitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Xác nhận nhập
          </Button>
        </DialogFooter>
      </form>
    </div>
  )
}
