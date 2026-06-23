'use client';

import { QRCodeCanvas } from 'qrcode.react';

import { useCallback, useState, useEffect } from "react";
import { useRouter } from '@/src/lib/router';
import { useSession } from "@/lib/hooks/use-auth";
import type { StorageBoxDto } from "@/lib/api/types";
import { useDeleteStorageBox, useStorageBoxes } from "@/lib/hooks/use-storage-boxes";
import { 
  Archive, 
  MapPin, 
  Calendar, 
  Building2, 
  Hash, 
  Search, 
  Plus, 
  MoreHorizontal, 
  Pencil, 
  Trash2, 
  Loader2,
  FolderOpen,
  Printer,
  QrCode,
  Warehouse
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

import { DataToolbar } from "@/components/common/data-toolbar";
import { PrintActionButton } from "@/components/common/print-action-button";
import { StorageBoxDialog } from "@/components/forms/storage-box-dialog";
import { StorageLayoutCanvas } from "@/components/storage-layout/storage-layout-canvas";
import { printStorageBoxLabels, type StorageBoxLabelPrintItem } from "@/lib/storage-box/print-labels";
import { useStorageLayout } from "@/lib/hooks/use-storage-layout";
import { DataPageShell, TableSurface } from "@/components/common/data-page-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function StorageBoxesPage() {
  const router = useRouter();
  const { session, isLoading: isSessionLoading } = useSession();

  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const canLoadBoxes = session?.role === "SUPER_ADMIN";
  const { boxes, isLoading } = useStorageBoxes({ search, year: yearFilter }, canLoadBoxes);
  const { layout: storageLayout, isLoading: isLayoutLoading } = useStorageLayout(canLoadBoxes);
  const deleteStorageBox = useDeleteStorageBox();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedBox, setSelectedBox] = useState<StorageBoxDto | null>(null);
  const [boxToDelete, setBoxToDelete] = useState<StorageBoxDto | null>(null);
  const [selectedBoxIds, setSelectedBoxIds] = useState<Set<string>>(new Set());
  const [labelPreviewBoxes, setLabelPreviewBoxes] = useState<StorageBoxDto[]>([]);

  // Authenticate SUPER_ADMIN
  useEffect(() => {
    document.title = "Quản lý Hộp lưu trữ | Court Management";
  }, []);

  useEffect(() => {
    if (!isSessionLoading && (!session || session.role !== "SUPER_ADMIN")) {
      router.replace("/forbidden");
    }
  }, [session, isSessionLoading, router]);

  useEffect(() => {
    setSelectedBoxIds((current) => new Set([...current].filter((id) => boxes.some((box) => box.id === id))));
  }, [boxes]);

  const handleDelete = async () => {
    if (!boxToDelete) return;

    // Direct check client-side just in case
    const filesCount = boxToDelete._count?.files || 0;
    if (filesCount > 0) {
      toast.error(`Không thể xóa: Hộp hiện đang chứa ${filesCount} hồ sơ.`);
      setBoxToDelete(null);
      return;
    }

    try {
      await deleteStorageBox.mutateAsync(boxToDelete.id);
      toast.success("Xóa hộp lưu trữ thành công");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Xóa thất bại. Vui lòng thử lại");
    } finally {
      setBoxToDelete(null);
    }
  };

  const getBoxQrUrl = useCallback((box: StorageBoxDto) => {
    if (typeof window === "undefined") return `/qr/boxes/${box.id}`;
    return `${window.location.origin}/qr/boxes/${box.id}`;
  }, []);

  const getBoxQrDataUrl = (box: StorageBoxDto) => {
    const canvas = document.getElementById(`storage-box-preview-qr-${box.id}`) as HTMLCanvasElement | null;
    return canvas?.toDataURL("image/png") || null;
  };

  const toPrintItems = (targetBoxes: StorageBoxDto[]) => {
    const items: StorageBoxLabelPrintItem[] = [];
    for (const box of targetBoxes) {
      const qrDataUrl = getBoxQrDataUrl(box);
      if (!qrDataUrl) continue;
      items.push({ box, qrDataUrl, qrUrl: getBoxQrUrl(box) });
    }
    return items;
  };

  const handlePrintLabels = (targetBoxes: StorageBoxDto[], mode: "single" | "grid") => {
    if (targetBoxes.length === 0) {
      toast.warning("Chưa có hộp lưu trữ để in nhãn");
      return;
    }

    const items = toPrintItems(targetBoxes);
    if (items.length === 0) {
      toast.error("Chưa tạo được ảnh QR", {
        description: "Vui lòng thử lại sau khi danh sách hộp tải xong.",
      });
      return;
    }

    if (!printStorageBoxLabels(items, mode)) {
      toast.error("Không mở được cửa sổ in", {
        description: "Trình duyệt có thể đang chặn pop-up. Hãy cho phép pop-up cho trang này.",
      });
    }
  };

  const openLabelPreview = (targetBoxes: StorageBoxDto[]) => {
    if (targetBoxes.length === 0) {
      toast.warning("Chưa có hộp lưu trữ để in nhãn");
      return;
    }
    setLabelPreviewBoxes(targetBoxes);
  };

  const toggleBoxSelection = (boxId: string, checked: boolean) => {
    setSelectedBoxIds((current) => {
      const next = new Set(current);
      if (checked) next.add(boxId);
      else next.delete(boxId);
      return next;
    });
  };

  const visibleBoxIds = boxes.map((box) => box.id);
  const selectedVisibleBoxes = boxes.filter((box) => selectedBoxIds.has(box.id));
  const allVisibleSelected = visibleBoxIds.length > 0 && visibleBoxIds.every((id) => selectedBoxIds.has(id));
  const someVisibleSelected = visibleBoxIds.some((id) => selectedBoxIds.has(id));

  if (isSessionLoading) {
    return (
      <div className="flex h-full items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session || session.role !== "SUPER_ADMIN") {
    return null;
  }

  return (
    <>
    <DataPageShell
      toolbar={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between w-full">
          <div>
            <h1 className="text-xl font-bold text-foreground">Quản lý Hộp lưu trữ</h1>
            <p className="text-xs text-muted-foreground">Theo dõi và bố trí vị trí vật lý của các hộp hồ sơ.</p>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Search & Filters */}
        <DataToolbar>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm theo mã hộp, kho, dãy, kệ, ngăn..."
              className="pl-9 h-9.5 rounded-lg border-input/60"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-48 relative">
            <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Lọc theo năm..."
              type="number"
              className="pl-9 h-9.5 rounded-lg border-input/60"
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
            />
          </div>
          {(search || yearFilter) && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearch("");
                setYearFilter("");
              }}
              className="h-9.5 rounded-lg text-xs"
            >
              Xóa bộ lọc
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => openLabelPreview(selectedVisibleBoxes.length > 0 ? selectedVisibleBoxes : boxes)}
            disabled={boxes.length === 0}
            className="h-9.5 rounded-lg"
            title={selectedVisibleBoxes.length > 0 ? "In các hộp đã chọn" : "In tất cả hộp trong kết quả lọc"}
          >
            <Printer className="h-4 w-4" />
            In nhiều nhãn
            {selectedVisibleBoxes.length > 0 && (
              <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px]">{selectedVisibleBoxes.length}</span>
            )}
          </Button>
          <Button
            onClick={() => {
              setSelectedBox(null);
              setIsDialogOpen(true);
            }}
            className="h-9.5 rounded-lg flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Plus className="h-4 w-4" /> Thêm hộp mới
          </Button>
        </DataToolbar>

        <Tabs defaultValue="list" className="space-y-4">
          <TabsList className="bg-muted/30 p-1 rounded-lg w-max">
            <TabsTrigger value="list" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded-md">
              <Archive className="h-3.5 w-3.5" />
              Danh sách
            </TabsTrigger>
            <TabsTrigger value="layout" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded-md">
              <Warehouse className="h-3.5 w-3.5" />
              Sơ đồ kho
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list">
            {/* Data Table */}
            <TableSurface>
              <Table>
                <TableHeader className="bg-muted/10">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                        onCheckedChange={(checked) => {
                          setSelectedBoxIds((current) => {
                            const next = new Set(current);
                            if (Boolean(checked)) visibleBoxIds.forEach((id) => next.add(id));
                            else visibleBoxIds.forEach((id) => next.delete(id));
                            return next;
                          });
                        }}
                        aria-label="Chọn tất cả hộp đang hiển thị"
                      />
                    </TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider py-2 text-foreground">Mã QR / Hộp</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider py-2 text-foreground">Vị trí vật lý</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider py-2 text-foreground">Phông lưu trữ</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider py-2 text-foreground text-center">Năm</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider py-2 text-foreground text-center">Thời hạn</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider py-2 text-foreground text-center">Hồ sơ</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider py-2 text-foreground text-right pr-6 w-[120px]">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={8} className="h-32 text-center">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                          <span className="text-xs text-muted-foreground">Đang tải danh sách hộp lưu trữ...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : boxes.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={8} className="h-32 text-center">
                        <div className="flex flex-col items-center justify-center gap-1 text-muted-foreground">
                          <Archive className="h-8 w-8 opacity-40 mb-1" />
                          <span className="text-sm font-medium">Không tìm thấy hộp lưu trữ nào</span>
                          <span className="text-xs opacity-85">Thử thay đổi bộ lọc tìm kiếm hoặc thêm hộp mới.</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    boxes.map((box) => {
                      const filesCount = box._count?.files || 0;
                      return (
                        <TableRow key={box.id} className="hover:bg-muted/30 transition-colors group">
                          <TableCell>
                            <Checkbox
                              checked={selectedBoxIds.has(box.id)}
                              onCheckedChange={(checked) => toggleBoxSelection(box.id, Boolean(checked))}
                              aria-label={`Chọn hộp ${box.code}`}
                            />
                          </TableCell>
                          {/* Code / QR Code */}
                          <TableCell className="py-2.5">
                            <div className="flex flex-col gap-1">
                              <span className="font-mono text-sm font-bold tracking-wide text-foreground group-hover:text-primary transition-colors">
                                {box.code}
                              </span>
                              {box.caseType && (
                                <span className="text-[10px] text-muted-foreground bg-muted/60 dark:bg-muted/20 px-1.5 py-0.5 rounded w-max font-medium">
                                  {box.caseType}
                                </span>
                              )}
                            </div>
                          </TableCell>

                          {/* Coordinates / Map Pin */}
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                              <div className="flex items-center gap-1 text-xs font-semibold text-foreground">
                                <span className="bg-muted px-1.5 py-0.5 rounded text-[11px]" title="Kho">{box.warehouse}</span>
                                <span className="text-muted-foreground font-normal">→</span>
                                <span className="bg-muted px-1.5 py-0.5 rounded text-[11px]" title="Dãy">{box.line}</span>
                                <span className="text-muted-foreground font-normal">→</span>
                                <span className="bg-muted px-1.5 py-0.5 rounded text-[11px]" title="Kệ">{box.shelf}</span>
                                <span className="text-muted-foreground font-normal">→</span>
                                <span className="bg-muted px-1.5 py-0.5 rounded text-[11px]" title="Ngăn">{box.slot}</span>
                                <span className="text-muted-foreground font-normal">→</span>
                                <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[11px]" title="Hộp">{box.boxNumber}</span>
                              </div>
                            </div>
                          </TableCell>

                          {/* Linked Agency History */}
                          <TableCell>
                            {box.agency ? (
                              <div className="flex items-center gap-1.5">
                                <Building2 className="h-3.5 w-3.5 text-sky-600" />
                                <span className="text-xs font-medium text-foreground max-w-[200px] truncate">
                                  {box.agency.name}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">Chưa phân phối</span>
                            )}
                          </TableCell>

                          {/* Retention Year */}
                          <TableCell className="text-center">
                            <span className="text-xs font-medium text-foreground">
                              {box.year || "—"}
                            </span>
                          </TableCell>

                          {/* Retention Period Label */}
                          <TableCell className="text-center">
                            {box.retention ? (
                              <Badge variant="outline" className="text-xs font-medium bg-muted/30 border-muted">
                                {box.retention}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>

                          {/* File Counter and Range */}
                          <TableCell className="text-center">
                            <div className="flex flex-col items-center gap-1">
                              <Badge 
                                variant={filesCount > 0 ? "secondary" : "outline"} 
                                className={`text-xs gap-1 ${
                                  filesCount > 0 
                                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 border-emerald-200 dark:border-emerald-900" 
                                    : "text-muted-foreground"
                                }`}
                              >
                                <FolderOpen className="h-3 w-3" />
                                {filesCount}
                              </Badge>
                              {(box.fromFileCode || box.toFileCode) && (
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  [{box.fromFileCode || "?"} - {box.toFileCode || "?"}]
                                </span>
                              )}
                            </div>
                          </TableCell>

                          {/* Action drop-down menu */}
                          <TableCell className="text-right pr-6">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  className="h-8 w-8 p-0 rounded-lg group-hover:bg-muted/80"
                                  aria-label={`Mở thao tác hộp ${box.code}`}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-[160px] rounded-xl shadow-lg border">
                                <DropdownMenuLabel className="text-xs text-muted-foreground">Lựa chọn</DropdownMenuLabel>
                                <DropdownMenuItem
                                  onClick={() => openLabelPreview([box])}
                                  className="text-xs cursor-pointer flex items-center gap-2 focus:bg-blue-50 focus:text-blue-600 dark:focus:bg-blue-950/50 dark:focus:text-blue-400"
                                >
                                  <Printer className="h-3.5 w-3.5" /> In nhãn
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => window.open(getBoxQrUrl(box), "_blank")}
                                  className="text-xs cursor-pointer flex items-center gap-2 focus:bg-emerald-50 focus:text-emerald-600 dark:focus:bg-emerald-950/50 dark:focus:text-emerald-400"
                                >
                                  <QrCode className="h-3.5 w-3.5" /> Mở QR
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => {
                                    setSelectedBox(box);
                                    setIsDialogOpen(true);
                                  }}
                                  className="text-xs cursor-pointer flex items-center gap-2 focus:bg-amber-50 focus:text-amber-600 dark:focus:bg-amber-950/50 dark:focus:text-amber-400"
                                >
                                  <Pencil className="h-3.5 w-3.5" /> Chỉnh sửa
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  className={`text-xs cursor-pointer flex items-center gap-2 ${
                                    filesCount > 0 
                                      ? "text-muted-foreground opacity-50 cursor-not-allowed" 
                                      : "text-destructive focus:bg-destructive/10 focus:text-destructive dark:focus:bg-destructive/20"
                                  }`}
                                  onClick={() => {
                                    if (filesCount > 0) {
                                      toast.warning(`Không thể xóa hộp lưu trữ vì đang có hồ sơ liên kết. Vui lòng di chuyển hồ sơ đi trước.`);
                                      return;
                                    }
                                    setBoxToDelete(box);
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" /> Xoá hộp
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableSurface>
          </TabsContent>

          <TabsContent value="layout">
            <StorageLayoutCanvas
              savedLayout={storageLayout}
              isLoadingLayout={isLayoutLoading}
              tableSearch={search}
              yearFilter={yearFilter}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DataPageShell>

      <Dialog open={labelPreviewBoxes.length > 0} onOpenChange={(open) => !open && setLabelPreviewBoxes([])}>
        <DialogContent className="sm:max-w-3xl lg:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Xem trước nhãn QR hộp lưu trữ</DialogTitle>
            <DialogDescription>
              Đang chuẩn bị {labelPreviewBoxes.length} nhãn. QR chỉ được render cho các hộp trong lần in này.
            </DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[60vh] gap-4 overflow-auto pr-1 sm:grid-cols-2">
            {labelPreviewBoxes.map((box) => (
              <div key={box.id} className="min-w-0 rounded-lg border bg-background p-4">
                <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-4">
                  <QRCodeCanvas
                    id={`storage-box-preview-qr-${box.id}`}
                    value={getBoxQrUrl(box)}
                    size={112}
                    level="M"
                    includeMargin
                    className="shrink-0 rounded bg-white"
                  />
                  <div className="min-w-0 space-y-1 text-sm leading-5">
                    <div className="break-words font-mono font-bold leading-5">{box.code}</div>
                    <div className="break-words text-muted-foreground">{[box.warehouse, box.line, box.shelf, box.slot, box.boxNumber].filter(Boolean).join(" - ")}</div>
                    <div className="break-words">{box.agency?.name || "Chưa phân phối"}</div>
                    <div className="break-words text-xs text-muted-foreground">{box.caseType || "-"} · {box.year || "-"}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLabelPreviewBoxes([])}>Đóng</Button>
            <PrintActionButton onClick={() => handlePrintLabels(labelPreviewBoxes, labelPreviewBoxes.length === 1 ? "single" : "grid")}>
              {labelPreviewBoxes.length === 1 ? "In nhãn" : "In A4 nhiều nhãn"}
            </PrintActionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Form Dialog for Creating and Editing Boxes */}
      <StorageBoxDialog 
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSuccess={() => setIsDialogOpen(false)}
        box={selectedBox}
      />

      {/* Deleting Safe Confirmation Modal */}
      <AlertDialog open={!!boxToDelete} onOpenChange={() => setBoxToDelete(null)}>
        <AlertDialogContent className="rounded-2xl max-w-[450px]">
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-destructive mb-2">
              <Hash className="h-5 w-5 bg-destructive/10 p-1 rounded" />
              <AlertDialogTitle>Xác nhận xóa Hộp lưu trữ?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-sm">
              Hành động này sẽ gỡ bỏ vĩnh viễn hộp lưu trữ <strong>{boxToDelete?.code}</strong> ra khỏi hệ thống. Thao tác này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl h-9">Hủy</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              disabled={deleteStorageBox.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl h-9"
            >
              {deleteStorageBox.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Xác nhận xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
