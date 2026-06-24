'use client';

import { apiFetch } from '@/lib/api/client';

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Loader2, Pencil } from 'lucide-react'
import type { StorageBoxDto } from '@/lib/api/types'
import { queryClient } from '@/src/lib/query-client'
import { queryKeys } from '@/src/lib/query-keys'
import { AutocompleteInput } from '@/components/ui/autocomplete-input'
import { useAutocompleteSuggestions } from '@/lib/hooks/use-autocomplete-suggestions'
import { DatePicker } from '@/components/ui/date-picker'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'


interface FileData {
    id: string
    code: string
    title: string
    type: string
    year?: number | null
    retention?: string | null
    note?: string | null
    judgmentNumber?: string | null
    judgmentDate?: string | Date | null
    pageCount?: number | null
    defendants?: string[] | null
    plaintiffs?: string[] | null
    civilDefendants?: string[] | null
    boxId?: string | null
}


interface EditFileDialogProps {
    file: FileData
    onSuccess: () => void
}

const parseStringToDate = (dateStr: string): Date | null => {
    if (!dateStr) return null
    const parts = dateStr.split("/")
    if (parts.length !== 3) return null
    const day = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10) - 1
    const year = parseInt(parts[2], 10)
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null
    const date = new Date(year, month, day)
    if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
        return date
    }
    return null
}

export function EditFileDialog({ file, onSuccess }: EditFileDialogProps) {
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [boxes, setBoxes] = useState<StorageBoxDto[]>([]);
    const { suggestions } = useAutocompleteSuggestions()

    
    const formatDateForInput = (dateVal: string | Date | null | undefined) => {
        if (!dateVal) return ''
        try {
            const date = new Date(dateVal)
            const day = String(date.getDate()).padStart(2, '0')
            const month = String(date.getMonth() + 1).padStart(2, '0')
            const year = date.getFullYear()
            return `${day}/${month}/${year}`
        } catch {
            return ''
        }
    }

    const [formData, setFormData] = useState({
        code: '',
        title: '',
        type: '',
        year: new Date().getFullYear(),
        retention: '',
        note: '',
        judgmentNumber: '',
        judgmentDate: '',
        pageCount: 0,
        defendants: '',
        plaintiffs: '',
        civilDefendants: '',
        boxId: ''
    })

    useEffect(() => {
        if (open && file) {
            setFormData({
                code: file.code || '',
                title: file.title || '',
                type: file.type || '',
                year: file.year || new Date().getFullYear(),
                retention: file.retention || '10 năm',
                note: file.note || '',
                judgmentNumber: file.judgmentNumber || '',
                judgmentDate: formatDateForInput(file.judgmentDate),
                pageCount: file.pageCount || 0,
                defendants: file.defendants ? file.defendants.join(', ') : '',
                plaintiffs: file.plaintiffs ? file.plaintiffs.join(', ') : '',
                civilDefendants: file.civilDefendants ? file.civilDefendants.join(', ') : '',
                boxId: file.boxId || ''
            })
        }
    }, [open, file])

    const handleBoxbyYear = async (year: number) => {
        if (!year) return
        try {
            const response = await apiFetch(`/api/admin/boxes?year=${year}`)
            if (response.ok) {
                const data = await response.json()
                setBoxes(data)
            } else {
                setBoxes([])
            }
        } catch (error) {
            console.error("Failed to fetch boxes", error)
            setBoxes([])
        }
    }

    const prevYearRef = useRef<number | null>(null)

    useEffect(() => {
        if (open) {
            handleBoxbyYear(formData.year)
            if (prevYearRef.current !== null && prevYearRef.current !== formData.year) {
                setFormData(prev => ({ ...prev, boxId: '' }))
            }
            prevYearRef.current = formData.year
        } else {
            prevYearRef.current = null
        }
    }, [formData.year, open])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!formData.code.trim()) {
            toast.error('Vui lòng nhập Mã hồ sơ')
            window.document.getElementById('code')?.focus()
            return
        }

        if (!formData.title.trim()) {
            toast.error('Vui lòng nhập Tiêu đề / Trích yếu')
            window.document.getElementById('title')?.focus()
            return
        }

        const yearVal = formData.year;
        if (!yearVal || isNaN(Number(yearVal))) {
            toast.error('Vui lòng nhập Năm hợp lệ')
            window.document.getElementById('year')?.focus()
            return
        }

        setIsLoading(true)

        try {
            const splitToList = (str: string) => str ? str.split(',').map(s => s.trim()).filter(Boolean) : []

            const response = await apiFetch(`/api/files/${file.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: formData.code,
                    title: formData.title,
                    type: formData.type,
                    year: formData.year,
                    retention: formData.retention,
                    note: formData.note,
                    datetime: new Date(),
                    judgmentNumber: formData.judgmentNumber,
                    judgmentDate: parseStringToDate(formData.judgmentDate),
                    pageCount: formData.pageCount,
                    defendants: splitToList(formData.defendants),
                    plaintiffs: splitToList(formData.plaintiffs),
                    civilDefendants: splitToList(formData.civilDefendants),
                    boxId: formData.boxId === 'none_clear' || !formData.boxId ? null : formData.boxId
                })
            })

            const result = await response.json();

            if (response.ok && result.success) {
                toast.success('Cập nhật hồ sơ thành công')
                queryClient.invalidateQueries({ queryKey: queryKeys.files.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.files.detail(file.id) })
                queryClient.invalidateQueries({ queryKey: queryKeys.files.stats })
                queryClient.invalidateQueries({ queryKey: queryKeys.boxes.all })
                setOpen(false)
                onSuccess()
            } else {
                toast.error('Cập nhật thất bại: ' + (result.error || 'Lỗi không xác định'))
            }
        } catch (error) {
            console.error(error)
            toast.error('Có lỗi xảy ra')
        } finally {
            setIsLoading(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault()
            handleSubmit(e)
        }
    }

    const boxOptions = [
        { value: 'none_clear', label: '--- Không xếp vào hộp ---' },
        ...boxes.map((b) => ({
            value: b.id,
            label: `${b.code} (Kệ: ${b.shelf}) ${b.agency?.name ? `- Phông: ${b.agency.name}` : ''}`
        }))
    ]

    const selectedBox = boxes.find(b => b.id === formData.boxId)
    const isRetentionLocked = !!formData.boxId && formData.boxId !== 'none_clear' && !!selectedBox?.retention


    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto">
                    <Pencil className="h-4 w-4" />
                    Chỉnh sửa
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Chỉnh sửa hồ sơ</DialogTitle>
                    <DialogDescription>
                        Cập nhật thông tin chi tiết cho hồ sơ này.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} noValidate className="flex-1 flex flex-col overflow-hidden">
                    <div className="space-y-4 overflow-y-auto px-1 py-4 flex-1">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                                <Label htmlFor="code" className="text-red-600 font-semibold">Mã hồ sơ *</Label>
                                <Input
                                    id="code"
                                    placeholder="VD: HS-001"
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                    required
                                />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="type">Loại án</Label>
                                <AutocompleteInput
                                    id="type"
                                    value={formData.type}
                                    suggestions={suggestions.types}
                                    onValueChange={(val) => setFormData({ ...formData, type: val })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="year">Năm</Label>
                                <Input
                                    id="year"
                                    type="number"
                                    value={formData.year}
                                    onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) || new Date().getFullYear() })}
                                    required
                                />
                            </div>
                        </div>

                         <div className="space-y-2">
                            <Label htmlFor="title" className="font-semibold">Tiêu đề / Trích yếu *</Label>
                            <AutocompleteInput
                                id="title"
                                placeholder="Về việc..."
                                value={formData.title}
                                suggestions={suggestions.titles}
                                onValueChange={(val) => setFormData({ ...formData, title: val })}
                                required
                            />
                        </div>

                        {/* Chi tiết án */}
                        <div className="grid grid-cols-1 gap-4 rounded-md border bg-muted/20 p-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="judgmentNumber">Số bản án</Label>
                                <Input
                                    id="judgmentNumber"
                                    placeholder="01/2024/HSST"
                                    value={formData.judgmentNumber}
                                    onChange={(e) => setFormData({ ...formData, judgmentNumber: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="judgmentDate">Ngày xét xử</Label>
                                <DatePicker
                                    id="judgmentDate"
                                    value={formData.judgmentDate}
                                    onChange={(val) => setFormData({ ...formData, judgmentDate: val })}
                                />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="defendants" className="text-red-600">Bị cáo (cách nhau bởi dấu phẩy)</Label>
                                <Input
                                    id="defendants"
                                    placeholder="Nguyen Van A, Tran Van B"
                                    value={formData.defendants}
                                    onChange={(e) => setFormData({ ...formData, defendants: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="plaintiffs" className="text-blue-600">Nguyên đơn / Người bị hại (cách nhau bởi dấu phẩy)</Label>
                                <Input
                                    id="plaintiffs"
                                    placeholder="Le Thi C"
                                    value={formData.plaintiffs}
                                    onChange={(e) => setFormData({ ...formData, plaintiffs: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="civilDefendants" className="text-orange-600">Bị đơn (cách nhau bởi dấu phẩy)</Label>
                                <Input
                                    id="civilDefendants"
                                    placeholder="Cong ty X"
                                    value={formData.civilDefendants}
                                    onChange={(e) => setFormData({ ...formData, civilDefendants: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                             <div className="space-y-2">
                                <Label htmlFor="retention">Bảo quản</Label>
                                <AutocompleteInput
                                    id="retention"
                                    placeholder="10 năm"
                                    value={formData.retention}
                                    suggestions={suggestions.retentions}
                                    onValueChange={(val) => setFormData({ ...formData, retention: val })}
                                    disabled={isRetentionLocked}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="pageCount">Số tờ</Label>
                                <Input
                                    id="pageCount"
                                    type="number"
                                    value={formData.pageCount}
                                    onChange={(e) => setFormData({ ...formData, pageCount: parseInt(e.target.value) || 0 })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="boxId">Hộp số (Mã hộp)</Label>
                            <AutocompleteInput
                                id="boxId"
                                placeholder="Tìm kiếm hộp lưu trữ..."
                                value={formData.boxId || ''}
                                suggestions={boxOptions}
                                onValueChange={(val) => {
                                    const selectedBox = boxes.find(b => b.id === val);
                                    setFormData(prev => {
                                        const nextRetention = selectedBox && selectedBox.retention 
                                            ? selectedBox.retention 
                                            : (isRetentionLocked ? '10 năm' : prev.retention);
                                        return {
                                            ...prev,
                                            boxId: val,
                                            retention: nextRetention
                                        };
                                    });
                                }}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="note">Ghi chú</Label>
                            <Textarea
                                id="note"
                                value={formData.note}
                                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                            />
                        </div>
                    </div>

                    <DialogFooter className="border-t bg-background pt-3">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Hủy
                        </Button>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button type="submit" disabled={isLoading}>
                                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Lưu thay đổi
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                Lưu thay đổi (Ctrl + Enter)
                            </TooltipContent>
                        </Tooltip>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
