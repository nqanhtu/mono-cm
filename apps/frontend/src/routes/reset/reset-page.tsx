'use client';

import { apiFetch } from '@/lib/api/client';

import { useEffect, useState } from 'react'
import { useRouter } from '@/src/lib/router'
import { toast } from 'sonner'
import {
    AlertTriangle,
    CheckCircle2,
    Clock,
    DatabaseBackup,
    Download,
    FileArchive,
    Loader2,
    RotateCcw,
    ShieldAlert,
    Trash2,
    Upload,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import type { BackupScheduleDto } from '@/lib/api/types'
import { queryClient } from '@/src/lib/query-client'
import { queryKeys } from '@/src/lib/query-keys'
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
import { useSession } from '@/lib/hooks/use-auth'

interface DeletedCounts {
    files: number
    documents: number
    fileIndexes: number
    borrowSlips: number
    borrowItems: number
    borrowSlipEvents: number
}

export default function ResetPage() {
    const router = useRouter()
    const { session, isLoading } = useSession()

    const [confirmText, setConfirmText] = useState('')
    const [showDialog, setShowDialog] = useState(false)
    const [showRestoreDialog, setShowRestoreDialog] = useState(false)
    const [isResetting, setIsResetting] = useState(false)
    const [isBackingUp, setIsBackingUp] = useState(false)
    const [isRestoring, setIsRestoring] = useState(false)
    const [restoreConfirmText, setRestoreConfirmText] = useState('')
    const [restoreFile, setRestoreFile] = useState<File | null>(null)
    const [result, setResult] = useState<DeletedCounts | null>(null)
    const [schedule, setSchedule] = useState<BackupScheduleDto>({
        id: 'default',
        enabled: false,
        frequency: 'DAILY',
        timeOfDay: '23:00',
        retentionDays: 7,
        target: 'local',
    })
    const [isSavingSchedule, setIsSavingSchedule] = useState(false)

    useEffect(() => {
        async function loadSchedule() {
            if (session?.role !== 'SUPER_ADMIN') return
            try {
                const response = await apiFetch('/api/admin/database/backup-schedule')
                if (!response.ok) return
                const data = await response.json()
                if (data.schedule) setSchedule(data.schedule)
            } catch {
                // The schedule panel is non-blocking.
            }
        }
        loadSchedule()
    }, [session?.role])

    // Chặn truy cập nếu không phải SUPER_ADMIN
    if (!isLoading && session?.role !== 'SUPER_ADMIN') {
        router.replace('/forbidden')
        return null
    }

    const isAnyOperationRunning = isBackingUp || isRestoring || isResetting
    const canConfirm = confirmText === 'RESET'
    const canRestore = restoreConfirmText === 'RESTORE' && Boolean(restoreFile)
    const lastRunText = schedule.lastRunAt ? new Date(schedule.lastRunAt).toLocaleString('vi-VN') : 'Chưa có'
    const scheduleFrequencyText = schedule.frequency === 'WEEKLY' ? 'Hằng tuần' : 'Hằng ngày'

    const invalidateMaintenanceDomains = () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.files.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.files.stats })
        queryClient.invalidateQueries({ queryKey: queryKeys.boxes.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.borrow.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.audit.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.reports.stats })
        queryClient.invalidateQueries({ queryKey: queryKeys.backup.schedule })
    }

    const handleBackup = async () => {
        setIsBackingUp(true)

        try {
            const response = await apiFetch('/api/admin/database/backup', {
                method: 'POST',
            })

            if (!response.ok) {
                let message = 'Không thể tạo bản sao lưu cơ sở dữ liệu'
                try {
                    const data = await response.json()
                    if (data?.error) message = data.error
                } catch {
                    // Response is not JSON; keep the default user-facing message.
                }
                throw new Error(message)
            }

            const blob = await response.blob()
            const filename = getDownloadFilename(response.headers.get('content-disposition'))
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')

            link.href = url
            link.download = filename
            document.body.appendChild(link)
            link.click()
            link.remove()
            URL.revokeObjectURL(url)

            toast.success('Đã tạo bản sao lưu cơ sở dữ liệu')
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Lỗi kết nối')
        } finally {
            setIsBackingUp(false)
        }
    }

    const handleSaveSchedule = async () => {
        setIsSavingSchedule(true)
        try {
            const response = await apiFetch('/api/admin/database/backup-schedule', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(schedule),
            })
            const data = await response.json()
            if (!response.ok || !data.success) throw new Error(data.error || 'Không thể lưu lịch sao lưu')
            setSchedule(data.schedule)
            queryClient.invalidateQueries({ queryKey: queryKeys.backup.schedule })
            toast.success('Đã lưu lịch sao lưu')
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Lỗi kết nối')
        } finally {
            setIsSavingSchedule(false)
        }
    }

    const handleReset = async () => {
        setShowDialog(false)
        setIsResetting(true)
        setResult(null)

        try {
            const res = await apiFetch('/api/reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirm: 'RESET' }),
            })

            const data = await res.json()

            if (res.ok && data.success) {
                setResult(data.deletedCounts)
                setConfirmText('')
                invalidateMaintenanceDomains()
                toast.success('Reset dữ liệu thành công')
            } else {
                toast.error(data.error || 'Reset thất bại')
            }
        } catch {
            toast.error('Lỗi kết nối')
        } finally {
            setIsResetting(false)
        }
    }

    const handleRestore = async () => {
        if (!restoreFile) return

        setShowRestoreDialog(false)
        setIsRestoring(true)

        try {
            const formData = new FormData()
            formData.set('confirm', 'RESTORE')
            formData.set('file', restoreFile)

            const res = await apiFetch('/api/admin/database/restore', {
                method: 'POST',
                body: formData,
            })

            const data = await res.json()

            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Khôi phục cơ sở dữ liệu thất bại')
            }

            setRestoreConfirmText('')
            setRestoreFile(null)
            toast.success(`Đã khôi phục cơ sở dữ liệu từ ${data.filename}`)
            invalidateMaintenanceDomains()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Lỗi kết nối')
        } finally {
            setIsRestoring(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex h-full min-h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="flex min-h-full w-full flex-col gap-6 pb-6">
            <div className="flex justify-end">
                <Badge variant="destructive">SUPER_ADMIN</Badge>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <p>Các thao tác dưới đây ảnh hưởng trực tiếp đến dữ liệu hệ thống. Hãy tạo bản sao lưu trước khi khôi phục hoặc reset.</p>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
                <main className="space-y-5">
                    <Card className="border-blue-200 shadow-sm">
                        <CardHeader className="border-b border-blue-100 bg-blue-50/60">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <DatabaseBackup className="h-5 w-5 text-blue-600" />
                                        <CardTitle className="text-blue-900">Sao lưu cơ sở dữ liệu</CardTitle>
                                    </div>
                                    <CardDescription className="mt-1 text-blue-700/80">
                                        Tạo file PostgreSQL .dump từ dữ liệu hiện tại.
                                    </CardDescription>
                                </div>
                                <Badge variant="success">An toàn</Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-5">
                            <p className="rounded-lg border border-blue-100 bg-blue-50/50 px-4 py-3 text-sm text-slate-600">
                                File backup dùng để khôi phục hệ thống khi bảo trì, thử nghiệm hoặc xử lý sự cố dữ liệu.
                            </p>
                            <Button
                                variant="outline"
                                className="min-h-10 w-full border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800 sm:w-auto"
                                disabled={isAnyOperationRunning}
                                onClick={handleBackup}
                            >
                                {isBackingUp ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Đang tạo bản sao lưu...
                                    </>
                                ) : (
                                    <>
                                        <Download className="mr-2 h-4 w-4" />
                                        Tải xuống bản sao lưu
                                    </>
                                )}
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="border-slate-200 shadow-sm">
                        <CardHeader className="border-b bg-slate-50/70">
                            <div className="flex items-center gap-2">
                                <Clock className="h-5 w-5 text-slate-600" />
                                <CardTitle className="text-slate-800">Lịch sao lưu tự động</CardTitle>
                            </div>
                            <CardDescription>Web app chỉ cấu hình lịch; job thực tế chạy ở backend/server.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5 pt-5">
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Trạng thái</label>
                                    <Select
                                        value={schedule.enabled ? 'enabled' : 'disabled'}
                                        onValueChange={(value) => setSchedule((prev) => ({ ...prev, enabled: value === 'enabled' }))}
                                        disabled={isAnyOperationRunning || isSavingSchedule}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="enabled">Bật</SelectItem>
                                            <SelectItem value="disabled">Tắt</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Tần suất</label>
                                    <Select
                                        value={schedule.frequency}
                                        onValueChange={(value) => setSchedule((prev) => ({ ...prev, frequency: value }))}
                                        disabled={isAnyOperationRunning || isSavingSchedule}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="DAILY">Hằng ngày</SelectItem>
                                            <SelectItem value="WEEKLY">Hằng tuần</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Giờ chạy</label>
                                    <Input
                                        type="time"
                                        value={schedule.timeOfDay}
                                        onChange={(event) => setSchedule((prev) => ({ ...prev, timeOfDay: event.target.value }))}
                                        disabled={isAnyOperationRunning || isSavingSchedule}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Số ngày giữ bản sao</label>
                                    <Input
                                        type="number"
                                        min={1}
                                        value={schedule.retentionDays}
                                        onChange={(event) => setSchedule((prev) => ({ ...prev, retentionDays: Number(event.target.value) }))}
                                        disabled={isAnyOperationRunning || isSavingSchedule}
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                                <div className="space-y-1">
                                    <p className="font-medium text-slate-800">
                                        {schedule.enabled ? `Đang bật - ${scheduleFrequencyText} lúc ${schedule.timeOfDay}` : 'Lịch sao lưu đang tắt'}
                                    </p>
                                    <p className="text-slate-500">Lần chạy gần nhất: {lastRunText}</p>
                                </div>
                                <Button
                                    className="min-h-10 w-full sm:w-auto"
                                    onClick={handleSaveSchedule}
                                    disabled={isAnyOperationRunning || isSavingSchedule}
                                >
                                    {isSavingSchedule && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Lưu lịch sao lưu
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-amber-200 shadow-sm">
                        <CardHeader className="border-b border-amber-100 bg-amber-50/60">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <RotateCcw className="h-5 w-5 text-amber-600" />
                                        <CardTitle className="text-amber-900">Khôi phục cơ sở dữ liệu</CardTitle>
                                    </div>
                                    <CardDescription className="mt-1 text-amber-700/80">
                                        Tải lên file .dump để restore PostgreSQL.
                                    </CardDescription>
                                </div>
                                <Badge variant="warning">Cẩn trọng</Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-5 pt-5">
                            <p className="rounded-lg border border-amber-100 bg-amber-50/50 px-4 py-3 text-sm text-slate-600">
                                Chỉ dùng file backup đáng tin cậy. Dữ liệu hiện tại có thể bị ghi đè theo nội dung file.
                            </p>

                            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                        <Upload className="h-4 w-4 text-amber-600" />
                                        File sao lưu PostgreSQL
                                    </label>
                                    <Input
                                        type="file"
                                        accept=".dump"
                                        disabled={isAnyOperationRunning}
                                        onChange={(event) => setRestoreFile(event.target.files?.[0] ?? null)}
                                        className="border-amber-200 focus-visible:ring-amber-400"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                                        Nhập <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-amber-700">RESTORE</code>
                                    </label>
                                    <Input
                                        value={restoreConfirmText}
                                        onChange={(e) => setRestoreConfirmText(e.target.value)}
                                        placeholder="RESTORE"
                                        className="border-amber-200 font-mono focus-visible:ring-amber-400"
                                        disabled={isAnyOperationRunning}
                                    />
                                </div>
                            </div>

                            {restoreFile && (
                                <div className="flex items-center gap-2 rounded-lg border border-amber-100 bg-white px-3 py-2 text-sm text-slate-700">
                                    <FileArchive className="h-4 w-4 shrink-0 text-amber-600" />
                                    <span className="min-w-0 truncate">Đã chọn: <span className="font-medium">{restoreFile.name}</span></span>
                                </div>
                            )}

                            <Button
                                variant="outline"
                                className="min-h-10 w-full border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800 sm:w-auto"
                                disabled={!canRestore || isAnyOperationRunning}
                                onClick={() => setShowRestoreDialog(true)}
                            >
                                {isRestoring ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Đang khôi phục...
                                    </>
                                ) : (
                                    <>
                                        <RotateCcw className="mr-2 h-4 w-4" />
                                        Khôi phục từ bản sao lưu
                                    </>
                                )}
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="border-red-200 shadow-sm">
                        <CardHeader className="border-b border-red-100 bg-red-50/70">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <Trash2 className="h-5 w-5 text-red-600" />
                                        <CardTitle className="text-red-900">Xóa toàn bộ dữ liệu hồ sơ</CardTitle>
                                    </div>
                                    <CardDescription className="mt-1 text-red-700/80">
                                        Xóa vĩnh viễn hồ sơ, văn bản, phiếu mượn và lịch sử mượn trả.
                                    </CardDescription>
                                </div>
                                <Badge variant="destructive">Nguy hiểm</Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-5 pt-5">
                            <div className="grid gap-4 md:grid-cols-2">
                                <DataList
                                    title="Dữ liệu sẽ bị xóa"
                                    tone="danger"
                                    items={[
                                        'Tất cả hồ sơ',
                                        'Tất cả hồ sơ con / văn bản',
                                        'Tất cả phiếu mượn',
                                        'Chi tiết mượn và lịch sử mượn trả',
                                    ]}
                                />
                                <DataList
                                    title="Dữ liệu được giữ nguyên"
                                    tone="neutral"
                                    items={[
                                        'Tài khoản người dùng',
                                        'Hộp lưu trữ',
                                        'Phông lưu trữ',
                                    ]}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                                    Nhập <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-red-600">RESET</code> để xác nhận
                                </label>
                                <Input
                                    value={confirmText}
                                    onChange={(e) => setConfirmText(e.target.value)}
                                    placeholder="RESET"
                                    className="border-red-200 font-mono focus-visible:ring-red-400"
                                    disabled={isAnyOperationRunning}
                                />
                            </div>

                            <Button
                                variant="destructive"
                                className="min-h-10 w-full sm:w-auto"
                                disabled={!canConfirm || isAnyOperationRunning}
                                onClick={() => setShowDialog(true)}
                            >
                                {isResetting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Đang xóa dữ liệu...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Xóa toàn bộ dữ liệu
                                    </>
                                )}
                            </Button>
                        </CardContent>
                    </Card>

                    {result && (
                        <Card className="border-green-200 bg-green-50/60 shadow-sm">
                            <CardHeader className="pb-3">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                                    <CardTitle className="text-base text-green-800">Reset thành công</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
                                    {[
                                        { label: 'Hồ sơ đã xóa', value: result.files },
                                        { label: 'Hồ sơ con đã xóa', value: result.documents },
                                        { label: 'Mục lục hồ sơ', value: result.fileIndexes },
                                        { label: 'Phiếu mượn đã xóa', value: result.borrowSlips },
                                        { label: 'Chi tiết mượn', value: result.borrowItems },
                                        { label: 'Lịch sử mượn trả', value: result.borrowSlipEvents },
                                    ].map((item) => (
                                        <div key={item.label} className="rounded-lg border border-green-100 bg-white px-3 py-2">
                                            <p className="text-xs text-slate-500">{item.label}</p>
                                            <p className="mt-1 text-lg font-semibold text-slate-900">{item.value.toLocaleString()}</p>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </main>

                <aside className="space-y-5 lg:sticky lg:top-0 lg:self-start">
                    <Card className="border-slate-200 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-base text-slate-800">Tình trạng an toàn</CardTitle>
                            <CardDescription>Thông tin nhanh trước khi thao tác dữ liệu.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <StatusRow label="Quyền truy cập" value="SUPER_ADMIN" variant="destructive" />
                            <StatusRow label="Lịch sao lưu" value={schedule.enabled ? 'Đang bật' : 'Đang tắt'} variant={schedule.enabled ? 'success' : 'warning'} />
                            <StatusRow label="Tần suất" value={schedule.enabled ? scheduleFrequencyText : 'Chưa áp dụng'} variant="outline" />
                            <StatusRow label="Lần chạy gần nhất" value={lastRunText} variant="outline" />
                        </CardContent>
                    </Card>

                    <Card className="border-slate-200 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-base text-slate-800">Quy tắc thao tác</CardTitle>
                            <CardDescription>Checklist ngắn để giảm rủi ro khi bảo trì.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm text-slate-600">
                            <RuleItem icon={<DatabaseBackup className="h-4 w-4" />} title="Backup trước" description="Tải bản sao lưu mới trước khi restore hoặc reset." />
                            <Separator />
                            <RuleItem icon={<FileArchive className="h-4 w-4" />} title="Kiểm tra file restore" description="Chỉ dùng file .dump đáng tin cậy và đúng hệ thống." />
                            <Separator />
                            <RuleItem icon={<ShieldAlert className="h-4 w-4" />} title="Xác nhận hai lớp" description="Nhập đúng từ khóa và xác nhận ở dialog cuối." />
                        </CardContent>
                    </Card>
                </aside>
            </div>

            <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-red-700">
                            <ShieldAlert className="h-5 w-5" />
                            Xác nhận xóa toàn bộ dữ liệu?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Hành động này sẽ <strong>xóa vĩnh viễn</strong> toàn bộ hồ sơ, phiếu mượn và lịch sử hệ thống.
                            Bạn không thể hoàn tác sau khi xác nhận.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Hủy bỏ</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700"
                            onClick={handleReset}
                        >
                            Tôi hiểu, tiến hành xóa
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-amber-700">
                            <ShieldAlert className="h-5 w-5" />
                            Xác nhận khôi phục cơ sở dữ liệu?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Hành động này sẽ chạy restore PostgreSQL từ file <strong>{restoreFile?.name}</strong>.
                            Dữ liệu hiện tại có thể bị ghi đè hoặc xóa theo nội dung bản sao lưu.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Hủy bỏ</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-amber-600 hover:bg-amber-700"
                            onClick={handleRestore}
                        >
                            Tôi hiểu, tiến hành khôi phục
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

function DataList({ title, tone, items }: { title: string; tone: 'danger' | 'neutral'; items: string[] }) {
    const toneClasses = tone === 'danger'
        ? 'border-red-100 bg-red-50/50 text-red-900 marker:text-red-500'
        : 'border-slate-200 bg-slate-50/70 text-slate-700 marker:text-slate-400'

    return (
        <div className={`rounded-lg border px-4 py-3 ${toneClasses}`}>
            <p className="text-sm font-semibold">{title}</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
                {items.map((item) => (
                    <li key={item}>{item}</li>
                ))}
            </ul>
        </div>
    )
}

function StatusRow({
    label,
    value,
    variant,
}: {
    label: string
    value: string
    variant: 'destructive' | 'success' | 'warning' | 'outline'
}) {
    return (
        <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">{label}</span>
            <Badge variant={variant} className="max-w-44 truncate">
                {value}
            </Badge>
        </div>
    )
}

function RuleItem({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
    return (
        <div className="flex gap-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                {icon}
            </div>
            <div className="min-w-0">
                <p className="font-medium text-slate-800">{title}</p>
                <p className="mt-0.5 text-slate-500">{description}</p>
            </div>
        </div>
    )
}

function getDownloadFilename(contentDisposition: string | null) {
    const fallback = `court-management-${new Date().toISOString().replace(/[:.]/g, '-')}.dump`
    if (!contentDisposition) return fallback

    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
    if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1].replace(/["]/g, ''))

    const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i)
    return filenameMatch?.[1] || fallback
}
