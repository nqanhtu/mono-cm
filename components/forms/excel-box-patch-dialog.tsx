import { useState } from 'react'
import { apiFetch } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertCircle, CheckCircle2, Loader2, Wrench } from 'lucide-react'
import { toast } from 'sonner'

export function ExcelBoxPatchDialog() {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [patchResult, setPatchResult] = useState<{
    stats: { scanned: number; matchedFiles: number; patched: number; missingBoxCount: number }
    missingBoxes: string[]
    issues: string[]
  } | null>(null)

  const handlePatch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return toast.error('Vui lòng chọn file Excel')

    setIsLoading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await apiFetch('/api/upload/excel/patch-boxes', { method: 'POST', body: formData })
      const data = await res.json()

      if (res.ok && data.success) {
        setPatchResult(data)
        toast.success(`Đã vá thành công ${data.stats.patched} hồ sơ`)
      } else {
        toast.error(data.message || 'Thao tác vá dữ liệu thất bại')
      }
    } catch {
      toast.error('Có lỗi xảy ra khi vá Hộp số')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 h-9 rounded-lg border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 font-semibold">
          <Wrench className="h-4 w-4 text-amber-600 dark:text-amber-500" />
          Vá Hộp số từ Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">Vá liên kết Hộp lưu trữ từ Excel</DialogTitle>
          <DialogDescription className="text-xs">
            Rà soát và bổ sung Hộp số cho các hồ sơ cũ trong DB. Chỉ liên kết vào các Hộp ĐÃ TỒN TẠI sẵn trong hệ thống.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handlePatch} className="space-y-4 py-2">
          <input
            type="file"
            accept=".xlsx, .xls"
            onChange={(e) => {
              setFile(e.target.files?.[0] || null)
              setPatchResult(null)
            }}
            className="text-xs block w-full border rounded-lg p-2.5 bg-muted/20"
          />

          {patchResult && (
            <div className="space-y-3 rounded-xl border p-3.5 bg-muted/20 text-xs">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Quét: {patchResult.stats.scanned} dòng</Badge>
                <Badge variant="secondary">Khớp DB: {patchResult.stats.matchedFiles} HS</Badge>
                <Badge className="bg-emerald-600 text-white font-semibold">Đã vá: {patchResult.stats.patched} HS</Badge>
              </div>

              {patchResult.missingBoxes.length > 0 && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-700 dark:text-amber-400 space-y-1">
                  <p className="font-semibold flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Cảnh báo Hộp chưa có trong CSDL ({patchResult.missingBoxes.length}):
                  </p>
                  <p className="text-[11px] font-mono break-words">{patchResult.missingBoxes.map((b) => `Hộp ${b}`).join(', ')}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Vui lòng tạo trước các Hộp này trong hệ thống rồi thực hiện vá lại.</p>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Đóng</Button>
            <Button type="submit" disabled={!file || isLoading} className="bg-primary text-primary-foreground font-semibold">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
              Bắt đầu vá
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
