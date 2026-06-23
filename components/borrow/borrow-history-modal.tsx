"use client";

import { apiFetch } from '@/lib/api/client';

import { useState, useEffect } from "react";
import {
    Loader2,
    History,
    Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { BorrowSlipEventDto } from "@/lib/api/types";
import { format } from "date-fns";
import { toast } from "sonner";
import Modal from "@/components/modal";

interface BorrowHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    slipId: string | null;
}

export default function BorrowHistoryModal({ isOpen, onClose, slipId }: BorrowHistoryModalProps) {
    const [borrowEvent, setBorrowEvent] = useState<(BorrowSlipEventDto & { creator: { fullName: string, username: string } | null })[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isAddingNote, setIsAddingNote] = useState(false);
    const [noteContent, setNoteContent] = useState("");
    const [isSavingNote, setIsSavingNote] = useState(false);

    useEffect(() => {
        if (isOpen && slipId) {
            const fetchBorrowEvent = async () => {
                setIsLoading(true);
                try {
                    const res = await apiFetch(`/api/borrow/${slipId}/borrow-slip-event`);
                    if (res.ok) {
                        const data = await res.json();
                        setBorrowEvent(data);
                    }
                } catch (error) {
                    console.error("Failed to fetch borrow events", error);
                    toast.error("Không thể tải lịch sử");
                } finally {
                    setIsLoading(false);
                }
            };
            fetchBorrowEvent();
        } else {
            setBorrowEvent([]); // Clear when closed or no ID
        }
    }, [isOpen, slipId]);

    const handleAddNote = async () => {
        if (!slipId) return;

        setIsSavingNote(true);
        try {
            const response = await apiFetch(`/api/borrow/${slipId}/borrow-slip-event`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    eventType: "NOTE",
                    description: noteContent,
                }),
            });

            if (response.ok) {
                toast.success("Thành công", {
                    description: "Đã thêm ghi chú",
                });
                setNoteContent("");
                setIsAddingNote(false);
                // Refresh events
                const res = await apiFetch(`/api/borrow/${slipId}/borrow-slip-event`);
                if (res.ok) {
                    const data = await res.json();
                    setBorrowEvent(data);
                }
            } else {
                toast.error("Lỗi", {
                    description: response.statusText || "Có lỗi xảy ra",
                });
            }
        } catch (error) {
            console.error(error);
            toast.error("Lỗi kết nối");
        } finally {
            setIsSavingNote(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Nhật ký phiếu mượn"
            className="max-w-xl"
        >
            <div className="flex flex-col h-[500px]">
                <div className="p-2 border-b border-slate-200 bg-white flex justify-between items-center shrink-0">
                    <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider pl-2">Dòng thời gian</h4>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setIsAddingNote(!isAddingNote)}>
                        <Plus className="w-3 h-3 mr-1" /> Thêm ghi chú
                    </Button>
                </div>

                {isAddingNote && (
                    <div className="p-3 bg-white border-b border-slate-200 animate-in slide-in-from-top-2 shrink-0">
                        <Textarea
                            value={noteContent}
                            onChange={(e) => setNoteContent(e.target.value)}
                            placeholder="Nhập ghi chú..."
                            className="mb-2 text-xs min-h-[60px]"
                        />
                        <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setIsAddingNote(false)}>Hủy</Button>
                            <Button size="sm" className="h-7 text-xs" onClick={handleAddNote} disabled={isSavingNote || !noteContent.trim()}>
                                {isSavingNote ? <Loader2 className="w-3 h-3 animate-spin" /> : "Lưu"}
                            </Button>
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-auto p-4 bg-slate-50">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                        </div>
                    ) : (
                        <ol className="relative border-s border-indigo-200 ml-3">
                            {borrowEvent.length === 0 && (
                                <li className="mb-10 ms-6 text-slate-500 text-sm italic">Chưa có nhật ký nào.</li>
                            )}
                            {borrowEvent.map((log) => (
                                <li key={log.id} className="mb-10 ms-6">
                                    <span className="absolute flex items-center justify-center w-6 h-6 bg-indigo-100 rounded-full -start-3 ring-8 ring-white">
                                        <History className="w-3 h-3 text-indigo-600" />
                                    </span>
                                    <time className="bg-slate-100 border border-slate-200 text-slate-600 text-xs font-medium px-1.5 py-0.5 rounded">
                                        {format(new Date(log.createdAt), "dd/MM/yyyy HH:mm")}
                                    </time>
                                    <h3 className="flex items-center mb-1 text-sm font-semibold text-slate-800 my-2">
                                        {log.eventType}
                                        {/* Show user if available */}
                                        {log.creator && <span className="ms-2 font-normal text-slate-500">bởi {log.creator.fullName}</span>}
                                    </h3>
                                    <div className="text-xs text-slate-600 mb-4 bg-white p-2 rounded border border-slate-100 shadow-sm">
                                        {log.description && <p className="font-medium mb-1">{log.description}</p>}
                                        <p className="truncate opacity-75">{typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}</p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    )}
                </div>
            </div>
        </Modal>
    );
}
