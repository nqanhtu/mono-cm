'use client';

import { useEffect } from 'react'
import { QRCodeCanvas } from 'qrcode.react';

import { apiFetch } from '@/lib/api/client';

import { format } from 'date-fns'
import { vi } from 'date-fns/locale'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"

import { Box, Loader2, Trash2, Info, Archive, CalendarDays, Gavel, Users, Printer } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useRouter } from '@/src/lib/router'
import { useFile } from '@/lib/hooks/use-files'

import { ChildDocumentWorkspace } from './child-document-workspace'
import type { BorrowItemDto } from '@/lib/api/types'
import { EditFileDialog } from '@/components/forms/edit-file-dialog'

type BorrowItemWithSlip = BorrowItemDto & { borrowSlip: NonNullable<BorrowItemDto['borrowSlip']> }

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from 'sonner'
import { useSession } from '@/lib/hooks/use-auth'
import { can } from '@/lib/rbac'
import { queryClient } from '@/src/lib/query-client'
import { queryKeys } from '@/src/lib/query-keys'
import { getFileDetailQrUrl } from '@/lib/files/qr-url'

export function FileDetailContent({ id }: { id: string }) {
    const { file, isLoading, mutate } = useFile(id)
    const router = useRouter()
    const { session } = useSession()
    const canManageFiles = can(session?.role, 'manageFiles')
    const canManageBorrow = can(session?.role, 'manageBorrow')
    const isOwnCoordinatorFile = session?.role === 'COORDINATOR' && Boolean(file?.createdById) && file?.createdById === session.id
    const canEditFile = canManageFiles || isOwnCoordinatorFile
    const showEditButton = (canEditFile && !file?.isLocked) || session?.role === 'SUPER_ADMIN'
    const isBasicViewer = session?.role === 'BASIC_VIEWER'

    useEffect(() => {
        if (!isLoading && file) {
            const params = new URLSearchParams(window.location.search)
            const focus = params.get('focus')
            const entry = params.get('entry')

            if (focus === 'documents') {
                setTimeout(() => {
                    const element = document.getElementById('documents-card')
                    if (element) {
                        element.scrollIntoView({ behavior: 'smooth' })
                        element.classList.add('ring-2', 'ring-primary', 'ring-offset-2', 'transition-all', 'duration-500')
                        setTimeout(() => {
                            element.classList.remove('ring-2', 'ring-primary', 'ring-offset-2')
                        }, 2500)
                    }
                }, 150)
            }

            if (focus || entry) {
                setTimeout(() => {
                    window.history.replaceState({}, '', window.location.pathname)
                }, 1000)
            }
        }
    }, [isLoading, file])


    const handlePrintQr = () => {
        const canvas = document.getElementById('qr-canvas') as HTMLCanvasElement;
        if (!canvas) return;

        const dataUrl = canvas.toDataURL('image/png');
        const qrUrl = file ? getFileDetailQrUrl(file.id) : '';

        const printWindow = window.open('', '_blank', 'width=600,height=600');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                    <head>
                        <title>In mã QR - ${file?.code}</title>
                        <style>
                            body {
                                display: flex;
                                flex-direction: column;
                                align-items: center;
                                justify-content: center;
                                font-family: sans-serif;
                                margin: 0;
                                padding: 40px;
                            }
                            .qr-container {
                                text-align: center;
                                border: 2px dashed #000;
                                padding: 20px;
                                border-radius: 8px;
                                max-width: 300px;
                            }
                            img {
                                width: 150px;
                                height: 150px;
                            }
                            h2 {
                                margin: 15px 0 5px;
                                font-size: 18px;
                                font-weight: bold;
                            }
                            p {
                                margin: 0;
                                font-size: 14px;
                                color: #333;
                            }
                            .url {
                                margin-top: 10px;
                                font-size: 11px;
                                color: #666;
                                overflow-wrap: anywhere;
                            }
                            .hint {
                                margin-top: 20px;
                                font-size: 12px;
                                color: #888;
                            }
                            @media print {
                                .hint { display: none; }
                            }
                        </style>
                    </head>
                    <body>
                        <div class="qr-container">
                            <img src="${dataUrl}" />
                            <h2>${file?.code}</h2>
                            <p>${file?.title}</p>
                            <div class="url">${qrUrl}</div>
                        </div>
                        <div class="hint">Cửa sổ sẽ tự động đóng sau khi in.</div>
                        <script>
                            window.onload = () => {
                                setTimeout(() => {
                                    window.print();
                                    window.close();
                                }, 500);
                            };
                        </script>
                    </body>
                </html>
            `);
            printWindow.document.close();
        }
    }

    const handleDeleteFile = async () => {
        if (!file) return

        try {
            const response = await apiFetch(`/api/files/${file.id}`, {
                method: 'DELETE',
            })
            const result = await response.json()

            if (response.ok && result.success) {
                toast.success('Đã xóa hồ sơ')
                queryClient.invalidateQueries({ queryKey: queryKeys.files.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.files.detail(file.id) })
                queryClient.invalidateQueries({ queryKey: queryKeys.files.stats })
                queryClient.invalidateQueries({ queryKey: queryKeys.boxes.all })
                router.push('/')
                return
            }

            toast.error('Không thể xóa hồ sơ', {
                description: result.message || result.error || 'Vui lòng thử lại.',
            })
        } catch {
            toast.error('Không thể xóa hồ sơ')
        }
    }

    // Helper to format date consistent with Vietnamese format dd/MM/yyyy
    const formatDate = (date: string | Date | null | undefined, includeTime = false) => {
        if (!date) return '-'
        try {
            return format(new Date(date), includeTime ? 'dd/MM/yyyy HH:mm' : 'dd/MM/yyyy', { locale: vi })
        } catch {
            return '-'
        }
    }

    if (isLoading) {
        return (
            <div className="flex justify-center p-10">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
        )
    }

    if (!file) {
        return <div className="text-center p-10 text-muted-foreground">Không tìm thấy hồ sơ</div>
    }

    const fileQrUrl = getFileDetailQrUrl(file.id)

    return (
        <div className="space-y-6">
            {/* Header Section */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
                    <div className="shrink-0 bg-white p-2 border border-slate-200 rounded-lg shadow-sm flex flex-col items-center" title="Click chuột phải > Copy Image">
                        <QRCodeCanvas id="qr-canvas" value={fileQrUrl} size={90} level="M" includeMargin={false} />
                    </div>
                    <div className="min-w-0">
                        <h1 className="break-words text-2xl font-bold tracking-tight sm:text-3xl">{file.title}</h1>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-muted-foreground sm:gap-4">
                            <div className="flex items-center gap-1">
                                <span className="break-all font-semibold text-foreground">{file.code}</span>
                            </div>
                            <Separator orientation="vertical" className="hidden h-4 sm:block" />
                            <div className="flex items-center gap-1">
                                <CalendarDays className="h-4 w-4" />
                                <span>Năm: {file.year}</span>
                            </div>
                            <Badge variant={file.status === 'BORROWED' ? 'warning' : 'secondary'} className="ml-2">
                                {file.status === 'BORROWED' ? 'Đang mượn' : 'Lưu kho'}
                            </Badge>
                            {file.isLocked && <Badge variant="destructive" className="ml-2">Đã khóa</Badge>}
                        </div>
                    </div>
                </div>
                <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap lg:justify-end">
                    <Button variant="outline" onClick={handlePrintQr} className="w-full sm:w-auto">
                        <Printer className="h-4 w-4" />
                        In mã QR
                    </Button>
                    {showEditButton && (
                        <EditFileDialog file={file} onSuccess={() => mutate()} />
                    )}
                    {session?.role === 'SUPER_ADMIN' && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="outline" className="w-full text-destructive hover:text-destructive sm:w-auto">
                                    <Trash2 className="h-4 w-4" />
                                    Xóa hồ sơ
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Xác nhận xóa hồ sơ?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Hành động này sẽ xóa hồ sơ và toàn bộ tài liệu con nếu hồ sơ chưa có lịch sử mượn/trả.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Hủy</AlertDialogCancel>
                                    <AlertDialogAction
                                        className="bg-red-600 hover:bg-red-700"
                                        onClick={handleDeleteFile}
                                    >
                                        Xóa
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                    {canManageBorrow && file.status !== 'BORROWED' && !file.isLocked && (
                        <Button asChild className="w-full sm:w-auto">
                            <Link to={`/borrow/create?files=${file.id}`}>
                                Lập phiếu mượn
                            </Link>
                        </Button>
                    )}
                </div>
            </div>



            <Tabs defaultValue="general" className="w-full">
                <TabsList className="flex w-full justify-start overflow-x-auto lg:w-[600px]">
                    <TabsTrigger value="general" className="min-w-max flex-1">Thông tin chung</TabsTrigger>
                    {!isBasicViewer && <TabsTrigger value="storage" className="min-w-max flex-1">Lưu trữ</TabsTrigger>}
                    <TabsTrigger value="index" className="min-w-max flex-1">Mục lục hồ sơ</TabsTrigger>
                    <TabsTrigger value="borrow" className="min-w-max flex-1">Mượn trả</TabsTrigger>
                </TabsList>

                {/* General Information Tab */}
                <TabsContent value="general" className="mt-6">
                    <div className="grid gap-6 md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Info className="h-5 w-5 text-blue-500" />
                                    Thông tin cơ bản
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-4">
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-muted-foreground">Loại án</p>
                                        <p className="font-medium">{file.type}</p>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-muted-foreground">Số bản án</p>
                                        <p className="font-medium">{file.judgmentNumber || '-'}</p>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-muted-foreground">Số bút lục</p>
                                        <p className="font-medium">{file.pageCount || '-'}</p>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-muted-foreground">Thời hạn lưu trữ</p>
                                        <p className="font-medium">{file.retention || 'Vĩnh viễn'}</p>
                                    </div>
                                    {file.judgmentDate && (
                                        <div className="col-span-2">
                                            <p className="text-sm font-medium text-muted-foreground">Ngày xét xử</p>
                                            <p className="font-medium">{formatDate(file.judgmentDate)}</p>
                                        </div>
                                    )}
                                </div>
                                {file.note && (
                                    <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 border border-amber-200">
                                        <span className="font-semibold">Ghi chú: </span>
                                        {file.note}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Users className="h-5 w-5 text-indigo-500" />
                                    Đương sự
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {file.defendants && file.defendants.length > 0 && (
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-muted-foreground mb-2">Bị cáo / Bị đơn</p>
                                        <div className="flex flex-wrap gap-2">
                                            {file.defendants.map((name: string, i: number) => (
                                                <Badge key={i} variant="outline" className="text-red-600 border-red-200 bg-red-50">
                                                    {name}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {file.plaintiffs && file.plaintiffs.length > 0 && (
                                    <div className="min-w-0">
                                        <Separator className="my-3" />
                                        <p className="text-sm font-medium text-muted-foreground mb-2">Nguyên đơn / Người bị hại</p>
                                        <div className="flex flex-wrap gap-2">
                                            {file.plaintiffs.map((name: string, i: number) => (
                                                <Badge key={i} variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
                                                    {name}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {file.civilDefendants && file.civilDefendants.length > 0 && (
                                    <div className="min-w-0">
                                        <Separator className="my-3" />
                                        <p className="text-sm font-medium text-muted-foreground mb-2">Bị đơn dân sự</p>
                                        <div className="flex flex-wrap gap-2">
                                            {file.civilDefendants.map((name: string, i: number) => (
                                                <Badge key={i} variant="outline" className="text-slate-600 border-slate-200 bg-slate-50">
                                                    {name}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Storage Tab */}
                {!isBasicViewer && (
                    <TabsContent value="storage" className="mt-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Archive className="h-5 w-5 text-orange-500" />
                                    Thông tin lưu trữ
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {file.box ? (
                                    <div className="grid gap-6 md:grid-cols-2">
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50">
                                                <div className="min-w-0">
                                                    <p className="text-sm text-muted-foreground">Hộp số</p>
                                                    <p className="text-2xl font-bold">{file.box.boxNumber}</p>
                                                    <p className="text-xs text-muted-foreground">{file.box.code}</p>
                                                </div>
                                                <Box className="h-8 w-8 text-slate-300" />
                                            </div>
                                            {file.box.agency && (
                                                <div className="p-4 border rounded-lg">
                                                    <p className="text-sm text-muted-foreground mb-1">Phông lưu trữ</p>
                                                    <p className="font-semibold">{file.box.agency.name}</p>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {formatDate(file.box.agency.startDate)} -
                                                        {file.box.agency.endDate ? formatDate(file.box.agency.endDate) : 'Hiện tại'}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                            <div className="p-3 border rounded">
                                                <p className="text-xs text-muted-foreground uppercase">Kho</p>
                                                <p className="font-medium">{file.box.warehouse}</p>
                                            </div>
                                            <div className="p-3 border rounded">
                                                <p className="text-xs text-muted-foreground uppercase">Dãy</p>
                                                <p className="font-medium">{file.box.line}</p>
                                            </div>
                                            <div className="p-3 border rounded">
                                                <p className="text-xs text-muted-foreground uppercase">Kệ (Giá)</p>
                                                <p className="font-medium">{file.box.shelf}</p>
                                            </div>
                                            <div className="p-3 border rounded">
                                                <p className="text-xs text-muted-foreground uppercase">Ngăn</p>
                                                <p className="font-medium">{file.box.slot}</p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                                        Hồ sơ chưa được xếp vào hộp/vị trí lưu trữ.
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}

                {/* Index Tab */}
                <TabsContent value="index" className="mt-6">
                    {file.fileIndex ? (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Gavel className="h-5 w-5 text-purple-500" />
                                    Mục lục hồ sơ gốc
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="p-4 bg-slate-50 rounded-lg">
                                        <p className="text-sm text-muted-foreground">Tổng số bút lục</p>
                                        <p className="text-xl font-bold">{file.fileIndex.totalPage}</p>
                                    </div>
                                    <div className="p-4 bg-slate-50 rounded-lg">
                                        <p className="text-sm text-muted-foreground">Thời gian xét xử</p>
                                        <p className="text-xl font-bold">{formatDate(file.fileIndex.judgmentTime)}</p>
                                    </div>
                                </div>
                                {file.fileIndex.attachments && file.fileIndex.attachments.length > 0 && (
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium mb-2">Tài liệu đính kèm</p>
                                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                                            {file.fileIndex.attachments.map((att: string, i: number) => (
                                                <li key={i}>{att}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed">
                            <p className="text-muted-foreground">Chưa có thông tin mục lục hồ sơ gốc.</p>
                        </div>
                    )}
                </TabsContent>

                {/* Borrow Tab */}
                <TabsContent value="borrow" className="mt-6">
                    {file.borrowItems && file.borrowItems.length > 0 ? (
                        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/10">
                            <CardHeader>
                                <CardTitle className="flex items-center text-lg text-amber-700">
                                    <Box className="mr-2 h-5 w-5" />
                                    Đang mượn
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {(file.borrowItems as BorrowItemWithSlip[]).map((item) => (
                                        <div key={item.id} className="p-4 bg-white dark:bg-slate-950 rounded-lg border shadow-sm">
                                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                                <div className="min-w-0">
                                                    <p className="text-xs text-muted-foreground uppercase">Người mượn</p>
                                                    <p className="font-semibold">{item.borrowSlip.borrowerName}</p>
                                                    <p className="text-sm text-muted-foreground">{item.borrowSlip.borrowerUnit}</p>
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs text-muted-foreground uppercase">Ngày hẹn trả</p>
                                                    <p className="font-semibold text-red-600">{formatDate(item.borrowSlip.dueDate)}</p>
                                                </div>
                                            </div>
                                            {item.borrowSlip.reason && (
                                                <div className="mt-2 pt-2 border-t">
                                                    <p className="text-xs text-muted-foreground">Lý do: {item.borrowSlip.reason}</p>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed">
                            <p className="text-muted-foreground">Hồ sơ đang trong kho, chưa có phiếu mượn nào.</p>
                        </div>
                    )}
                </TabsContent>

                {/* Documents List - Always Visible */}
                {!isBasicViewer && (
                    <ChildDocumentWorkspace
                        fileId={file.id}
                        parentFileCode={file.code}
                        parentFileTitle={file.title}
                        parentYear={file.year || undefined}
                        parentRetention={file.retention || undefined}
                        documents={file.documents || []}
                        canManage={canEditFile}
                        isSuperAdmin={session?.role === 'SUPER_ADMIN'}
                        onMutate={() => mutate()}
                        entryMode={new URLSearchParams(window.location.search).get('entry') === 'create' ? 'create' : 'idle'}
                    />
                )}
            </Tabs>
        </div>
    )
}
