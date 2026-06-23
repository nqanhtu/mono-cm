'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs'
import { FilePlus } from 'lucide-react'
import { ManualFileForm } from '@/components/forms/manual-file-form'
import { ExcelUploadForm } from '@/components/forms/excel-upload-form'

interface CreateFileDialogProps {
    open?: boolean
    onOpenChange?: (open: boolean) => void
    trigger?: React.ReactNode
}

export function CreateFileDialog({ open: controlledOpen, onOpenChange: setControlledOpen, trigger }: CreateFileDialogProps = {}) {
    const [internalOpen, setInternalOpen] = useState(false)
    const isControlled = controlledOpen !== undefined

    const open = isControlled ? controlledOpen : internalOpen
    const setOpen = isControlled ? setControlledOpen : setInternalOpen

    if (!setOpen) return null 

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger ? (
                    trigger
                ) : (
                    <Button>
                        <FilePlus />
                        Thêm mới / Nhập file
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-150">
                <DialogHeader>
                    <DialogTitle>Thêm mới hồ sơ</DialogTitle>
                    <DialogDescription>
                        Tạo hồ sơ thủ công hoặc nhập hàng loạt từ file Excel.
                    </DialogDescription>
                </DialogHeader>
                <Tabs defaultValue="manual" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="manual">Thủ công</TabsTrigger>
                        <TabsTrigger value="excel">Nhập Excel</TabsTrigger>
                    </TabsList>

                    <TabsContent value="manual">
                        <ManualFileForm onSuccess={() => setOpen(false)} />
                    </TabsContent>

                    <TabsContent value="excel">
                        <ExcelUploadForm onSuccess={() => setOpen(false)} />
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    )
}
