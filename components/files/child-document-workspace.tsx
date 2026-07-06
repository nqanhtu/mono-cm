'use client';

import { apiFetch } from '@/lib/api/client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
} from '@/components/ui/alert-dialog';
import { AutocompleteInput } from '@/components/ui/autocomplete-input';
import { useAutocompleteSuggestions } from '@/lib/hooks/use-autocomplete-suggestions';
import { cn } from '@/lib/utils';
import { FileText, Plus, Pencil, Trash2, Loader2, Keyboard, CheckCircle2, Printer, FileSpreadsheet, ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import type { DocumentDto } from '@/lib/api/types';
import { toast } from 'sonner';
import { printChildDocumentList } from '@/lib/files/print-child-documents';
import { ChildDocumentUploadModal } from './child-document-upload-modal';

export type WorkspaceMode = 'idle' | 'create' | 'edit';

export interface ChildDocumentDraft {
    id?: string;
    fileId: string;
    title: string;
    code?: string;
    year?: number;
    pageCount?: number;
    order?: number;
    note?: string;
    preservationTime?: string;
    contentIndex?: string;
}

export interface RecentChildDocument {
    id: string;
    order: number;
    title: string;
    pageCount: number;
}

type ChildDocumentEntryDraft = {
    version: 1;
    savedAt: string;
    data: ChildDocumentDraft;
};

const CHILD_DOCUMENT_DRAFT_VERSION = 1;
const CHILD_DOCUMENT_DRAFT_KEY_PREFIX = 'child-document-entry-draft:v1';
const CHILD_DOCUMENT_DRAFT_SAVE_DELAY_MS = 500;

const childDocumentDraftKeys = [
    'fileId',
    'title',
    'code',
    'contentIndex',
    'year',
    'pageCount',
    'order',
    'preservationTime',
    'note',
] as const satisfies readonly (keyof ChildDocumentDraft)[];

interface ChildDocumentWorkspaceProps {
    fileId: string;
    parentFileCode: string;
    parentFileTitle: string;
    parentYear?: number;
    parentRetention?: string;
    documents: DocumentDto[];
    canManage: boolean;
    onMutate: () => void;
    entryMode?: 'create' | 'idle';
    isSuperAdmin?: boolean;
}

function getChildDocumentDraftKey(fileId: string) {
    return `${CHILD_DOCUMENT_DRAFT_KEY_PREFIX}:${fileId}`;
}

export function extractFileNumber(code: string): string {
    if (!code) return '';
    const parts = code.split(/[-/]/);
    
    // Check the last part if it is numeric
    const lastPart = parts[parts.length - 1];
    if (lastPart && /^\d+$/.test(lastPart)) {
        return lastPart;
    }
    
    // Check the first part if it is numeric
    const firstPart = parts[0];
    if (firstPart && /^\d+$/.test(firstPart)) {
        return firstPart;
    }
    
    // Find any purely numeric part that is not a 4-digit year (unless there is only a 4-digit year)
    const numericParts = parts.filter(p => /^\d+$/.test(p));
    if (numericParts.length > 0) {
        const notYear = numericParts.find(p => p.length !== 4);
        if (notYear) return notYear;
        return numericParts[numericParts.length - 1];
    }
    
    return code;
}

function getCreateChildDocumentDraft({
    fileId,
    parentFileCode,
    parentYear,
    parentRetention,
    documents,
}: {
    fileId: string;
    parentFileCode: string;
    parentYear?: number;
    parentRetention?: string;
    documents: DocumentDto[];
}): ChildDocumentDraft {
    const nextOrder = documents.length > 0 ? Math.max(...documents.map(d => d.order || 0)) + 1 : 1;
    return {
        fileId,
        title: '',
        code: '',
        contentIndex: parentFileCode,
        year: parentYear || new Date().getFullYear(),
        pageCount: 0,
        order: nextOrder,
        preservationTime: parentRetention || '',
        note: ''
    };
}

function isChildDocumentDraftData(value: unknown): value is ChildDocumentDraft {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Record<string, unknown>;

    return childDocumentDraftKeys.every((key) => {
        if (key === 'fileId' || key === 'title') return typeof candidate[key] === 'string';
        if (key === 'year' || key === 'pageCount' || key === 'order') {
            return typeof candidate[key] === 'number' || candidate[key] === undefined;
        }
        return typeof candidate[key] === 'string' || candidate[key] === undefined;
    });
}

function parseChildDocumentEntryDraft(raw: string | null): ChildDocumentEntryDraft | null {
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== 'object') return null;

        const candidate = parsed as Record<string, unknown>;
        if (candidate.version !== CHILD_DOCUMENT_DRAFT_VERSION) return null;
        if (typeof candidate.savedAt !== 'string') return null;
        if (!isChildDocumentDraftData(candidate.data)) return null;

        return {
            version: CHILD_DOCUMENT_DRAFT_VERSION,
            savedAt: candidate.savedAt,
            data: candidate.data,
        };
    } catch {
        return null;
    }
}

function readChildDocumentEntryDraft(key: string): ChildDocumentEntryDraft | null {
    try {
        const raw = window.localStorage.getItem(key);
        const draft = parseChildDocumentEntryDraft(raw);
        if (!draft && raw) {
            window.localStorage.removeItem(key);
        }
        return draft;
    } catch {
        return null;
    }
}

function writeChildDocumentEntryDraft(key: string, data: ChildDocumentDraft) {
    const draft: ChildDocumentEntryDraft = {
        version: CHILD_DOCUMENT_DRAFT_VERSION,
        savedAt: new Date().toISOString(),
        data,
    };
    window.localStorage.setItem(key, JSON.stringify(draft));
}

function removeChildDocumentEntryDraft(key: string) {
    try {
        window.localStorage.removeItem(key);
    } catch {
        // localStorage can be unavailable in restricted browser modes.
    }
}

function isInitialChildDocumentDraft(data: ChildDocumentDraft, initialData: ChildDocumentDraft) {
    return childDocumentDraftKeys.every((key) => data[key] === initialData[key]);
}

function formatDraftSavedAt(savedAt: string) {
    const date = new Date(savedAt);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

export function ChildDocumentWorkspace({
    fileId,
    parentFileCode,
    parentFileTitle,
    parentYear,
    parentRetention,
    documents,
    canManage,
    onMutate,
    entryMode = 'idle',
    isSuperAdmin = false
}: ChildDocumentWorkspaceProps) {
    const [mode, setMode] = useState<WorkspaceMode>('idle');
    const currentInitialCreateDraft = useMemo(
        () => getCreateChildDocumentDraft({ fileId, parentFileCode, parentYear, parentRetention, documents }),
        [fileId, parentFileCode, parentYear, parentRetention, documents]
    );
    const draftKey = getChildDocumentDraftKey(fileId);
    const hasUserEditedRef = useRef(false);
    const [draft, setDraft] = useState<ChildDocumentDraft>({
        fileId,
        title: '',
        code: '',
        contentIndex: parentFileCode,
        year: parentYear || new Date().getFullYear(),
        pageCount: 0,
        order: 1,
        preservationTime: parentRetention || '',
        note: ''
    });

    const [isDirty, setIsDirty] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [recentlyAdded, setRecentlyAdded] = useState<RecentChildDocument[]>([]);
    const [highlightedRowId, setHighlightedRowId] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [pendingDraft, setPendingDraft] = useState<ChildDocumentEntryDraft | null>(null);

    const scrollToWorkspace = () => {
        setTimeout(() => {
            const el = window.document.getElementById('documents-card');
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 100);
    };

    // Synchronize entryMode URL parameter
    useEffect(() => {
        if (entryMode === 'create' && canManage) {
            setMode('create');
            hasUserEditedRef.current = false;
            setDraft(currentInitialCreateDraft);
            setIsDirty(false);
            scrollToWorkspace();
            setTimeout(() => {
                window.document.getElementById('workspace-title')?.focus();
            }, 300);
        }
    }, [entryMode, canManage, currentInitialCreateDraft]);

    useEffect(() => {
        if (!canManage) {
            setPendingDraft(null);
            return;
        }
        const savedDraft = readChildDocumentEntryDraft(draftKey);
        if (savedDraft && savedDraft.data.fileId !== fileId) {
            removeChildDocumentEntryDraft(draftKey);
            setPendingDraft(null);
            return;
        }
        setPendingDraft(savedDraft);
    }, [canManage, draftKey, fileId]);

    useEffect(() => {
        if (mode !== 'create') return;
        if (!hasUserEditedRef.current) return;
        if (isInitialChildDocumentDraft(draft, currentInitialCreateDraft)) return;

        const timeoutId = window.setTimeout(() => {
            try {
                writeChildDocumentEntryDraft(draftKey, draft);
            } catch {
                // Autosave should never interrupt sub-profile entry.
            }
        }, CHILD_DOCUMENT_DRAFT_SAVE_DELAY_MS);

        return () => window.clearTimeout(timeoutId);
    }, [currentInitialCreateDraft, draft, draftKey, mode]);

    const handleStartCreate = () => {
        hasUserEditedRef.current = false;
        setDraft(getCreateChildDocumentDraft({ fileId, parentFileCode, parentYear, parentRetention, documents }));
        setIsDirty(false);
        setMode('create');
        setSuccessMessage(null);
        scrollToWorkspace();
        setTimeout(() => {
            window.document.getElementById('workspace-title')?.focus();
        }, 100);
    };

    const handleStartEdit = (doc: DocumentDto) => {
        if (isDirty) {
            toast.warning('Vui lòng hoàn thành hoặc hủy bỏ văn bản đang nhập dở.');
            return;
        }
        hasUserEditedRef.current = false;
        setDraft({
            id: doc.id,
            fileId,
            title: doc.title || '',
            code: doc.code || '',
            contentIndex: doc.contentIndex || '',
            year: doc.year || parentYear || new Date().getFullYear(),
            pageCount: doc.pageCount || 0,
            order: doc.order || 1,
            preservationTime: doc.preservationTime || parentRetention || '',
            note: doc.note || ''
        });
        setIsDirty(false);
        setMode('edit');
        setSuccessMessage(null);
        scrollToWorkspace();
        setTimeout(() => {
            window.document.getElementById('workspace-title')?.focus();
        }, 100);
    };

    const handleDraftChange = <K extends keyof ChildDocumentDraft>(key: K, value: ChildDocumentDraft[K]) => {
        hasUserEditedRef.current = mode === 'create';
        setDraft(prev => ({ ...prev, [key]: value }));
        setIsDirty(true);
    };

    const handleCancel = () => {
        if (isDirty) {
            setShowConfirm(true);
        } else {
            setMode('idle');
            setSuccessMessage(null);
        }
    };

    const handleConfirmCancel = () => {
        if (mode === 'create') {
            removeChildDocumentEntryDraft(draftKey);
            hasUserEditedRef.current = false;
            setPendingDraft(null);
        }
        setIsDirty(false);
        setShowConfirm(false);
        setMode('idle');
        setSuccessMessage(null);
    };

    const handleRestoreDraft = () => {
        if (!pendingDraft) return;
        hasUserEditedRef.current = true;
        setDraft(pendingDraft.data);
        setMode('create');
        setIsDirty(true);
        setPendingDraft(null);
        setSuccessMessage(null);
        scrollToWorkspace();
        setTimeout(() => {
            window.document.getElementById('workspace-title')?.focus();
        }, 100);
    };

    const handleDiscardDraft = () => {
        removeChildDocumentEntryDraft(draftKey);
        hasUserEditedRef.current = false;
        setPendingDraft(null);
    };

    const handleSave = async (continueAfterSave = false) => {
        if (!draft.title.trim()) {
            toast.error('Vui lòng nhập trích yếu văn bản');
            window.document.getElementById('workspace-title')?.focus();
            return;
        }

        setIsLoading(true);
        try {
            const isEdit = mode === 'edit';
            const url = isEdit ? `/api/documents/${draft.id}` : '/api/documents';
            const method = isEdit ? 'PUT' : 'POST';

            const response = await apiFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(draft)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                toast.success(isEdit ? 'Cập nhật văn bản thành công' : 'Thêm văn bản thành công');
                if (!isEdit) {
                    removeChildDocumentEntryDraft(draftKey);
                    hasUserEditedRef.current = false;
                    setPendingDraft(null);
                }
                setIsDirty(false);
                onMutate();

                const savedId = result.document?.id || draft.id || '';
                setHighlightedRowId(savedId);
                setTimeout(() => setHighlightedRowId(null), 3000);

                if (!isEdit) {
                    const newRecent: RecentChildDocument = {
                        id: savedId,
                        order: Number(draft.order) || 1,
                        title: draft.title,
                        pageCount: Number(draft.pageCount) || 0
                    };
                    setRecentlyAdded(prev => [newRecent, ...prev].slice(0, 5));
                }

                if (!isEdit && continueAfterSave) {
                    setSuccessMessage(`Đã thêm thành công văn bản TT ${draft.order}`);
                    setDraft(prev => ({
                        fileId: prev.fileId,
                        title: '',
                        code: '',
                        contentIndex: parentFileCode,
                        year: prev.year,
                        pageCount: 0,
                        order: (prev.order || 0) + 1,
                        preservationTime: prev.preservationTime,
                        note: ''
                    }));
                    setTimeout(() => {
                        window.document.getElementById('workspace-title')?.focus();
                    }, 50);
                } else {
                    setMode('idle');
                    setSuccessMessage(null);
                }
            } else {
                toast.error(result.message || result.error || 'Lưu thất bại');
            }
        } catch (error) {
            console.error(error);
            toast.error(mode === 'create' ? 'Có lỗi xảy ra khi lưu tài liệu. Bản nháp vẫn được lưu trên thiết bị này.' : 'Có lỗi xảy ra khi lưu tài liệu');
        } finally {
            setIsLoading(false);
        }
    };

    // Keyboard trigger refs setup to comply with strict React dependencies
    const saveRef = useRef(handleSave);
    const cancelRef = useRef(handleCancel);

    useEffect(() => {
        saveRef.current = handleSave;
        cancelRef.current = handleCancel;
    });

    useEffect(() => {
        if (mode === 'idle') return;

        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (isLoading) return;

            // Ctrl/Cmd + Enter -> Lưu & thêm tiếp
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                if (mode === 'create') {
                    saveRef.current(true);
                } else {
                    saveRef.current(false);
                }
            }

            // Ctrl/Cmd + S -> Lưu và đóng
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                saveRef.current(false);
            }

            // Esc -> Hủy / Đóng
            if (e.key === 'Escape') {
                e.preventDefault();
                cancelRef.current();
            }

            // Alt + N -> Focus trích yếu
            if (e.altKey && e.key.toLowerCase() === 'n') {
                e.preventDefault();
                window.document.getElementById('workspace-title')?.focus();
            }

            // Alt + O -> Focus số thứ tự
            if (e.altKey && e.key.toLowerCase() === 'o') {
                e.preventDefault();
                window.document.getElementById('workspace-order')?.focus();
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => {
            window.removeEventListener('keydown', handleGlobalKeyDown);
        };
    }, [mode, isLoading]);

    const isWorkspaceActive = mode !== 'idle';

    const handlePrintList = () => {
        const printed = printChildDocumentList(
            { code: parentFileCode, title: parentFileTitle },
            documents
        );

        if (!printed) {
            toast.error('Không thể mở cửa sổ in. Vui lòng cho phép trình duyệt mở popup.');
        }
    };

    return (
        <Card id="documents-card" className={cn("transition-all duration-300", isWorkspaceActive && "ring-1 ring-primary/20 bg-slate-50/30")}>
            <CardHeader className="border-b pb-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle className="flex items-center text-sm font-bold">
                        <FileText className="mr-2 h-4 w-4 text-primary" />
                        Mục lục văn bản ({documents.length})
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handlePrintList}
                            disabled={documents.length === 0}
                            className="gap-1.5 h-8 text-xs font-semibold rounded-lg"
                        >
                            <Printer className="w-3.5 h-3.5" />
                            In danh sách
                        </Button>
                        {canManage && !isWorkspaceActive && (
                            <>
                                <ChildDocumentUploadModal
                                    fileId={fileId}
                                    onSuccess={onMutate}
                                    trigger={
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="gap-1.5 h-8 text-xs font-semibold rounded-lg border-dashed"
                                        >
                                            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-500" />
                                            Nhập từ Excel
                                        </Button>
                                    }
                                />
                                <Button size="sm" onClick={handleStartCreate} className="gap-1.5 h-8 text-xs font-semibold rounded-lg">
                                    <Plus className="w-3.5 h-3.5" />
                                    Thêm văn bản
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-4">
                {pendingDraft && canManage && (
                    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                        <div>
                            <p className="font-semibold">Có bản nháp hồ sơ con được lưu{formatDraftSavedAt(pendingDraft.savedAt) ? ` lúc ${formatDraftSavedAt(pendingDraft.savedAt)}` : ''}.</p>
                            <p className="text-xs text-amber-800/80 dark:text-amber-100/75">Bạn có thể khôi phục để tiếp tục nhập hoặc xóa bản nháp này.</p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                            <Button type="button" size="sm" variant="outline" onClick={handleDiscardDraft} className="h-8 bg-background text-xs">
                                Xóa bản nháp
                            </Button>
                            <Button type="button" size="sm" onClick={handleRestoreDraft} className="h-8 text-xs">
                                Khôi phục bản nháp
                            </Button>
                        </div>
                    </div>
                )}
                <TooltipProvider>
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
                        {/* Table column */}
                        <div className={cn("transition-all duration-300", isWorkspaceActive ? "lg:col-span-8" : "lg:col-span-12")}>
                            {documents.length > 0 ? (
                                <ChildDocumentTable
                                    documents={documents}
                                    canManage={canManage}
                                    isSuperAdmin={isSuperAdmin}
                                    highlightedId={highlightedRowId}
                                    onEdit={handleStartEdit}
                                    onMutate={onMutate}
                                />
                            ) : (
                                <div className={cn(
                                    "flex flex-col items-center justify-center text-center border-2 border-dashed rounded-xl",
                                    isWorkspaceActive ? "p-4 py-6 bg-muted/5" : "p-8 py-12"
                                )}>
                                    <FileText className={cn("text-muted-foreground/60 mb-2", isWorkspaceActive ? "h-7 w-7" : "h-10 w-10")} />
                                    <h3 className="text-sm font-bold text-foreground mb-1">Chưa có văn bản con</h3>
                                    <p className="text-xs text-muted-foreground max-w-sm mb-3">
                                        {isWorkspaceActive ? "Văn bản vừa lưu sẽ xuất hiện tại đây." : "Nhập văn bản con để hoàn thiện mục lục tài liệu."}
                                    </p>
                                    {canManage && !isWorkspaceActive && (
                                        <div className="flex items-center gap-2">
                                            <ChildDocumentUploadModal
                                                fileId={fileId}
                                                onSuccess={onMutate}
                                                trigger={
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        className="gap-1.5 h-8 text-xs font-semibold rounded-lg border-dashed"
                                                    >
                                                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-500" />
                                                        Nhập từ Excel
                                                    </Button>
                                                }
                                            />
                                            <Button size="sm" onClick={handleStartCreate} className="gap-1.5 h-8 text-xs font-semibold rounded-lg">
                                                <Plus className="w-3.5 h-3.5" />
                                                Thêm văn bản
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Sidebar Workspace column */}
                        {isWorkspaceActive && (
                            <div className="lg:col-span-4 lg:sticky lg:top-[90px] self-start w-full">
                                <ChildDocumentEntryPanel
                                    mode={mode}
                                    draft={draft}
                                    isLoading={isLoading}
                                    isDirty={isDirty}
                                    onDraftChange={handleDraftChange}
                                    onSave={handleSave}
                                    onCancel={handleCancel}
                                    successMessage={successMessage}
                                    recentlyAdded={recentlyAdded}
                                    onEditRecent={(item) => {
                                        let match = documents.find(d => d.id === item.id);
                                        if (!match) {
                                            match = documents.find(d => d.order === item.order && d.title === item.title);
                                        }
                                        if (match) {
                                            handleStartEdit(match);
                                        } else {
                                            toast.error('Không tìm thấy tài liệu này trong bảng mục lục');
                                        }
                                    }}
                                />
                            </div>
                        )}
                    </div>
                </TooltipProvider>
            </CardContent>

            <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
                <AlertDialogContent className="rounded-2xl max-w-[400px]">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Hủy nhập văn bản?</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm">
                            Thông tin đang nhập sẽ bị mất.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel onClick={() => setShowConfirm(false)} className="rounded-xl h-9">Tiếp tục nhập</AlertDialogCancel>
                        <AlertDialogAction variant="destructive" onClick={handleConfirmCancel} className="rounded-xl h-9">Hủy</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}

// ----------------------------------------------------
// ChildDocumentTable Component
// ----------------------------------------------------
// ChildDocumentTable Component
// ----------------------------------------------------
interface TableProps {
    documents: DocumentDto[];
    canManage: boolean;
    isSuperAdmin?: boolean;
    highlightedId: string | null;
    onEdit: (doc: DocumentDto) => void;
    onMutate: () => void;
}

function ChildDocumentTable({ documents, canManage, isSuperAdmin, highlightedId, onEdit, onMutate }: TableProps) {
    const [sortField, setSortField] = useState<'order' | 'title' | 'code' | 'year' | 'pageCount' | 'note' | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    const sortedDocuments = useMemo(() => {
        if (!sortField) return documents;
        return [...documents].sort((a, b) => {
            let valA: any = a[sortField];
            let valB: any = b[sortField];
            
            if (sortField === 'order') {
                valA = a.order ?? 0;
                valB = b.order ?? 0;
            } else if (sortField === 'pageCount') {
                valA = a.pageCount ?? 0;
                valB = b.pageCount ?? 0;
            } else {
                valA = (valA as string || '').toLowerCase();
                valB = (valB as string || '').toLowerCase();
            }
            
            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }, [documents, sortField, sortDirection]);

    const handleSort = (field: 'order' | 'title' | 'code' | 'year' | 'pageCount' | 'note') => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const renderSortIcon = (field: 'order' | 'title' | 'code' | 'year' | 'pageCount' | 'note') => {
        if (sortField !== field) {
            return <ChevronsUpDown className="ml-1 h-3.5 w-3.5 inline text-muted-foreground/50" />;
        }
        return sortDirection === 'asc' 
            ? <ArrowUp className="ml-1 h-3.5 w-3.5 inline text-foreground" />
            : <ArrowDown className="ml-1 h-3.5 w-3.5 inline text-foreground" />;
    };

    return (
        <div className="overflow-x-auto rounded-lg border">
            <Table className="w-full min-w-[650px]">
                <TableHeader className="bg-muted/30">
                    <TableRow className="hover:bg-transparent">
                        <TableHead 
                            className="w-[70px] text-xs font-semibold text-foreground py-2.5 cursor-pointer select-none hover:bg-muted/40"
                            onClick={() => handleSort('order')}
                        >
                            TT {renderSortIcon('order')}
                        </TableHead>
                        <TableHead 
                            className="w-[320px] max-w-[320px] text-xs font-semibold text-foreground py-2.5 cursor-pointer select-none hover:bg-muted/40"
                            onClick={() => handleSort('title')}
                        >
                            Trích yếu / Tên văn bản {renderSortIcon('title')}
                        </TableHead>
                        <TableHead 
                            className="text-xs font-semibold text-foreground py-2.5 cursor-pointer select-none hover:bg-muted/40"
                            onClick={() => handleSort('code')}
                        >
                            Mã VB {renderSortIcon('code')}
                        </TableHead>
                        <TableHead 
                            className="text-xs font-semibold text-foreground py-2.5 cursor-pointer select-none hover:bg-muted/40"
                            onClick={() => handleSort('year')}
                        >
                            Thời gian {renderSortIcon('year')}
                        </TableHead>
                        <TableHead 
                            className="text-right text-xs font-semibold text-foreground py-2.5 cursor-pointer select-none hover:bg-muted/40"
                            onClick={() => handleSort('pageCount')}
                        >
                            <span className="flex items-center justify-end">
                                Số tờ {renderSortIcon('pageCount')}
                            </span>
                        </TableHead>
                        <TableHead 
                            className="text-xs font-semibold text-foreground py-2.5 cursor-pointer select-none hover:bg-muted/40"
                            onClick={() => handleSort('note')}
                        >
                            Ghi chú {renderSortIcon('note')}
                        </TableHead>
                        {canManage && <TableHead className="w-[80px] py-2.5"></TableHead>}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sortedDocuments.map((doc, index) => {
                        const isHighlighted = highlightedId === doc.id;
                        return (
                            <TableRow 
                                key={doc.id} 
                                className={cn(
                                    "hover:bg-muted/20 transition-colors border-b",
                                    isHighlighted && "bg-emerald-500/10 dark:bg-emerald-500/20 animate-pulse border-emerald-500/20"
                                )}
                            >
                                <TableCell className="font-mono text-xs py-2.5 tabular-nums text-muted-foreground">{doc.order || index + 1}</TableCell>
                                <TableCell className="w-[320px] max-w-[320px] min-w-0 py-2.5">
                                    <div className="min-w-0">
                                        <div className="truncate text-xs font-semibold text-foreground" title={doc.title}>
                                            {doc.title}
                                        </div>
                                        {doc.contentIndex && (
                                            <div className="mt-1 truncate text-[10px] font-normal text-muted-foreground" title={`MLVB: ${doc.contentIndex}`}>
                                                MLVB: {doc.contentIndex}
                                            </div>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="text-xs py-2.5 font-mono">{doc.code || '-'}</TableCell>
                                <TableCell className="font-mono text-xs py-2.5 tabular-nums">{doc.year || '-'}</TableCell>
                                <TableCell className="text-right font-mono text-xs py-2.5 tabular-nums">{doc.pageCount || 0}</TableCell>
                                <TableCell className="text-muted-foreground text-xs max-w-[120px] truncate py-2.5" title={doc.note ?? undefined}>{doc.note || '-'}</TableCell>
                                {canManage && (
                                    <TableCell className="py-2.5">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button variant="ghost" size="icon" onClick={() => onEdit(doc)} className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md" aria-label="Chỉnh sửa văn bản">
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent className="text-xs">Chỉnh sửa văn bản</TooltipContent>
                                            </Tooltip>
                                            {canManage && (
                                                <ChildDocumentDeleteDialog docId={doc.id} docTitle={doc.title || ''} onMutate={onMutate} />
                                            )}
                                        </div>
                                    </TableCell>
                                )}
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}

// ----------------------------------------------------
// ChildDocumentDeleteDialog Component
// ----------------------------------------------------
function ChildDocumentDeleteDialog({ docId, docTitle, onMutate }: { docId: string; docTitle: string; onMutate: () => void }) {
    const handleDelete = async () => {
        try {
            const res = await apiFetch(`/api/documents/${docId}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                toast.success('Xóa văn bản thành công');
                onMutate();
            } else {
                toast.error('Gặp lỗi khi xóa văn bản');
            }
        } catch {
            toast.error('Gặp lỗi khi xóa văn bản');
        }
    };

    return (
        <AlertDialog>
            <Tooltip>
                <TooltipTrigger asChild>
                    <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Xóa văn bản" className="h-7 w-7 text-muted-foreground hover:text-red-600 hover:bg-red-500/10 rounded-md">
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    </AlertDialogTrigger>
                </TooltipTrigger>
                <TooltipContent className="text-xs">Xóa văn bản</TooltipContent>
            </Tooltip>
            <AlertDialogContent className="rounded-2xl max-w-[400px]">
                <AlertDialogHeader>
                    <AlertDialogTitle>Xóa văn bản?</AlertDialogTitle>
                    <AlertDialogDescription className="text-sm">
                        Hành động này không thể hoàn tác. Văn bản <span className="font-semibold text-foreground">"{docTitle}"</span> sẽ bị xóa khỏi mục lục hồ sơ.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-2">
                    <AlertDialogCancel className="rounded-xl h-9">Hủy</AlertDialogCancel>
                    <AlertDialogAction className="bg-red-600 hover:bg-red-700 rounded-xl h-9" onClick={handleDelete}>Xóa</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

// ----------------------------------------------------
// ChildDocumentEntryPanel Component
// ----------------------------------------------------
interface EntryPanelProps {
    mode: WorkspaceMode;
    draft: ChildDocumentDraft;
    isLoading: boolean;
    isDirty: boolean;
    onDraftChange: <K extends keyof ChildDocumentDraft>(key: K, value: ChildDocumentDraft[K]) => void;
    onSave: (continueAfterSave: boolean) => void;
    onCancel: () => void;
    successMessage: string | null;
    recentlyAdded?: RecentChildDocument[];
    onEditRecent?: (item: RecentChildDocument) => void;
}

function ChildDocumentEntryPanel({
    mode,
    draft,
    isLoading,
    onDraftChange,
    onSave,
    onCancel,
    successMessage,
    recentlyAdded = [],
    onEditRecent
}: EntryPanelProps) {
    const { suggestions } = useAutocompleteSuggestions();
    const isEdit = mode === 'edit';

    return (
        <div className="rounded-xl border bg-card shadow-sm flex flex-col max-h-[calc(100vh-8rem)]">
            {/* Header: static */}
            <div className="flex items-center justify-between border-b p-4 pb-3 shrink-0">
                <div>
                    <h3 className="text-xs font-bold text-foreground">
                        {isEdit ? 'Cập nhật văn bản' : 'Nhập văn bản con'}
                    </h3>
                    <p className="text-[10px] text-muted-foreground">TT hiện tại: {draft.order}</p>
                </div>
                <div className="flex items-center gap-1 text-[9px] text-muted-foreground border px-1.5 py-0.5 rounded bg-muted/40 font-mono">
                    <Keyboard className="h-3 w-3" />
                    <span>Esc: Hủy</span>
                </div>
            </div>

            {/* Scrollable Body */}
            <div className="overflow-y-auto p-4 pt-3 space-y-3 flex-grow min-h-0">
                {successMessage && (
                    <div className="flex items-center gap-1.5 p-2 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-semibold animate-fade-in border border-emerald-500/25">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        <span>{successMessage}</span>
                    </div>
                )}

                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                            <Label htmlFor="workspace-order" className="text-[10px] font-semibold text-foreground">Số thứ tự <span className="text-red-500">*</span></Label>
                            <Input
                                id="workspace-order"
                                type="number"
                                value={draft.order === 0 ? '' : draft.order}
                                onChange={(e) => onDraftChange('order', e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}
                                className="h-8 text-xs font-mono rounded-md"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="workspace-year" className="text-[10px] font-semibold text-foreground">Năm</Label>
                            <Input
                                id="workspace-year"
                                type="number"
                                value={draft.year === 0 ? '' : draft.year}
                                onChange={(e) => onDraftChange('year', e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}
                                className="h-8 text-xs font-mono rounded-md"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <Label htmlFor="workspace-title" className="text-[10px] font-semibold text-foreground">Trích yếu / Tên văn bản <span className="text-red-500">*</span></Label>
                        <AutocompleteInput
                            id="workspace-title"
                            value={draft.title}
                            suggestions={suggestions.documentTitles || []}
                            onValueChange={(val) => onDraftChange('title', val)}
                            placeholder="Nhập hoặc chọn trích yếu..."
                            className="h-8 text-xs rounded-md"
                        />
                    </div>


                    <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                            <Label htmlFor="workspace-pageCount" className="text-[10px] font-semibold text-foreground">Số tờ</Label>
                            <Input
                                id="workspace-pageCount"
                                type="number"
                                value={draft.pageCount === 0 ? '' : draft.pageCount}
                                onChange={(e) => onDraftChange('pageCount', e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}
                                className="h-8 text-xs font-mono rounded-md"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="workspace-preservationTime" className="text-[10px] font-semibold text-foreground">Bảo quản</Label>
                            <AutocompleteInput
                                id="workspace-preservationTime"
                                value={draft.preservationTime || ''}
                                suggestions={suggestions.retentions}
                                onValueChange={(val) => onDraftChange('preservationTime', val)}
                                placeholder="VD: 10 năm..."
                                className="h-8 text-xs rounded-md"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <Label htmlFor="workspace-note" className="text-[10px] font-semibold text-foreground">Ghi chú</Label>
                        <Textarea
                            id="workspace-note"
                            value={draft.note}
                            onChange={(e) => onDraftChange('note', e.target.value)}
                            className="min-h-[40px] h-10 text-xs resize-none rounded-md"
                            rows={2}
                        />
                    </div>
                </div>

                {/* Collapsible Recently Added list inside scrollable body */}
                {recentlyAdded.length > 0 && mode === 'create' && onEditRecent && (
                    <div className="pt-2 border-t mt-3">
                        <ChildDocumentRecentList items={recentlyAdded} onEdit={onEditRecent} />
                    </div>
                )}
            </div>

            {/* Sticky Action Footer */}
            <div className="border-t p-4 pt-3 pb-3 shrink-0 bg-muted/20 flex flex-wrap items-center justify-between gap-2 rounded-b-xl">
                <Button type="button" variant="outline" size="sm" onClick={onCancel} className="h-8 text-xs rounded-lg px-3.5">
                    Hủy
                </Button>
                <div className="flex items-center gap-2">
                    {!isEdit && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button 
                                    type="button" 
                                    variant="secondary" 
                                    size="sm" 
                                    disabled={isLoading}
                                    onClick={() => onSave(true)}
                                    className="h-8 text-xs rounded-lg font-semibold px-3"
                                >
                                    Lưu & tiếp <span className="text-[9px] font-normal text-muted-foreground ml-1">Ctrl+Enter</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent className="text-[10px]">Lưu và tiếp tục nhập văn bản tiếp theo (Ctrl + Enter)</TooltipContent>
                        </Tooltip>
                    )}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button 
                                type="button" 
                                size="sm" 
                                disabled={isLoading}
                                onClick={() => onSave(false)}
                                className="h-8 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-3"
                            >
                                {isLoading ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                ) : isEdit ? (
                                    'Cập nhật'
                                ) : (
                                    <>Lưu & đóng <span className="text-[9px] font-normal text-primary-foreground/70 ml-1">Ctrl+S</span></>
                                )}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent className="text-[10px]">Lưu và đóng bảng nhập (Ctrl + S)</TooltipContent>
                    </Tooltip>
                </div>
            </div>
        </div>
    );
}

// ----------------------------------------------------
// ChildDocumentRecentList Component
// ----------------------------------------------------
interface RecentProps {
    items: RecentChildDocument[];
    onEdit: (item: RecentChildDocument) => void;
}

function ChildDocumentRecentList({ items, onEdit }: RecentProps) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const displayItems = items.slice(0, 3);

    return (
        <div className="rounded-lg border bg-card p-2 shadow-sm space-y-1.5">
            <button 
                type="button"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="flex items-center justify-between w-full text-[10px] font-bold text-muted-foreground uppercase tracking-wider hover:text-foreground"
            >
                <span>Vừa thêm trong phiên ({items.length})</span>
                <span className="text-[9px] normal-case font-normal text-primary">
                    {isCollapsed ? 'Hiện' : 'Ẩn'}
                </span>
            </button>
            
            {!isCollapsed && (
                <div className="space-y-1">
                    {displayItems.map((it) => (
                        <div key={it.id || `${it.order}-${it.title}`} className="flex items-center justify-between gap-2 p-1.5 rounded border bg-muted/20 text-xs">
                            <div className="min-w-0 flex items-center gap-1.5">
                                <span className="font-mono text-[9px] text-muted-foreground shrink-0">TT {it.order}</span>
                                <span className="font-medium truncate max-w-[120px]" title={it.title}>{it.title}</span>
                                <span className="text-[9px] text-muted-foreground shrink-0 font-mono">({it.pageCount} tờ)</span>
                            </div>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => onEdit(it)} 
                                className="h-5 text-[9px] text-primary hover:bg-primary/10 font-bold px-1.5 rounded"
                            >
                                Sửa
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
