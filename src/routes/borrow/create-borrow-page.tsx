'use client';

import { apiFetch } from '@/lib/api/client';

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from '@/src/lib/router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
// cleaned import
import { toast } from 'sonner'
import { CalendarIcon, Loader2 } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

function CreateBorrowContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const filesParam = searchParams.get('files') || ''
    const fileIds = filesParam.split(',').filter(Boolean)

    const [isLoading, setIsLoading] = useState(false)
    const [date, setDate] = useState<Date>()

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        if (!date) {
            toast.error('Vui lòng chọn hạn trả')
            return
        }
        if (fileIds.length === 0) {
            toast.error('Không có hồ sơ nào được chọn')
            return
        }

        setIsLoading(true)
        const formData = new FormData(e.currentTarget)

        // Mock user ID (Lender)
        // For this prototype, I'll pass a known ID or handle it in the action.

        try {
            const response = await apiFetch('/api/borrow', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    borrowerName: formData.get('borrowerName') as string,
                    borrowerUnit: formData.get('borrowerUnit') as string,
                    borrowerTitle: formData.get('borrowerTitle') as string,
                    reason: formData.get('reason') as string,
                    dueDate: date,
                    fileIds
                }),
            })
            const res = await response.json()

            if (res.success) {
                toast.success('Tạo phiếu mượn thành công')
                router.push('/')
            } else {
                toast.error(res.message)
            }
        } catch {
            toast.error('Lỗi hệ thống')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="container mx-auto py-10 max-w-lg">
            <Card>
                <CardHeader>
                    <CardTitle>Lập Phiếu Mượn</CardTitle>
                    <CardDescription>
                        Đang tạo phiếu cho {fileIds.length} hồ sơ.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={onSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="borrowerName">Người mượn</Label>
                            <Input id="borrowerName" name="borrowerName" required placeholder="Họ và tên" />
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="borrowerUnit">Đơn vị / Phòng ban</Label>
                                <Input id="borrowerUnit" name="borrowerUnit" placeholder="Tòa Hình sự..." />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="borrowerTitle">Chức danh</Label>
                                <Input id="borrowerTitle" name="borrowerTitle" placeholder="Thẩm phán..." />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="reason">Lý do mượn</Label>
                            <Textarea id="reason" name="reason" placeholder="Nghiên cứu hồ sơ vụ án..." />
                        </div>

                        <div className="space-y-2 flex flex-col">
                            <Label>Hạn trả</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full pl-3 text-left font-normal",
                                            !date && "text-muted-foreground"
                                        )}
                                    >
                                        {date ? format(date, "PPP") : <span>Chọn ngày</span>}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={date}
                                        onSelect={setDate}
                                        disabled={(date) =>
                                            date < new Date() || date < new Date("1900-01-01")
                                        }
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Tạo phiếu
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}

export default function CreateBorrowPage() {
    return (
        <Suspense fallback={<div className="container mx-auto py-10 text-center">Đang tải...</div>}>
            <CreateBorrowContent />
        </Suspense>
    )
}
