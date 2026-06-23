"use client";

import { apiFetch } from '@/lib/api/client';

import { useState, useEffect } from "react";
import { Calendar, FileStack, Plus, Trash2, Printer, Loader2, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { BorrowItemDto, BorrowSlipDto, FileDto, UserDto } from "@/lib/api/types";
import { toast } from "sonner";
import { Field, FieldLabel, FieldGroup } from "../ui/field";
import { useSession } from "@/lib/hooks/use-auth";
import { buildBorrowSlipDraft, printBorrowSlip } from "@/lib/borrow/print";


interface BorrowSlipWithDetails extends BorrowSlipDto {
  lender: UserDto;
  items: (BorrowItemDto & { file: FileDto })[];
}

interface BorrowFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  initialData?: BorrowSlipWithDetails;
  slipId?: string;
  initialFiles?: FileDto[];
}

export default function BorrowForm({ onSuccess, onCancel, initialData, slipId, initialFiles = [] }: BorrowFormProps) {
  const { session } = useSession();
  const [users, setUsers] = useState<UserDto[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Form State
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [borrowerTitle, setBorrowerTitle] = useState(initialData?.borrowerTitle || "");
  /* Initialize dates with lazy initialization to avoid "setState in effect" warning */
  const [borrowDate, setBorrowDate] = useState<string>(() => {
    return initialData ? new Date(initialData.borrowDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0];
  });
  const [dueDate, setDueDate] = useState<string>(() => {
    if (initialData) return new Date(initialData.dueDate).toISOString().split("T")[0];
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    return nextWeek.toISOString().split("T")[0];
  });
  const [reason, setReason] = useState(initialData?.reason || "");

  // File State
  const [fileQuery, setFileQuery] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<FileDto[]>(() => {
    if (initialFiles && initialFiles.length > 0) return initialFiles;
    if (initialData && initialData.items) return initialData.items.map((item) => item.file);
    return [];
  });
  const [isSearchingFile, setIsSearchingFile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [fileSuggestions, setFileSuggestions] = useState<FileDto[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (initialData && users.length > 0 && !selectedUserId) {
      // Try to find the user by name since we only stored string name
      const found = users.find(u => u.fullName === initialData.borrowerName);
      if (found) setSelectedUserId(found.id);
    }
  }, [users, initialData, selectedUserId]);

  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoadingUsers(true);
      try {
        const res = await apiFetch('/api/users?purpose=borrower');
        if (res.ok) {
          const data = await res.json();
          setUsers(data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoadingUsers(false);
      }
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!fileQuery.trim()) {
        setFileSuggestions([]);
        setShowSuggestions(false);
        return;
      }
      try {
        const res = await apiFetch(`/api/files?q=${encodeURIComponent(fileQuery)}&limit=5`);
        if (res.ok) {
          const result = await res.json();
          setFileSuggestions(result.files || []);
          setShowSuggestions(true);
        }
      } catch (e) {
        console.error(e);
      }
    };

    const timeoutId = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timeoutId);
  }, [fileQuery]);

  const handleAddFile = async () => {
    if (!fileQuery.trim()) return;

    // Check if already added
    if (selectedFiles.some((f) => f.code === fileQuery || f.id === fileQuery)) {
      toast.warning("Đã thêm", {
        description: "Hồ sơ này đã có trong danh sách",
      });
      setFileQuery("");
      return;
    }

    setIsSearchingFile(true);
    // Exact match search for adding
    let result: { files: FileDto[] } = { files: [] };
    try {
      const res = await apiFetch(`/api/files?q=${encodeURIComponent(fileQuery)}&limit=1`);
      if (res.ok) {
        result = await res.json();
      }
    } catch (e) {
      console.error(e);
    }
    setIsSearchingFile(false);

    if (result.files && result.files.length > 0) {
      const file = result.files[0];
      if (file.status === "BORROWED") {
        toast.error("Không thể thêm", {
          description: `Hồ sơ ${file.code} đang được mượn`,
        });
      } else {
        setSelectedFiles((prev) => [...prev, file]);
        setFileQuery("");
      }
    } else {
      toast.error("Không tìm thấy", {
        description: "Không tìm thấy hồ sơ nào với mã này",
      });
    }
  };

  const handleSelectSuggestion = (file: FileDto) => {
    if (selectedFiles.some((f) => f.id === file.id)) {
      toast.warning("Đã thêm", {
        description: "Hồ sơ đã có trong danh sách",
      });
      return;
    }
    if (file.status === "BORROWED") {
      toast.error("Không thể thêm", {
        description: `Hồ sơ ${file.code} đang được mượn`,
      });
      return;
    }
    setSelectedFiles((prev) => [...prev, file]);
    setFileQuery("");
    setShowSuggestions(false);
  };

  const handleRemoveFile = (id: string) => {
    setSelectedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const fetchSlipDetail = async (id: string) => {
    const response = await apiFetch(`/api/borrow/${id}`);
    if (!response.ok) return null;
    return (await response.json()) as BorrowSlipWithDetails;
  };

  const handlePrintDraft = () => {
    if (!selectedUser || selectedFiles.length === 0) {
      toast.error("Chưa đủ dữ liệu in phiếu", {
        description: "Vui lòng chọn người mượn và ít nhất 1 hồ sơ",
      });
      return;
    }

    const draft = buildBorrowSlipDraft({
      borrowerName: selectedUser.fullName,
      borrowerUnit: selectedUser.unit,
      borrowerTitle,
      reason,
      borrowDate,
      dueDate,
      files: selectedFiles,
      lender: session
        ? {
            id: session.id,
            username: session.username,
            fullName: session.fullName,
            role: session.role,
            status: true,
          }
        : null,
    });

    if (!printBorrowSlip(draft, "request")) {
      toast.error("Không mở được cửa sổ in", {
        description: "Trình duyệt có thể đang chặn pop-up. Hãy cho phép pop-up cho trang này.",
      });
    }
  };

  const handleSubmit = async () => {
    if (!selectedUserId) {
      toast.error("Thiếu thông tin", {
        description: "Vui lòng chọn người mượn",
      });
      window.document.getElementById('borrower-select')?.focus();
      return;
    }

    if (selectedFiles.length === 0) {
      toast.error("Thiếu thông tin", {
        description: "Vui lòng chọn ít nhất 1 hồ sơ mượn",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const method = slipId ? 'PUT' : 'POST';
      const body = {
        id: slipId,
        borrowerName: selectedUser?.fullName || "Không xác định",
        borrowerUnit: selectedUser?.unit || "",
        borrowerTitle: borrowerTitle,
        reason: reason,
        dueDate: new Date(dueDate),
        fileIds: selectedFiles.map((f) => f.id),
      };

      const response = await apiFetch(slipId ? `/api/borrow/${slipId}` : '/api/borrow', {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (result.success) {
        const createdSlip = result.slipId ? await fetchSlipDetail(result.slipId) : null;
        toast.success("Thành công", {
          description: slipId ? "Đã cập nhật phiếu mượn" : "Đã tạo phiếu mượn thành công",
          action: createdSlip && !slipId
            ? {
                label: "In phiếu",
                onClick: () => printBorrowSlip(createdSlip, "request"),
              }
            : undefined,
        });
        onSuccess?.();
      } else {
        toast.error("Lỗi", {
          description: result.message || "Có lỗi xảy ra",
        });
      }
    } catch {
      setIsSubmitting(false);
      toast.error("Lỗi", {
        description: "Gặp lỗi khi gọi API",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedUser = users.find((u) => u.id === selectedUserId);

  return (
    <div className="flex gap-8 h-[600px]">
      {/* Left: Form Inputs */}
      <form
        className="flex-1 flex flex-col space-y-5 overflow-y-auto px-2 max-w-md w-full"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="borrower-select">Người mượn</FieldLabel>
            <Select
              value={selectedUserId}
              onValueChange={setSelectedUserId}
              disabled={isLoadingUsers}
            >
              <SelectTrigger id="borrower-select">
                <SelectValue
                  placeholder={
                    isLoadingUsers ? "Đang tải..." : "Chọn người dùng..."
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.fullName} {user.unit ? `- ${user.unit}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="borrower-title">
              Chức danh (Optional)
            </FieldLabel>
            <Input
              id="borrower-title"
              value={borrowerTitle}
              onChange={(e) => setBorrowerTitle(e.target.value)}
              placeholder="Ví dụ: Thẩm phán, Thư ký..."
            />
          </Field>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="borrow-date">Ngày mượn</FieldLabel>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
                <Input
                  id="borrow-date"
                  type="date"
                  value={borrowDate}
                  onChange={(e) => setBorrowDate(e.target.value)}
                  suppressHydrationWarning
                  className="w-full pl-9 pr-3 py-2 bg-white border-slate-200 rounded-lg text-sm focus-visible:ring-indigo-500 outline-none transition-colors"
                />
              </div>
            </Field>

            <Field>
              <FieldLabel htmlFor="due-date">Hạn trả (Dự kiến)</FieldLabel>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
                <Input
                  id="due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  suppressHydrationWarning
                  className="w-full pl-9 pr-3 py-2 bg-white border-slate-200 rounded-lg text-sm focus-visible:ring-indigo-500 outline-none transition-colors"
                />
              </div>
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="reason">Ghi chú phiếu mượn</FieldLabel>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 bg-white border-slate-200 rounded-lg text-sm focus-visible:ring-indigo-500 outline-none transition-colors h-20 resize-none"
              placeholder="Lý do mượn, ghi chú tình trạng hồ sơ..."
            />
          </Field>

          <Field orientation="horizontal" className="pt-4 justify-end gap-3 border-t border-slate-100 mt-auto">
            <Button
              type="button"
              variant="outline"
              onClick={handlePrintDraft}
              disabled={!selectedUserId || selectedFiles.length === 0}
            >
              <Printer className="w-4 h-4" /> In phiếu
            </Button>
            {onCancel && (
              <Button
                type="button"
                variant="ghost"
                onClick={onCancel}
              >
                Hủy
              </Button>
            )}
            <Button
              type="submit"
              disabled={
                isSubmitting || selectedFiles.length === 0 || !selectedUserId
              }
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Lưu phiếu mượn"
              )}
            </Button>
          </Field>
        </FieldGroup>
      </form >

      {/* Right: Selected Files List */}
      < div className="max-w-md w-full flex flex-col gap-4 border-l border-slate-100 pl-8" >
        <div className="flex items-center justify-between">
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <div
              className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-all bg-white shadow-sm text-slate-800`}
            >
              <FileText className="w-3.5 h-3.5" />
              Danh sách hồ sơ
              <span className="bg-indigo-100 text-indigo-700 px-1.5 rounded-full text-[10px]">
                {selectedFiles.length}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <FileStack className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
            <Input
              type="text"
              value={fileQuery}
              onChange={(e) => setFileQuery(e.target.value)}
              onFocus={() => fileQuery.trim() && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddFile();
                }
              }}
              disabled={isSearchingFile}
              placeholder="Nhập mã hoặc quét..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm focus:bg-white focus-visible:ring-indigo-500 outline-none transition-colors"
            />
            {showSuggestions && fileSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-60 overflow-auto">
                {fileSuggestions.map(file => (
                  <div 
                    key={file.id} 
                    className="p-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
                    onClick={() => handleSelectSuggestion(file)}
                  >
                    <div className="font-medium text-sm text-slate-800">{file.code}</div>
                    <div className="text-xs text-slate-500 truncate">{file.title}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <Button
            size="icon"
            onClick={handleAddFile}
            disabled={isSearchingFile || !fileQuery}
          >
            {isSearchingFile ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
          </Button>
        </div>

        <div className="flex-1 bg-slate-50 rounded-xl border border-slate-200 overflow-hidden flex flex-col h-full">
          <div className="flex-1 overflow-auto p-2 space-y-2">
            {selectedFiles.length === 0 && (
              <div className="text-center text-slate-400 py-10 text-sm">
                Chưa có hồ sơ nào được chọn
              </div>
            )}
            {selectedFiles.map((file) => (
              <div
                key={file.id}
                className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm flex items-start gap-3 group"
              >
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded">
                  <FileStack className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium text-slate-800 truncate"
                    title={file.title}
                  >
                    {file.title}
                  </p>
                  <p className="text-xs text-slate-500 font-mono">
                    {file.code}
                  </p>
                </div>
                <button
                  onClick={() => handleRemoveFile(file.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-slate-200 bg-white text-xs text-slate-500 text-center">
            Đã chọn {selectedFiles.length} hồ sơ
          </div>
        </div>
      </div >
    </div >
  );
}
