'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from '@/src/lib/router'
import { ExcelUploadForm } from '@/components/forms/excel-upload-form'
import { CaseFileForm } from '@/components/forms/case-file-form'

import { Button } from '@/components/ui/button'
import { ArrowLeft, FileSpreadsheet } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { DataPageShell } from '@/components/common/data-page-shell'
import { useSession } from '@/lib/hooks/use-auth'

export default function UploadPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode') || 'manual-entry'
  const { session } = useSession()
  
  const [isDirty, setIsDirty] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [pendingModeChange, setPendingModeChange] = useState<string | null>(null)

  const handleBack = () => {
    if (isDirty) {
      setPendingModeChange('/')
      setShowExitConfirm(true)
    } else {
      router.push('/')
    }
  }

  const handleConfirmExit = () => {
    setIsDirty(false)
    setShowExitConfirm(false)
    if (pendingModeChange === '/') {
      router.push('/')
    } else if (pendingModeChange === 'excel') {
      router.push('/upload?mode=excel')
    } else if (pendingModeChange === 'manual-entry') {
      router.push('/upload?mode=manual-entry')
    }
    setPendingModeChange(null)
  }

  if (mode === 'excel') {
    return (
      <DataPageShell
        toolbar={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between w-full">
            <div>
              <button
                onClick={() => {
                  router.push('/upload?mode=manual-entry')
                }}
                className="group flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors mb-1"
              >
                <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
                Quay lại nhập thủ công
              </button>
              <h1 className="text-xl font-bold text-foreground">Nhập file Excel</h1>
              <p className="text-xs text-muted-foreground">Kiểm tra file Excel trước khi nhập để phát hiện lỗi dòng/cột, mã trùng và dữ liệu thiếu.</p>
            </div>
          </div>
        }
      >
        <div className="mx-auto max-w-4xl space-y-6">
          <ExcelUploadForm onSuccess={() => router.push('/')} />
        </div>
      </DataPageShell>
    )
  }

  return (
    <DataPageShell
      toolbar={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between w-full">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">Nhập hồ sơ thủ công</h1>
              {isDirty && (
                <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold px-2 py-0.5 rounded-full border border-amber-500/25">
                  Có thay đổi chưa lưu
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Tạo hồ sơ mới và lưu thông tin vụ án, hộp lưu trữ liên quan.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (isDirty) {
                  setPendingModeChange('excel')
                  setShowExitConfirm(true)
                } else {
                  router.push('/upload?mode=excel')
                }
              }}
              className="gap-1.5 h-8 text-xs font-semibold border-slate-300 dark:border-slate-700 rounded-lg"
              size="sm"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Nhập từ Excel
            </Button>
          </div>
        </div>
      }
    >
      <div className="mx-auto max-w-5xl space-y-6">
        <CaseFileForm
          onSuccess={(fileId, action) => {
            if (action === 'save_and_add_child' && fileId) {
              router.push(`/files/${fileId}?focus=documents&entry=create`)
            } else if (action === 'save') {
              router.push('/')
            }
          }}
          onCancel={handleBack}
          isDirty={isDirty}
          setIsDirty={setIsDirty}
          draftOwnerId={session?.id}
        />

        {/* Unsaved Changes Confirmation Dialog */}
        <AlertDialog 
          open={showExitConfirm} 
          onOpenChange={(open) => {
            setShowExitConfirm(open)
            if (!open) {
              setPendingModeChange(null)
            }
          }}
        >
          <AlertDialogContent className="rounded-2xl max-w-[450px]">
            <AlertDialogHeader>
              <AlertDialogTitle>Rời khỏi trang nhập liệu?</AlertDialogTitle>
              <AlertDialogDescription className="text-sm">
                Bạn có thay đổi chưa lưu. Nếu rời đi, thông tin đang nhập sẽ bị mất.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel 
                onClick={() => {
                  setShowExitConfirm(false)
                  setPendingModeChange(null)
                }} 
                className="rounded-xl h-9"
              >
                Tiếp tục nhập
              </AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={handleConfirmExit} className="rounded-xl h-9">Rời khỏi</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DataPageShell>
  )
}
