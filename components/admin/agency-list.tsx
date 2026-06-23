"use client";

import { apiFetch } from '@/lib/api/client';

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { 
  Pencil, 
  Trash2, 
  Plus, 
  Building2,
  MoreHorizontal,
  Loader2,
  Printer
} from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { AgencyFormModal } from "./agency-form-modal";
import type { AgencyHistoryDto } from "@/lib/api/types";
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
import { toast } from "sonner";

export function AgencyList() {
  const [agencies, setAgencies] = useState<AgencyHistoryDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAgency, setSelectedAgency] = useState<AgencyHistoryDto | null>(null);
  const [agencyToDelete, setAgencyToDelete] = useState<AgencyHistoryDto | null>(null);

  const fetchAgencies = async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch("/api/admin/agency");
      const data = await response.json();
      setAgencies(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Không thể tải danh sách phông lưu trữ");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAgencies();
  }, []);

  const handleDelete = async () => {
    if (!agencyToDelete) return;
    try {
      const response = await apiFetch(`/api/admin/agency/${agencyToDelete.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Không thể xoá");
      }
      toast.success("Đã xoá phông lưu trữ");
      fetchAgencies();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể xoá");
    } finally {
      setAgencyToDelete(null);
    }
  };

  const handlePrintLabel = (agency: AgencyHistoryDto) => {
    const printWindow = window.open('', '_blank', 'width=600,height=400');
    if (printWindow) {
        printWindow.document.write(`
            <html>
                <head>
                    <title>In nhãn Phông - ${agency.name}</title>
                    <style>
                        body {
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                            font-family: Arial, sans-serif;
                            margin: 0;
                            padding: 40px;
                        }
                        .label-container {
                            text-align: center;
                            border: 3px solid #000;
                            padding: 30px;
                            border-radius: 4px;
                            width: 400px;
                            max-width: 100%;
                        }
                        h1 {
                            margin: 0 0 10px 0;
                            font-size: 24px;
                            font-weight: bold;
                            text-transform: uppercase;
                            letter-spacing: 2px;
                            border-bottom: 2px solid #000;
                            padding-bottom: 10px;
                        }
                        h2 {
                            margin: 20px 0 10px 0;
                            font-size: 32px;
                            font-weight: bold;
                        }
                        p {
                            margin: 10px 0 0 0;
                            font-size: 16px;
                            color: #333;
                            font-style: italic;
                        }
                        .hint {
                            margin-top: 30px;
                            font-size: 12px;
                            color: #888;
                        }
                        @media print {
                            .hint { display: none; }
                            body { padding: 0; }
                        }
                    </style>
                </head>
                <body>
                    <div class="label-container">
                        <h1>PHÔNG LƯU TRỮ</h1>
                        <h2>${agency.name}</h2>
                        <p>ID: ${agency.id.substring(0, 8).toUpperCase()}</p>
                    </div>
                    <div class="hint">Cửa sổ sẽ tự động đóng sau khi in.</div>
                    <script>
                        window.onload = () => {
                            setTimeout(() => {
                                window.print();
                                window.close();
                            }, 500);
                        };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Danh sách Phông lưu trữ</h2>
        </div>
        <Button onClick={() => {
          setSelectedAgency(null);
          setIsModalOpen(true);
        }}>
          <Plus className="mr-2 h-4 w-4" /> Thêm phông mới
        </Button>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tên cơ quan</TableHead>
              <TableHead>Thời gian bắt đầu</TableHead>
              <TableHead>Thời gian kết thúc</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="w-[100px]">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <div className="flex items-center justify-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Đang tải...
                  </div>
                </TableCell>
              </TableRow>
            ) : agencies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  Chưa có dữ liệu phông lưu trữ.
                </TableCell>
              </TableRow>
            ) : (
              agencies.map((agency) => (
                <TableRow key={agency.id}>
                  <TableCell className="font-medium">{agency.name}</TableCell>
                  <TableCell>
                    {format(new Date(agency.startDate), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell>
                    {agency.endDate 
                      ? format(new Date(agency.endDate), "dd/MM/yyyy")
                      : "Hiện tại"}
                  </TableCell>
                  <TableCell>
                    {agency.endDate ? (
                      <Badge variant="secondary">Hết hạn</Badge>
                    ) : (
                      <Badge variant="success" className="bg-emerald-500 hover:bg-emerald-600 text-white border-0">Đang hoạt động</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Thao tác</DropdownMenuLabel>
                        <DropdownMenuItem 
                          className="cursor-pointer focus:bg-blue-50 focus:text-blue-600 dark:focus:bg-blue-950/50 dark:focus:text-blue-400"
                          onClick={() => handlePrintLabel(agency)}
                        >
                          <Printer className="mr-2 h-4 w-4" /> In nhãn
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="cursor-pointer focus:bg-amber-50 focus:text-amber-600 dark:focus:bg-amber-950/50 dark:focus:text-amber-400"
                          onClick={() => {
                            setSelectedAgency(agency);
                            setIsModalOpen(true);
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" /> Chỉnh sửa
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive dark:focus:bg-destructive/20"
                          onClick={() => setAgencyToDelete(agency)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Xoá
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AgencyFormModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchAgencies}
        agency={selectedAgency}
      />

      <AlertDialog open={!!agencyToDelete} onOpenChange={() => setAgencyToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xoá?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này không thể hoàn tác. Bạn đang xoá phông lưu trữ: <strong>{agencyToDelete?.name}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Xác nhận xoá
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
