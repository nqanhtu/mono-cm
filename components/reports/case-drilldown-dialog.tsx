'use client'

import { format } from 'date-fns'
import { FileText, Loader2, Package, Calendar } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatusBadge } from '@/components/common/status-badge'
import { useCaseDrilldown } from '@/lib/hooks/use-reports'
import { Badge } from '@/components/ui/badge'

interface CaseDrilldownDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  year: number | null
  type: string | null
}

export function CaseDrilldownDialog({
  open,
  onOpenChange,
  year,
  type,
}: CaseDrilldownDialogProps) {
  const { data, isLoading } = useCaseDrilldown({
    year,
    type,
    enabled: open && Boolean(year && type),
  })

  const files = data?.files || []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] sm:max-w-3xl flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 sm:p-6 border-b bg-muted/20">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
                  {type || 'Hồ sơ án'}
                </DialogTitle>
                {year && (
                  <Badge variant="outline" className="text-xs font-semibold">
                    Năm {year}
                  </Badge>
                )}
                {data?.total !== undefined && (
                  <Badge variant="secondary" className="text-xs">
                    {data.total} hồ sơ
                  </Badge>
                )}
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Danh sách chi tiết các hồ sơ án lưu trữ trong hệ thống.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[60vh] p-4 sm:p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-xs">Đang tải danh sách hồ sơ...</span>
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <FileText className="w-8 h-8 opacity-40" />
              <span className="text-xs">Không có hồ sơ nào được tìm thấy.</span>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="w-[140px] text-xs font-bold uppercase tracking-wider">Mã hồ sơ</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Tiêu đề vụ án</TableHead>
                    <TableHead className="w-[120px] text-xs font-bold uppercase tracking-wider">Thời gian</TableHead>
                    <TableHead className="w-[110px] text-xs font-bold uppercase tracking-wider">Hộp lưu</TableHead>
                    <TableHead className="w-[100px] text-xs font-bold uppercase tracking-wider text-right">Trạng thái</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {files.map((file) => {
                    const dateDisplay = file.datetime
                      ? format(new Date(file.datetime), 'dd/MM/yyyy')
                      : file.judgmentDate
                        ? format(new Date(file.judgmentDate), 'dd/MM/yyyy')
                        : '-'

                    return (
                      <TableRow key={file.id} className="hover:bg-muted/50">
                        <TableCell className="font-mono text-xs font-semibold text-primary">
                          {file.code}
                        </TableCell>
                        <TableCell>
                          <div className="text-xs font-medium text-foreground line-clamp-2">
                            {file.title}
                          </div>
                          {file.indexCode && (
                            <span className="text-[10px] text-muted-foreground">
                              MLHS: {file.indexCode}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3 h-3 shrink-0" />
                            <span>{dateDisplay}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {file.box ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
                              <Package className="w-3 h-3 text-muted-foreground" />
                              {file.box.code}
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic text-xs">Chưa gán</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <StatusBadge status={file.status} />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
