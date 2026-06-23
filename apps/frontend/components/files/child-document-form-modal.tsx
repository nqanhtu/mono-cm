'use client';

import { apiFetch } from '@/lib/api/client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, Plus } from 'lucide-react';
import { AutocompleteInput } from '@/components/ui/autocomplete-input';
import { useAutocompleteSuggestions } from '@/lib/hooks/use-autocomplete-suggestions';


export interface DocumentFormData {
    id?: string
    fileId: string
    title: string
    code?: string
    year?: number
    pageCount?: number
    order?: number
    note?: string
    preservationTime?: string
    contentIndex?: string
}

type EditableDocument = {
    id: string
    title?: string | null
    code?: string | null
    year?: number | null
    pageCount?: number | null
    order?: number | null
    note?: string | null
    preservationTime?: string | null
    contentIndex?: string | null
}

interface ChildDocumentFormModalProps {
    fileId: string
    parentFileCode?: string
    document?: EditableDocument
    trigger?: React.ReactNode
    onSuccess?: () => void
    defaultYear?: number
    defaultOrder?: number
    defaultPreservationTime?: string
}

export function ChildDocumentFormModal({
    fileId,
    parentFileCode,
    document,
    trigger,
    onSuccess,
    defaultYear,
    defaultOrder,
    defaultPreservationTime
}: ChildDocumentFormModalProps) {
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [isDirty, setIsDirty] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [isSaveAndContinue, setIsSaveAndContinue] = useState(false)

    const { suggestions } = useAutocompleteSuggestions()
    const isEdit = !!document

    const [formData, setFormData] = useState<DocumentFormData>({
        fileId: fileId,
        title: '',
        code: '',
        contentIndex: parentFileCode || '',
        year: defaultYear || new Date().getFullYear(),
        pageCount: 0,
        order: defaultOrder || 1,
        preservationTime: defaultPreservationTime || '',
        note: ''
    })

    useEffect(() => {
        if (open) {
            setIsDirty(false)
            if (document) {
                setFormData({
                    id: document.id,
                    fileId: fileId,
                    title: document.title || '',
                    code: document.code || '',
                    contentIndex: document.contentIndex || '',
                    year: document.year || defaultYear || new Date().getFullYear(),
                    pageCount: document.pageCount || 0,
                    order: document.order || defaultOrder || 1,
                    preservationTime: document.preservationTime || defaultPreservationTime || '',
                    note: document.note || ''
                })
            } else {
                setFormData({
                    fileId: fileId,
                    title: '',
                    code: '',
                    contentIndex: parentFileCode || '',
                    year: defaultYear || new Date().getFullYear(),
                    pageCount: 0,
                    order: defaultOrder || 1,
                    preservationTime: defaultPreservationTime || '',
                    note: ''
                })
            }
        }
    }, [open, document, fileId, defaultYear, defaultOrder, defaultPreservationTime, parentFileCode])

    const handleChange = (field: keyof DocumentFormData, value: string | number | undefined) => {
        setFormData(prev => ({ ...prev, [field]: value }))
        setIsDirty(true)
    }

    const handleOpenChange = (newOpen: boolean) => {
        if (!newOpen && isDirty) {
            setShowConfirm(true)
        } else {
            setOpen(newOpen)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!formData.title.trim()) {
            toast.error('Vui lòng nhập trích yếu văn bản')
            window.document.getElementById('title')?.focus()
            return
        }

        setIsLoading(true)
        try {
            const url = isEdit ? `/api/documents/${formData.id}` : '/api/documents';
            const method = isEdit ? 'PUT' : 'POST';
            
            const response = await apiFetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            })
            const result = await response.json();
            if (result.success) {
                toast.success(isEdit ? 'Cập nhật thành công' : 'Thêm thành công')
                setIsDirty(false)
                
                if (onSuccess) onSuccess()

                if (!isEdit && isSaveAndContinue) {
                    setFormData(prev => ({
                        fileId: prev.fileId,
                        title: '',
                        code: '',
                        contentIndex: parentFileCode || '',
                        year: prev.year,
                        pageCount: 0,
                        order: (prev.order || 0) + 1,
                        preservationTime: prev.preservationTime,
                        note: ''
                    }))
                    setTimeout(() => {
                        window.document.getElementById('title')?.focus()
                    }, 50)
                } else {
                    setOpen(false)
                }
            } else {
                toast.error(result.error || (isEdit ? 'Cập nhật thất bại' : 'Thêm thất bại'))
            }
        } catch (error) {
            console.error(error)
            toast.error('Có lỗi xảy ra')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <>
            <Dialog open={open} onOpenChange={handleOpenChange}>
                <DialogTrigger asChild>
                    {trigger ? trigger : (
                        <Button size="sm" className="gap-2 text-xs font-semibold rounded-lg h-8">
                            <Plus className="w-4 h-4" />
                            Thêm văn bản
                        </Button>
                    )}
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px] rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>{isEdit ? 'Cập nhật văn bản' : 'Thêm văn bản mới'}</DialogTitle>
                        <DialogDescription className="text-xs">
                            Nhập thông tin chi tiết cho văn bản trong hồ sơ.
                        </DialogDescription>
                    </DialogHeader>
                    <form noValidate onSubmit={handleSubmit} className="space-y-4 py-2">
                        <div className="space-y-4">
                            {/* Section 1: Thông tin văn bản */}
                            <div className="space-y-3">
                                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider opacity-75">Thông tin văn bản</h4>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div className="space-y-1 col-span-2">
                                        <Label htmlFor="title" className="text-xs font-semibold text-foreground">
                                            Trích yếu / Tên văn bản <span className="text-red-500">*</span>
                                        </Label>
                                        <AutocompleteInput
                                            id="title"
                                            value={formData.title}
                                            suggestions={suggestions.documentTitles || []}
                                            onValueChange={(val) => handleChange('title', val)}
                                            placeholder="Nhập hoặc chọn trích yếu văn bản..."
                                            className="h-9 text-xs rounded-md"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Thông tin sắp xếp */}
                            <div className="space-y-3 pt-3 border-t">
                                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider opacity-75">Thông tin sắp xếp</h4>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div className="space-y-1">
                                        <Label htmlFor="year" className="text-xs font-semibold text-foreground">Năm</Label>
                                        <Input
                                            id="year"
                                            type="number"
                                            value={formData.year === 0 ? '' : formData.year}
                                            onChange={(e) => handleChange('year', parseInt(e.target.value) || 0)}
                                            className="h-9 text-xs rounded-md font-mono"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="pageCount" className="text-xs font-semibold text-foreground">Số tờ</Label>
                                        <Input
                                            id="pageCount"
                                            type="number"
                                            value={formData.pageCount === 0 ? '' : formData.pageCount}
                                            onChange={(e) => handleChange('pageCount', parseInt(e.target.value) || 0)}
                                            className="h-9 text-xs rounded-md font-mono"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="order" className="text-xs font-semibold text-foreground">Số thứ tự</Label>
                                        <Input
                                            id="order"
                                            type="number"
                                            value={formData.order === 0 ? '' : formData.order}
                                            onChange={(e) => handleChange('order', parseInt(e.target.value) || 0)}
                                            className="h-9 text-xs rounded-md font-mono"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="preservationTime" className="text-xs font-semibold text-foreground">Thời hạn bảo quản</Label>
                                        <AutocompleteInput
                                            id="preservationTime"
                                            value={formData.preservationTime || ''}
                                            suggestions={suggestions.retentions}
                                            onValueChange={(val) => handleChange('preservationTime', val)}
                                            placeholder="VD: Vĩnh viễn, 10 năm..."
                                            className="h-9 text-xs rounded-md"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Ghi chú */}
                            <div className="space-y-1 pt-3 border-t">
                                <Label htmlFor="note" className="text-xs font-semibold text-foreground">Ghi chú</Label>
                                <Textarea
                                    id="note"
                                    value={formData.note}
                                    onChange={(e) => handleChange('note', e.target.value)}
                                    className="min-h-[64px] text-xs resize-none"
                                />
                            </div>
                        </div>
                        <DialogFooter className="gap-2 pt-2 border-t mt-4">
                            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} className="h-9.5 text-xs font-semibold rounded-lg">
                                Hủy
                            </Button>
                            {!isEdit && (
                                <Button 
                                    type="submit" 
                                    variant="secondary" 
                                    disabled={isLoading}
                                    onClick={() => setIsSaveAndContinue(true)}
                                    className="h-9.5 text-xs font-semibold rounded-lg"
                                >
                                    {isLoading && isSaveAndContinue && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                                    Lưu & thêm tiếp
                                </Button>
                            )}
                            <Button 
                                type="submit" 
                                disabled={isLoading}
                                onClick={() => setIsSaveAndContinue(false)}
                                className="h-9.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                            >
                                {isLoading && !isSaveAndContinue ? (
                                    <>
                                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                                        Đang lưu...
                                    </>
                                ) : isEdit ? (
                                    'Cập nhật văn bản'
                                ) : (
                                    'Lưu văn bản'
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
                <AlertDialogContent className="rounded-2xl max-w-[400px]">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Hủy thêm văn bản?</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm">
                            Thông tin đang nhập sẽ bị mất.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel onClick={() => setShowConfirm(false)} className="rounded-xl h-9">Tiếp tục nhập</AlertDialogCancel>
                        <AlertDialogAction 
                            variant="destructive"
                            onClick={() => {
                                setIsDirty(false)
                                setShowConfirm(false)
                                setOpen(false)
                            }}
                            className="rounded-xl h-9"
                        >
                            Hủy
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
