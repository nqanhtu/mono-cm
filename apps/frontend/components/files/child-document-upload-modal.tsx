'use client';

import { apiFetch } from '@/lib/api/client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { UploadCloud, Loader2, FileSpreadsheet, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChildDocumentUploadModalProps {
    fileId: string;
    trigger?: React.ReactNode;
    onSuccess?: () => void;
}

export function ChildDocumentUploadModal({ fileId, trigger, onSuccess }: ChildDocumentUploadModalProps) {
    const [open, setOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [isDragActive, setIsDragActive] = useState(false);
    const [importResult, setImportResult] = useState<{
        success: boolean;
        successCount: number;
        failureCount: number;
        errors: string[];
    } | null>(null);

    const handleOpenChange = (isOpen: boolean) => {
        setOpen(isOpen);
        if (!isOpen) {
            setFile(null);
            setImportResult(null);
            setIsDragActive(false);
        }
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setIsDragActive(true);
        } else if (e.type === 'dragleave') {
            setIsDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const droppedFile = e.dataTransfer.files[0];
            const fileExt = droppedFile.name.split('.').pop()?.toLowerCase();
            if (fileExt === 'xlsx' || fileExt === 'xls') {
                setFile(droppedFile);
                setImportResult(null);
            } else {
                toast.error('Chỉ hỗ trợ định dạng file .xlsx, .xls');
            }
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) {
            toast.error('Vui lòng chọn file');
            return;
        }

        setIsLoading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('fileId', fileId);

        try {
            const response = await apiFetch('/api/files/import-child-docs', {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();

            if (response.ok && result.success) {
                setImportResult({
                    success: true,
                    successCount: result.successCount ?? 0,
                    failureCount: result.failureCount ?? 0,
                    errors: result.errors ?? [],
                });

                if (result.failureCount === 0) {
                    toast.success(`Đã nhập thành công ${result.successCount} văn bản`);
                    setTimeout(() => {
                        setOpen(false);
                        setFile(null);
                        setImportResult(null);
                    }, 1000);
                } else {
                    toast.warning(`Đã nhập thành công ${result.successCount} văn bản, có ${result.failureCount} lỗi dòng`);
                }

                if (onSuccess) onSuccess();
            } else {
                toast.error(result.message || result.error || 'Tải lên thất bại');
            }
        } catch (error) {
            toast.error('Có lỗi xảy ra khi tải lên');
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                {trigger ? trigger : (
                    <Button size="sm" variant="outline" className="gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                        Tải lên bản kê
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="text-base font-bold text-foreground">Tải lên mục lục văn bản</DialogTitle>
                    <DialogDescription className="text-xs">
                        Nhập hàng loạt văn bản con cho hồ sơ này từ file Excel. Dữ liệu mới sẽ được thêm tiếp vào danh sách hiện tại.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleUpload} className="space-y-4 py-2">
                    <div
                        onDragEnter={handleDrag}
                        onDragOver={handleDrag}
                        onDragLeave={handleDrag}
                        onDrop={handleDrop}
                        onClick={() => document.getElementById('child-doc-upload-modal-input')?.click()}
                        className={cn(
                            "flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all duration-300 text-center relative overflow-hidden",
                            isDragActive 
                                ? "border-primary bg-primary/[0.04] dark:bg-primary/[0.06] scale-[1.01]" 
                                : "border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/30"
                        )}
                    >
                        <UploadCloud className="h-9 w-9 text-muted-foreground mb-3" />
                        <p className="text-xs font-semibold text-foreground">Bấm để chọn file hoặc kéo thả tại đây</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Chỉ hỗ trợ định dạng .xlsx, .xls</p>
                        <input
                            id="child-doc-upload-modal-input"
                            type="file"
                            accept=".xlsx, .xls"
                            className="hidden"
                            onChange={(e) => {
                                setFile(e.target.files?.[0] || null);
                                setImportResult(null);
                            }}
                        />
                    </div>

                    {/* Columns Guide */}
                    <div className="rounded-xl bg-muted/40 p-3 text-[10px] text-muted-foreground space-y-1">
                        <p className="font-bold text-foreground">Cấu trúc các cột trong file Excel:</p>
                        <ul className="list-disc pl-4 space-y-0.5 grid grid-cols-2 gap-x-2">
                            <li><span className="font-semibold text-foreground">Hồ sơ số</span> (mã HS mẹ)</li>
                            <li><span className="font-semibold text-foreground">Mục lục văn bản</span> (ký hiệu)</li>
                            <li><span className="font-semibold text-foreground text-emerald-600">Tiêu đề</span> (<span className="text-red-500">*bắt buộc</span>)</li>
                            <li><span className="font-semibold text-foreground">Thời gian</span> (năm)</li>
                            <li><span className="font-semibold text-foreground">Số tờ</span> (số nguyên)</li>
                            <li><span className="font-semibold text-foreground">Ghi chú</span></li>
                            <li><span className="font-semibold text-foreground">Thời hạn bảo quản</span></li>
                        </ul>
                    </div>

                    {file && (
                        <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 p-2.5 text-xs animate-fade-in">
                            <div className="flex items-center gap-2 min-w-0">
                                <FileSpreadsheet className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-500 shrink-0" />
                                <div className="min-w-0">
                                    <span className="font-semibold text-foreground truncate block">{file.name}</span>
                                    <span className="text-[10px] text-muted-foreground font-mono">{(file.size / 1024).toFixed(1)} KB</span>
                                </div>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setFile(null);
                                    setImportResult(null);
                                }}
                                className="h-7 text-[10px] text-destructive hover:bg-destructive/10 font-bold rounded"
                            >
                                <X className="h-3 w-3 mr-1" />
                                Xóa
                            </Button>
                        </div>
                    )}

                    {importResult && (
                        <div className="space-y-2 rounded-xl border p-3.5 bg-muted/[0.03] animate-fade-in">
                            <div className="flex flex-wrap items-center gap-1.5">
                                <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-semibold px-2 py-0.5 rounded">
                                    Thành công: {importResult.successCount}
                                </Badge>
                                {importResult.failureCount > 0 && (
                                    <Badge variant="destructive" className="text-[10px] font-semibold px-2 py-0.5 rounded">
                                        Thất bại: {importResult.failureCount}
                                    </Badge>
                                )}
                            </div>

                            {importResult.failureCount > 0 ? (
                                <div className="space-y-1">
                                    <p className="text-[10px] text-destructive font-medium flex items-center gap-1">
                                        <AlertCircle className="h-3 w-3" />
                                        Chi tiết lỗi các dòng thất bại:
                                    </p>
                                    <div className="max-h-36 overflow-y-auto rounded-lg border bg-background p-2 text-[10px] font-mono divide-y">
                                        {importResult.errors.map((err, i) => (
                                            <div key={i} className="py-1 text-destructive flex gap-2">
                                                <span className="shrink-0 text-muted-foreground"># {i + 1}</span>
                                                <span>{err}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/5 border border-emerald-500/10 p-2.5 rounded-lg flex items-center gap-2">
                                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                                    <span>Đã nhập thành công toàn bộ {importResult.successCount} văn bản con!</span>
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t mt-4">
                        <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => handleOpenChange(false)}
                            className="h-8.5 text-xs font-semibold rounded-lg"
                        >
                            Đóng
                        </Button>
                        <Button
                            type="submit"
                            disabled={isLoading || !file || (importResult !== null && importResult.failureCount === 0)}
                            className="h-8.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                    Đang nhập...
                                </>
                            ) : (
                                'Bắt đầu nhập'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
