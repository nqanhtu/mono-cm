'use client';

import { apiFetch } from '@/lib/api/client';

import { useState } from 'react'
import { toast } from 'sonner'

import BorrowForm from '@/components/borrow/borrow-form'
import BorrowHistoryModal from '@/components/borrow/borrow-history-modal'
import { BorrowReturnDialog } from '@/components/borrow/borrow-return-dialog'
import BorrowTable from '@/components/borrow/borrow-table'
import Modal from '@/components/modal'
import { can } from '@/lib/rbac'
import { useSession } from '@/lib/hooks/use-auth'
import { useBorrowSlips } from '@/lib/hooks/use-borrow'
import { BorrowSlipWithDetails } from '@/lib/types/borrow'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { printBorrowSlip } from '@/lib/borrow/print'
import { queryClient } from '@/src/lib/query-client'
import { queryKeys } from '@/src/lib/query-keys'
import { DataPageShell } from '@/components/common/data-page-shell'

export function BorrowListSection() {
  const { borrowSlips = [], isLoading, mutate } = useBorrowSlips()
  const { session } = useSession()
  const canManageBorrow = can(session?.role, 'manageBorrow')
  const canApproveBorrow = session?.role === 'SUPER_ADMIN' || session?.role === 'ADMIN'

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingSlipId, setEditingSlipId] = useState<string | null>(null)
  const [returnSlipId, setReturnSlipId] = useState<string | null>(null)
  const [historySlipId, setHistorySlipId] = useState<string | null>(null)

  const mutateWithToast = async (id: string, action: 'approve' | 'reject' | 'export') => {
    const labels = {
      approve: 'Đã duyệt yêu cầu',
      reject: 'Đã từ chối yêu cầu',
      export: 'Đã xuất hồ sơ',
    }
    try {
      const response = await apiFetch(`/api/borrow/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: action === 'reject' ? JSON.stringify({ reason: 'Từ chối bởi quản trị viên' }) : JSON.stringify({}),
      })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.message || result.error || 'Thao tác thất bại')
      toast.success(labels[action])
      queryClient.invalidateQueries({ queryKey: queryKeys.borrow.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.files.all })
      mutate()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Lỗi kết nối')
    }
  }

  const confirmReturn = async (payload: {
    itemIds: string[]
    condition?: string
    note?: string
    returnedDate?: string
  }) => {
    if (!returnSlipId) return

    try {
      const response = await apiFetch(`/api/borrow/${returnSlipId}/return`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await response.json()

      if (response.ok && result.success) {
        toast.success(result.message || 'Đã trả hồ sơ thành công')
        queryClient.invalidateQueries({ queryKey: queryKeys.borrow.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.files.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.files.stats })
        mutate()
        setReturnSlipId(null)
        return
      }

      toast.error('Lỗi khi trả hồ sơ', { description: result.message })
    } catch {
      toast.error('Lỗi kết nối')
    }
  }

  const editingSlip = editingSlipId
    ? borrowSlips.find((slip: BorrowSlipWithDetails) => slip.id === editingSlipId)
    : undefined
  const returnSlip = returnSlipId
    ? borrowSlips.find((slip: BorrowSlipWithDetails) => slip.id === returnSlipId)
    : undefined

  const countPending = borrowSlips.filter((s) => ['PENDING_APPROVAL'].includes(s.status)).length
  const countApproved = borrowSlips.filter((s) => ['APPROVED'].includes(s.status)).length
  const countBorrowing = borrowSlips.filter((s) => ['EXPORTED', 'PARTIAL_RETURN'].includes(s.status)).length
  const countReturned = borrowSlips.filter((s) => ['RETURNED'].includes(s.status)).length
  const countClosed = borrowSlips.filter((s) => ['REJECTED', 'OVERDUE'].includes(s.status)).length

  return (
    <DataPageShell
      toolbar={
        <div className="flex justify-between items-center w-full">
          <div>
            <h1 className="text-xl font-bold text-foreground">Quản lý mượn trả</h1>
            <p className="text-xs text-muted-foreground">Theo dõi quá trình luân chuyển hồ sơ.</p>
          </div>
        </div>
      }
    >
      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="flex flex-wrap mb-4 bg-muted/30 p-1 w-max">
          <TabsTrigger value="pending" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded-md">Chờ duyệt ({countPending})</TabsTrigger>
          <TabsTrigger value="approved" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded-md">Đã duyệt ({countApproved})</TabsTrigger>
          <TabsTrigger value="borrowing" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded-md">Đang mượn ({countBorrowing})</TabsTrigger>
          <TabsTrigger value="returned" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded-md">Đã trả ({countReturned})</TabsTrigger>
          <TabsTrigger value="closed" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded-md">Từ chối/Quá hạn ({countClosed})</TabsTrigger>
        </TabsList>
        {[
          { value: 'pending', statuses: ['PENDING_APPROVAL'] },
          { value: 'approved', statuses: ['APPROVED'] },
          { value: 'borrowing', statuses: ['EXPORTED', 'PARTIAL_RETURN'] },
          { value: 'returned', statuses: ['RETURNED'] },
          { value: 'closed', statuses: ['REJECTED', 'OVERDUE'] },
        ].map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            <BorrowTable
              borrowSlips={borrowSlips.filter((slip) => tab.statuses.includes(slip.status))}
              isLoading={isLoading}
              onReturn={setReturnSlipId}
              onApprove={(id) => mutateWithToast(id, 'approve')}
              onReject={(id) => mutateWithToast(id, 'reject')}
              onExport={(id) => mutateWithToast(id, 'export')}
              onEdit={(id) => {
                setEditingSlipId(id)
                setIsEditModalOpen(true)
              }}
              onDelete={(id) => console.log('Delete', id)}
              onViewHistory={setHistorySlipId}
              onPrint={(slip) => {
                if (!printBorrowSlip(slip)) {
                  toast.error('Không mở được cửa sổ in', {
                    description: 'Trình duyệt có thể đang chặn pop-up. Hãy cho phép pop-up cho trang này.',
                  })
                }
              }}
              canManageBorrow={canManageBorrow}
              canApproveBorrow={canApproveBorrow}
              onCreate={canManageBorrow ? () => setIsAddModalOpen(true) : undefined}
            />
          </TabsContent>
        ))}
      </Tabs>


      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Tạo phiếu mượn hồ sơ"
        className="max-w-5xl"
      >
        <BorrowForm
          onSuccess={() => {
            setIsAddModalOpen(false)
            queryClient.invalidateQueries({ queryKey: queryKeys.borrow.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.files.all })
            mutate()
          }}
        />
      </Modal>

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setEditingSlipId(null)
        }}
        title="Chỉnh sửa phiếu mượn"
        className="max-w-5xl"
      >
        <BorrowForm
          slipId={editingSlipId || undefined}
          initialData={editingSlip}
          onSuccess={() => {
            setIsEditModalOpen(false)
            setEditingSlipId(null)
            queryClient.invalidateQueries({ queryKey: queryKeys.borrow.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.files.all })
            mutate()
          }}
        />
      </Modal>

      <BorrowHistoryModal
        isOpen={!!historySlipId}
        onClose={() => setHistorySlipId(null)}
        slipId={historySlipId}
      />

      <BorrowReturnDialog
        isOpen={!!returnSlipId}
        onClose={() => setReturnSlipId(null)}
        onConfirm={confirmReturn}
        slip={returnSlip}
      />
      </DataPageShell>
  )
}
