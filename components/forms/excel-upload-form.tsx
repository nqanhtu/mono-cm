import { apiFetch } from '@/lib/api/client'
import { useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, FileSpreadsheet, Loader2, UploadCloud } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { ExcelImportPreview } from '@/lib/validation/import'
import { queryClient } from '@/src/lib/query-client'
import { queryKeys } from '@/src/lib/query-keys'
import { cn } from '@/lib/utils'

interface ExcelUploadFormProps {
  onSuccess: () => void
}

type ApiResult<T> = {
  success: boolean
  data?: T
  message?: string
  errors?: unknown
}

export function ExcelUploadForm({ onSuccess }: ExcelUploadFormProps) {
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isCommitting, setIsCommitting] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ExcelImportPreview | null>(null)
  const [isDragActive, setIsDragActive] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true)
    } else if (e.type === "dragleave") {
      setIsDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0]
      const fileExt = droppedFile.name.split('.').pop()?.toLowerCase()
      if (fileExt === 'xlsx' || fileExt === 'xls') {
        setFile(droppedFile)
        setPreview(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
      } else {
        toast.error('Chỉ hỗ trợ định dạng file .xlsx, .xls')
      }
    }
  }

  const buildFormData = () => {
    const formData = new FormData()
    if (file) formData.append('file', file)
    return formData
  }

  const handlePreview = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!file) {
      toast.error('Vui lòng chọn file Excel')
      return
    }

    setIsPreviewing(true)
    setPreview(null)

    try {
      const response = await apiFetch('/api/upload/excel/preview', {
        method: 'POST',
        body: buildFormData(),
      })
      const result: ApiResult<ExcelImportPreview> = await response.json()

      if (response.ok && result.success && result.data) {
        setPreview(result.data)
        if (result.data.summary.errors > 0) {
          toast.warning(`File có ${result.data.summary.errors} lỗi cần xử lý trước khi nhập`)
        } else if (result.data.summary.warnings > 0) {
          toast.warning(`File có ${result.data.summary.warnings} cảnh báo, vui lòng kiểm tra trước khi nhập`)
        } else {
          toast.success('File hợp lệ, có thể nhập dữ liệu')
        }
        return
      }

      toast.error(result.message || 'Không thể kiểm tra file Excel')
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
      const response = await apiFetch('/api/upload/excel/commit', {
        method: 'POST',
        body: buildFormData(),
      })
      const result: ApiResult<{ stats: { success: number; failure: number } }> = await response.json()

      if (response.ok && result.success) {
        toast.success(`Đã nhập thành công ${result.data?.stats.success ?? 0} hồ sơ`)
        queryClient.invalidateQueries({ queryKey: queryKeys.files.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.files.stats })
        queryClient.invalidateQueries({ queryKey: queryKeys.boxes.all })
        onSuccess()
        return
      }

      toast.error(result.message || 'Nhập dữ liệu thất bại')
    } catch {
      toast.error('Có lỗi xảy ra khi nhập dữ liệu')
    } finally {
      setIsCommitting(false)
    }
  }

  // Workflows current step styling calculation
  const getStepStyle = (step: number) => {
    if (step === 1) {
      if (!file) {
        return {
          wrapper: 'border-primary',
          title: 'text-primary font-bold'
        }
      }
      return {
        wrapper: 'border-emerald-600 dark:border-emerald-500 opacity-75',
        title: 'text-emerald-600 dark:text-emerald-500 font-bold'
      }
    }

    if (step === 2) {
      if (!file) {
        return {
          wrapper: 'border-muted opacity-50',
          title: 'text-muted-foreground'
        }
      }
      if (!preview) {
        return {
          wrapper: 'border-primary',
          title: 'text-primary font-bold'
        }
      }
      if (preview.summary.errors > 0) {
        return {
          wrapper: 'border-destructive',
          title: 'text-destructive font-bold'
        }
      }
      return {
        wrapper: 'border-emerald-600 dark:border-emerald-500 opacity-75',
        title: 'text-emerald-600 dark:text-emerald-500 font-bold'
      }
    }

    if (step === 3) {
      if (!preview || preview.summary.errors > 0) {
        return {
          wrapper: 'border-muted opacity-50',
          title: 'text-muted-foreground'
        }
      }
      if (preview.summary.warnings > 0) {
        return {
          wrapper: 'border-amber-500',
          title: 'text-amber-500 font-bold'
        }
      }
      return {
        wrapper: 'border-emerald-600 dark:border-emerald-500',
        title: 'text-emerald-600 dark:text-emerald-500 font-bold'
      }
    }

    return {
      wrapper: 'border-muted opacity-50',
      title: 'text-muted-foreground'
    }
  }

  const steps = [
    { step: 1, title: '1. Chọn file', desc: 'Tải lên tài liệu (.xlsx, .xls)' },
    { step: 2, title: '2. Kiểm tra', desc: 'Rà soát lỗi và xung đột dữ liệu' },
    { step: 3, title: '3. Xác nhận nhập', desc: 'Ghi dữ liệu vào hệ thống' }
  ]

  return (
    <div className="space-y-6 py-2">
      {/* Step Indicators */}
      <div className="grid grid-cols-3 gap-2 border-b pb-4">
        {steps.map((s) => {
          const style = getStepStyle(s.step)
          return (
            <div 
              key={s.step} 
              className={cn("space-y-0.5 border-l-2 pl-3 transition-colors", style.wrapper)}
            >
              <span className={cn("text-xs", style.title)}>
                {s.title}
              </span>
              <p className="text-[10px] text-muted-foreground hidden sm:block">{s.desc}</p>
            </div>
          )
        })}
      </div>

      <form onSubmit={handlePreview} className="space-y-4">
        <div
          onDragEnter={!isCommitting ? handleDrag : undefined}
          onDragOver={!isCommitting ? handleDrag : undefined}
          onDragLeave={!isCommitting ? handleDrag : undefined}
          onDrop={!isCommitting ? handleDrop : undefined}
          onClick={() => !isCommitting && fileInputRef.current?.click()}
          className={cn(
            "flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors text-center",
            !isCommitting ? "cursor-pointer hover:bg-muted/30" : "cursor-not-allowed opacity-60 pointer-events-none",
            isDragActive 
              ? "border-primary bg-primary/[0.04] dark:bg-primary/[0.06] border-solid" 
              : "border-muted-foreground/20"
          )}
        >
          <UploadCloud className="mb-3 h-8 w-8 text-muted-foreground/80" />
          <p className="text-sm font-semibold text-foreground">Bấm để chọn file hoặc kéo thả tại đây</p>
          <p className="mt-1 text-xs text-muted-foreground">Hỗ trợ định dạng .xlsx, .xls</p>
          <input
            ref={fileInputRef}
            id="file-upload"
            type="file"
            accept=".xlsx, .xls"
            className="hidden"
            disabled={isCommitting}
            onChange={(event) => {
              setFile(event.target.files?.[0] || null)
              setPreview(null)
            }}
          />
        </div>

        {file && (
          <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 p-2.5 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <FileSpreadsheet className="h-4.5 w-4.5 text-primary shrink-0" />
              <div className="min-w-0">
                <span className="font-semibold text-foreground truncate block">{file.name}</span>
                <span className="text-[10px] text-muted-foreground font-mono">{(file.size / 1024).toFixed(1)} KB</span>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isCommitting}
              onClick={() => {
                setFile(null)
                setPreview(null)
                if (fileInputRef.current) fileInputRef.current.value = ''
              }}
              className="h-7 text-[10px] text-destructive hover:bg-destructive/10 font-bold rounded"
            >
              Chọn file khác
            </Button>
          </div>
        )}

        {preview && (
          <div className="space-y-3 rounded-xl border p-4 bg-muted/[0.05]">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="text-xs font-semibold px-2.5 py-0.5 rounded-md">{preview.summary.files} hồ sơ</Badge>
              <Badge variant="secondary" className="text-xs font-semibold px-2.5 py-0.5 rounded-md">{preview.summary.documents} văn bản</Badge>
              <Badge variant="secondary" className="text-xs font-semibold px-2.5 py-0.5 rounded-md">{preview.summary.boxes} hộp</Badge>
              
              {preview.summary.errors > 0 ? (
                <Badge variant="destructive" className="text-xs font-semibold gap-1 px-2.5 py-0.5 rounded-md">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {preview.summary.errors} lỗi nghiêm trọng
                </Badge>
              ) : (
                <Badge className="bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold gap-1 px-2.5 py-0.5 rounded-md text-white text-center">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Sẵn sàng nhập
                </Badge>
              )}

              {preview.summary.warnings > 0 && (
                <Badge variant="outline" className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-semibold gap-1 px-2.5 py-0.5 rounded-md border border-amber-500/30">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-500" />
                  {preview.summary.warnings} cảnh báo
                </Badge>
              )}
            </div>

            {preview.summary.errors > 0 ? (
              <p className="text-xs text-destructive font-medium">Cần sửa đổi các lỗi trong file trước khi thực hiện xác nhận nhập liệu.</p>
            ) : preview.summary.warnings > 0 ? (
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">File có một số cảnh báo nhưng vẫn có thể nhập. Hãy kiểm tra kỹ trước khi bấm.</p>
            ) : null}

            {preview.issues.length > 0 ? (
              <div className="max-h-60 overflow-auto rounded-lg border">
                <Table>
                  <TableHeader className="bg-muted/10 sticky top-0 bg-background z-10 border-b">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs font-semibold text-foreground py-2 w-16">Dòng</TableHead>
                      <TableHead className="text-xs font-semibold text-foreground py-2 w-16">Cột</TableHead>
                      <TableHead className="text-xs font-semibold text-foreground py-2 w-28">Mã hồ sơ</TableHead>
                      <TableHead className="text-xs font-semibold text-foreground py-2 w-24">Mức độ</TableHead>
                      <TableHead className="text-xs font-semibold text-foreground py-2">Chi tiết</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.issues.map((issue, index) => {
                      const isError = issue.severity === 'error'
                      return (
                        <TableRow 
                          key={`${issue.row}-${issue.column}-${index}`}
                          className={cn(
                            "hover:bg-muted/30 transition-colors border-b",
                            isError ? "bg-red-500/[0.02] hover:bg-red-500/[0.04]" : "bg-amber-500/[0.02] hover:bg-amber-500/[0.04]"
                          )}
                        >
                          <TableCell className="font-mono text-xs py-1.5 tabular-nums">{issue.row}</TableCell>
                          <TableCell className="font-mono text-xs py-1.5">{issue.column}</TableCell>
                          <TableCell className="font-mono text-xs py-1.5 text-foreground font-semibold">{issue.code || '-'}</TableCell>
                          <TableCell className="py-1.5">
                            <span className={cn(
                              "text-[10px] font-bold px-1.5 py-0.5 rounded-sm border",
                              isError 
                                ? "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20" 
                                : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                            )}>
                              {isError ? 'Lỗi' : 'Cảnh báo'}
                            </span>
                          </TableCell>
                          <TableCell className={cn("text-xs py-1.5", isError ? "text-destructive" : "text-amber-600 dark:text-amber-400")}>
                            {issue.message}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-lg">
                File hợp lệ. Đã quét hoàn tất {preview.summary.files} dòng hồ sơ vụ án mà không phát hiện lỗi nào. Bấm nút dưới để hoàn tất.
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button 
            type="submit" 
            variant="outline" 
            disabled={isPreviewing || !file || isCommitting}
            className="h-9.5 text-xs font-semibold rounded-lg"
          >
            {isPreviewing && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Kiểm tra file
          </Button>
          <Button
            type="button"
            disabled={!preview || preview.summary.errors > 0 || isCommitting || isPreviewing}
            onClick={handleCommit}
            className="h-9.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isCommitting ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Đang nhập...
              </>
            ) : (
              'Xác nhận nhập'
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
