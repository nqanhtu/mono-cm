import * as React from 'react'
import { Archive, Check, ChevronsUpDown, Loader2, MapPin, Clock, FolderArchive, Layers, X } from 'lucide-react'
import { toast } from 'sonner'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { apiFetch } from '@/lib/api/client'
import { useStorageBoxes } from '@/lib/hooks/use-storage-boxes'
import type { FileWithBox } from '@/components/files/columns'
import type { StorageBoxDto } from '@/lib/api/types'
import { cn } from '@/lib/utils'

interface BatchAssignBoxDialogProps {
  isOpen: boolean
  onClose: () => void
  selectedFiles: FileWithBox[]
  onRemoveFile?: (fileId: string) => void
  onSuccess?: () => void
}

export function BatchAssignBoxDialog({
  isOpen,
  onClose,
  selectedFiles,
  onRemoveFile,
  onSuccess,
}: BatchAssignBoxDialogProps) {
  const [selectedBoxId, setSelectedBoxId] = React.useState<string>('')
  const [isComboboxOpen, setIsComboboxOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const { boxes, isLoading: isLoadingBoxes } = useStorageBoxes({}, isOpen)

  // Reset state when opening/closing
  React.useEffect(() => {
    if (!isOpen) {
      setSelectedBoxId('')
      setIsComboboxOpen(false)
      setIsSubmitting(false)
    }
  }, [isOpen])

  const selectedBox = React.useMemo<StorageBoxDto | undefined>(
    () => boxes.find((box) => box.id === selectedBoxId),
    [boxes, selectedBoxId]
  )

  const handleConfirm = async () => {
    if (!selectedBoxId) {
      toast.error('Vui lòng chọn hộp lưu trữ đích')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await apiFetch('/api/files/batch-assign-box', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileIds: selectedFiles.map((f) => f.id),
          boxId: selectedBoxId,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || 'Không thể chuyển hồ sơ vào hộp')
      }

      toast.success(data.message || `Đã chuyển ${selectedFiles.length} hồ sơ vào hộp thành công`)
      onSuccess?.()
      onClose()
    } catch (error) {
      console.error('Batch assign box error:', error)
      toast.error(error instanceof Error ? error.message : 'Có lỗi xảy ra khi chuyển hồ sơ')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSubmitting && !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Archive className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                Chuyển {selectedFiles.length} hồ sơ vào hộp lưu trữ
              </DialogTitle>
              <DialogDescription className="text-xs">
                Chọn hộp lưu trữ đích để xếp tất cả hồ sơ đã chọn vào.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Danh sách hồ sơ sẽ chuyển */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground">
                Danh sách hồ sơ ({selectedFiles.length})
              </span>
              <span className="text-muted-foreground text-[11px]">
                Bấm <span className="font-semibold text-destructive">✕</span> để loại bớt hồ sơ
              </span>
            </div>
            <div className="max-h-40 overflow-y-auto rounded-lg border bg-slate-50/50 p-1.5 space-y-1 dark:bg-slate-900/40 dark:border-slate-800">
              {selectedFiles.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Chưa có hồ sơ nào được chọn</p>
              ) : (
                selectedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between gap-2 rounded-md border bg-background px-2.5 py-1.5 text-xs shadow-2xs dark:border-slate-800"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="font-mono font-bold text-primary shrink-0">
                        {file.code || 'Chưa có mã'}
                      </span>
                      <span className="truncate text-slate-700 dark:text-slate-300">
                        {file.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground">
                        {file.box?.code ? (
                          <>
                            Hộp: <span>{file.box.code}</span>
                          </>
                        ) : (
                          'Chưa vào hộp'
                        )}
                      </Badge>
                      {onRemoveFile && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Loại bỏ ${file.code || file.title}`}
                          onClick={() => onRemoveFile(file.id)}
                          className="size-5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                        >
                          <X className="size-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Hộp lưu trữ đích <span className="text-destructive">*</span>
            </label>
            <Popover modal={true} open={isComboboxOpen} onOpenChange={setIsComboboxOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={isComboboxOpen}
                  className="w-full justify-between font-normal text-sm h-10"
                  disabled={isSubmitting || isLoadingBoxes}
                >
                  {selectedBox ? (
                    <span className="flex items-center gap-2 truncate">
                      <span className="font-semibold font-mono">{selectedBox.code}</span>
                      <span className="text-muted-foreground text-xs">
                        ({selectedBox.warehouse} - {selectedBox.line} - {selectedBox.shelf})
                      </span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      {isLoadingBoxes ? 'Đang tải danh sách hộp...' : 'Tìm kiếm và chọn hộp lưu trữ...'}
                    </span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[--radix-popover-trigger-width] p-0"
                align="start"
                onWheel={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
              >
                <Command>
                  <CommandInput placeholder="Gõ mã hộp, kho, kệ, loại án..." />
                  <CommandList className="max-h-60 overflow-y-auto">
                    <CommandEmpty>Không tìm thấy hộp lưu trữ phù hợp.</CommandEmpty>
                    <CommandGroup>
                      {boxes.map((box) => (
                        <CommandItem
                          key={box.id}
                          value={`${box.code} ${box.boxNumber} ${box.warehouse} ${box.line} ${box.shelf} ${box.slot} ${box.caseType || ''} ${box.agency?.name || ''}`}
                          onSelect={() => {
                            setSelectedBoxId(box.id)
                            setIsComboboxOpen(false)
                          }}
                          className="flex items-center justify-between py-2 cursor-pointer"
                        >
                          <div className="flex flex-col gap-0.5 min-w-0 pr-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold font-mono text-sm">{box.code}</span>
                              {box.caseType && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {box.caseType}
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground truncate">
                              {box.warehouse} &bull; {box.line} &bull; {box.shelf} {box.slot ? `&bull; ${box.slot}` : ''}
                            </span>
                          </div>
                          <Check
                            className={cn(
                              "h-4 w-4 shrink-0 text-primary",
                              selectedBoxId === box.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {selectedBox && (
            <div className="rounded-lg border bg-slate-50/80 p-3 text-xs space-y-2 dark:bg-slate-900/50 dark:border-slate-800">
              <div className="flex items-center justify-between border-b pb-2 dark:border-slate-800">
                <span className="font-semibold text-slate-700 dark:text-slate-200">Thông tin hộp</span>
                <Badge variant="outline" className="font-mono bg-background">
                  {selectedBox.code}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <MapPin className="size-3.5 shrink-0 text-slate-500" />
                  <span className="truncate">
                    {selectedBox.warehouse} - {selectedBox.line} - {selectedBox.shelf} {selectedBox.slot ? `- ${selectedBox.slot}` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <FolderArchive className="size-3.5 shrink-0 text-slate-500" />
                  <span className="truncate">Đang có: {selectedBox._count?.files ?? 0} hồ sơ</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Layers className="size-3.5 shrink-0 text-slate-500" />
                  <span className="truncate">{selectedBox.caseType || 'Chưa phân loại'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="size-3.5 shrink-0 text-slate-500" />
                  <span className="truncate">Thời hạn: {selectedBox.retention || 'Không khóa'}</span>
                </div>
              </div>
              {selectedBox.retention && (
                <div className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-1.5 rounded border border-amber-200/50 dark:border-amber-900/50">
                  Thời hạn bảo quản của các hồ sơ được chọn sẽ tự động đồng bộ theo hộp (<strong>{selectedBox.retention}</strong>).
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-xs h-8"
          >
            Hủy
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting || !selectedBoxId}
            className="text-xs h-8 gap-1.5"
          >
            {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Xác nhận chuyển
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
