'use client';

import { apiFetch } from '@/lib/api/client';

import { useState, useEffect, useRef } from 'react'
import { Checkbox } from '@/components/ui/checkbox'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import type { StorageBoxDto } from '@/lib/api/types'
import { queryClient } from '@/src/lib/query-client'
import { queryKeys } from '@/src/lib/query-keys'
import { AutocompleteInput } from '@/components/ui/autocomplete-input'
import { useAutocompleteSuggestions } from '@/lib/hooks/use-autocomplete-suggestions'
import { DatePicker } from '@/components/ui/date-picker'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useRouter } from '@/src/lib/router'

interface ManualFileFormProps {
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

export function ManualFileForm({ onSuccess }: ManualFileFormProps) {
    const router = useRouter()
    const submitActionRef = useRef<'save' | 'save_and_add_child'>('save')
    const [submitAction, setSubmitAction] = useState<'save' | 'save_and_add_child'>('save')
    const [isLoading, setIsLoading] = useState(false)
    const [boxes, setBoxes] = useState<StorageBoxDto[]>([]);
    const { suggestions } = useAutocompleteSuggestions()
    const codeInputRef = useRef<HTMLInputElement>(null)
    const [isSticky, setIsSticky] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('sticky_file_fields') === 'true'
        }
        return false
    })


    const [formData, setFormData] = useState({
        code: '',
        title: '',
        type: '',
        year: new Date().getFullYear(),
        retention: '10 năm',
        note: '',
        judgmentNumber: '',
        judgmentDate: '',
        pageCount: 0,
        defendants: '',
        plaintiffs: '',
        civilDefendants: '',
        boxId: ''
    })

    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        try {
            const splitToList = (str: string) => str ? str.split(',').map(s => s.trim()).filter(Boolean) : []

            const response = await apiFetch('/api/files', {
                method: 'POST',
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
                    boxId: formData.boxId || null
                })
            })

            const result = await response.json();

            if (response.ok && result.success) {
                toast.success('Tạo hồ sơ thành công')
                queryClient.invalidateQueries({ queryKey: queryKeys.files.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.files.stats })
                queryClient.invalidateQueries({ queryKey: queryKeys.boxes.all })

                const fileId = result.file?.id

                // Reset form
                if (isSticky) {
                    setFormData(prev => ({
                        code: '',
                        title: '',
                        type: prev.type,
                        year: prev.year,
                        retention: prev.retention,
                        note: '',
                        judgmentNumber: '',
                        judgmentDate: '',
                        pageCount: 0,
                        defendants: '',
                        plaintiffs: '',
                        civilDefendants: '',
                        boxId: prev.boxId
                    }))
                    setTimeout(() => {
                        codeInputRef.current?.focus()
                    }, 50)
                } else {
                    setFormData({
                        code: '',
                        title: '',
                        type: '',
                        year: new Date().getFullYear(),
                        retention: '10 năm',
                        note: '',
                        judgmentNumber: '',
                        judgmentDate: '',
                        pageCount: 0,
                        defendants: '',
                        plaintiffs: '',
                        civilDefendants: '',
                        boxId: ''
                    })
                }
                onSuccess()
                if (submitActionRef.current === 'save_and_add_child' && fileId) {
                    router.push(`/files/${fileId}`)
                }
            } else {
                toast.error('Tạo thất bại: ' + (result.message || result.error || 'Lỗi không xác định'))
            }
        } catch (error) {
            console.error(error)
            toast.error('Có lỗi xảy ra')
        } finally {
            setIsLoading(false)
        }
    }

    const handleBoxbyYear = async (year: number) => {
        if (!year) return
        try {
            const response = await apiFetch(`/api/admin/boxes?year=${year}`)
            if (response.ok) {
                const data = await response.json()
                console.log(data);
                setBoxes(data)
            } else {
                setBoxes([])
            }
        } catch (error) {
            console.error("Failed to fetch boxes", error)
            setBoxes([])
        }
    }

    const prevYearRef = useRef<number>(formData.year)

    useEffect(() => {
        handleBoxbyYear(formData.year)
        if (prevYearRef.current !== formData.year) {
            setFormData(prev => ({ ...prev, boxId: '' }))
            prevYearRef.current = formData.year
        }
    }, [formData.year])

    const boxOptions = boxes.map((b) => ({
        value: b.id,
        label: `${b.code} (Kệ: ${b.shelf}) ${b.agency?.name ? `- Phông: ${b.agency.name}` : ''}`
    }))

    const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault()
            submitActionRef.current = 'save'
            setSubmitAction('save')
            handleManualSubmit(e)
        }
    }

    return (
        <form onSubmit={handleManualSubmit} onKeyDown={handleKeyDown} className="flex max-h-[70vh] flex-col overflow-hidden">
            <div className="space-y-4 overflow-y-auto px-1 py-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                        <Label htmlFor="code" className="text-red-600 font-semibold">Mã hồ sơ *</Label>
                        <Input
                            ref={codeInputRef}
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
                            onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
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
                        <Label htmlFor="judgmentNumber">Số bản án/Quyết định</Label>
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
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="pageCount">Số bút lục</Label>
                        <Input
                            id="pageCount"
                            type="number"
                            value={formData.pageCount}
                            onChange={(e) => setFormData({ ...formData, pageCount: parseInt(e.target.value || '0') })}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="boxId">Hộp số (Mã hộp)</Label>
                    <AutocompleteInput
                        id="boxId"
                        placeholder="Tìm kiếm hộp lưu trữ..."
                        value={formData.boxId}
                        suggestions={boxOptions}
                        onValueChange={(val) => setFormData({ ...formData, boxId: val })}
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

            <div className="flex items-center space-x-2 py-3 px-1 border-t mt-4">
                <Checkbox
                    id="sticky"
                    checked={isSticky}
                    onCheckedChange={(checked) => {
                        setIsSticky(!!checked)
                        localStorage.setItem('sticky_file_fields', String(checked))
                    }}
                />
                <Label htmlFor="sticky" className="text-sm font-medium cursor-pointer text-muted-foreground">
                    Nhập liên tục (Giữ lại Loại án, Năm, Bảo quản và Hộp số)
                </Label>
            </div>

            <DialogFooter className="border-t bg-background px-1 py-3 flex items-center justify-end gap-2">
                <Button
                    type="submit"
                    variant="outline"
                    disabled={isLoading}
                    onClick={() => {
                        submitActionRef.current = 'save_and_add_child'
                        setSubmitAction('save_and_add_child')
                    }}
                >
                    {isLoading && submitAction === 'save_and_add_child' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Lưu và thêm hồ sơ con
                </Button>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            type="submit"
                            disabled={isLoading}
                            onClick={() => {
                                submitActionRef.current = 'save'
                                setSubmitAction('save')
                            }}
                        >
                            {isLoading && submitAction === 'save' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Lưu hồ sơ
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        Lưu hồ sơ (Ctrl + Enter)
                    </TooltipContent>
                </Tooltip>
            </DialogFooter>
        </form>
    )
}
