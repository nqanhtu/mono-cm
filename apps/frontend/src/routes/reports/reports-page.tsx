'use client'

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReportDashboard } from "@/components/reports/report-dashboard";
import { UserContributionsReport } from "@/components/reports/user-contributions-report";
import { apiFetch } from "@/lib/api/client";
import { toast } from "sonner";
import { PrintActionButton } from "@/components/common/print-action-button";
import { DataPageShell } from "@/components/common/data-page-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Reports() {
  const [isExporting, setIsExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("borrows");

  const exportReport = async (format: "xlsx" | "csv") => {
    setIsExporting(true);
    try {
      const response = await apiFetch(`/api/reports/export?type=files&format=${format}`);
      if (!response.ok) throw new Error("Không thể kết xuất báo cáo");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = getDownloadFilename(response.headers.get("content-disposition"), `files-report.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("Đã kết xuất báo cáo");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Lỗi kết nối");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DataPageShell
      toolbar={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between w-full">
          <div>
            <h1 className="text-xl font-bold text-foreground">Báo cáo & Thống kê</h1>
            <p className="text-xs text-muted-foreground">Theo dõi hiệu suất hoạt động kho hồ sơ.</p>
          </div>
          {activeTab === "borrows" && (
            <div className="flex items-center gap-2">
              <PrintActionButton onClick={() => window.print()} />
              <Button variant="outline" className="h-9" onClick={() => exportReport("csv")} disabled={isExporting}>
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                CSV
              </Button>
              <Button variant="outline" className="h-9" onClick={() => exportReport("xlsx")} disabled={isExporting}>
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Excel
              </Button>
            </div>
          )}
        </div>
      }
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col gap-4">
        <TabsList className="grid grid-cols-2 max-w-[400px]">
          <TabsTrigger value="borrows">Giao dịch Mượn trả</TabsTrigger>
          <TabsTrigger value="contributions">Thống kê đóng góp</TabsTrigger>
        </TabsList>
        <TabsContent value="borrows" className="mt-0">
          <ReportDashboard />
        </TabsContent>
        <TabsContent value="contributions" className="mt-0">
          <UserContributionsReport />
        </TabsContent>
      </Tabs>
    </DataPageShell>
  );
}

function getDownloadFilename(contentDisposition: string | null, fallback: string) {
  if (!contentDisposition) return fallback;
  const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  return filenameMatch?.[1] || fallback;
}
