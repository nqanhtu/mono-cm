'use client'

import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { BorrowSlipWithDetails } from '@/lib/types/borrow'

interface BorrowReturnDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (payload: {
    itemIds: string[]
    condition?: string
    note?: string
    returnedDate?: string
  }) => void
  slip?: BorrowSlipWithDetails
}

export function BorrowReturnDialog({ isOpen, onClose, onConfirm, slip }: BorrowReturnDialogProps) {
  const borrowingItems = useMemo(
    () => slip?.items.filter((item) => item.status === 'BORROWING') ?? [],
    [slip]
  )
  const defaultReturnedDate = new Date().toISOString().split('T')[0]
  const defaultSelectedItemIds = borrowingItems.map((item) => item.id)
  const [draft, setDraft] = useState({
    slipId: '',
    selectedItemIds: [] as string[],
    condition: '',
    note: '',
    returnedDate: defaultReturnedDate,
  })

  const currentDraft = draft.slipId === slip?.id
    ? draft
    : {
      slipId: slip?.id ?? '',
      selectedItemIds: defaultSelectedItemIds,
      condition: '',
      note: '',
      returnedDate: defaultReturnedDate,
    }

  const updateDraft = (patch: Partial<typeof draft>) => {
    setDraft((current) => ({
      ...(current.slipId === slip?.id ? current : currentDraft),
      ...patch,
      slipId: slip?.id ?? '',
    }))
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Trả hồ sơ</DialogTitle>
          <DialogDescription>
            Chọn hồ sơ cần trả. Nếu chỉ trả một phần, phiếu sẽ chuyển sang trạng thái trả một phần.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="max-h-56 overflow-auto rounded-md border">
            {borrowingItems.length > 0 ? (
              borrowingItems.map((item) => (
                <label
                  key={item.id}
                  className="flex cursor-pointer items-start gap-3 border-b p-3 last:border-b-0"
                >
                  <Checkbox
                    checked={currentDraft.selectedItemIds.includes(item.id)}
                    onCheckedChange={(checked) => {
                      updateDraft({
                        selectedItemIds: checked
                          ? [...currentDraft.selectedItemIds, item.id]
                          : currentDraft.selectedItemIds.filter((selectedId) => selectedId !== item.id),
                      })
                    }}
                  />
                  <span className="grid gap-1 text-sm">
                    <span className="font-medium">{item.file.title}</span>
                    <span className="text-xs text-muted-foreground">{item.file.code}</span>
                  </span>
                </label>
              ))
            ) : (
              <div className="p-4 text-sm text-muted-foreground">Không còn hồ sơ nào đang mượn.</div>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="returned-date">
                Ngày trả
              </label>
              <Input
                id="returned-date"
                type="date"
                value={currentDraft.returnedDate}
                onChange={(event) => updateDraft({ returnedDate: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="return-condition">
                Tình trạng khi trả
              </label>
              <Input
                id="return-condition"
                value={currentDraft.condition}
                onChange={(event) => updateDraft({ condition: event.target.value })}
                placeholder="Nguyên vẹn, thiếu trang..."
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="return-note">
              Ghi chú
            </label>
            <Textarea
              id="return-note"
              value={currentDraft.note}
              onChange={(event) => updateDraft({ note: event.target.value })}
              placeholder="Thông tin bổ sung khi trả hồ sơ"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button
            onClick={() => onConfirm({
              itemIds: currentDraft.selectedItemIds,
              condition: currentDraft.condition,
              note: currentDraft.note,
              returnedDate: currentDraft.returnedDate,
            })}
            disabled={currentDraft.selectedItemIds.length === 0}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            Xác nhận trả
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
