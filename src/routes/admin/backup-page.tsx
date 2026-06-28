'use client';

import { useEffect, useState } from "react";
import { useRouter } from '@/src/lib/router';
import { useSession } from "@/lib/hooks/use-auth";
import { apiFetch, apiDownload } from "@/lib/api/client";
import { toast } from "sonner";
import { 
  Download, 
  Upload, 
  Settings, 
  History, 
  Loader2, 
  RefreshCw, 
  Play, 
  Save, 
  AlertTriangle 
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DataPageShell, TableSurface } from "@/components/common/data-page-shell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";


type BackupSchedule = {
  enabled: boolean;
  frequency: string;
  timeOfDay: string;
  retentionDays: number;
  target: string;
  lastRunAt: string | null;
  lastStatus: string | null;
  lastMessage: string | null;
};

type BackupRun = {
  id: string;
  filename: string | null;
  size: number | null;
  status: string;
  message: string | null;
  target: string;
  startedAt: string;
  endedAt: string | null;
};

export default function BackupPage() {
  const router = useRouter();
  const { session, isLoading: isSessionLoading } = useSession();

  const [schedule, setSchedule] = useState<BackupSchedule>({
    enabled: false,
    frequency: "DAILY",
    timeOfDay: "23:00",
    retentionDays: 7,
    target: "server-cloud",
    lastRunAt: null,
    lastStatus: null,
    lastMessage: null,
  });
  const [runs, setRuns] = useState<BackupRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isCloudBackingUp, setIsCloudBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  
  // Restore state
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const fetchBackupData = async () => {
    try {
      const response = await apiFetch("/api/admin/database/backup-schedule");
      if (response.ok) {
        const data = await response.json();
        if (data.schedule) setSchedule(data.schedule);
        if (data.runs) setRuns(data.runs);
      }
    } catch (error) {
      console.error("Failed to fetch backup data:", error);
      toast.error("Không thể tải thông tin sao lưu");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    document.title = "Quản lý Sao lưu | Court Management";
  }, []);

  useEffect(() => {
    if (!isSessionLoading && (!session || session.role !== "SUPER_ADMIN")) {
      router.replace("/forbidden");
    } else if (session?.role === "SUPER_ADMIN") {
      fetchBackupData();
    }
  }, [session, isSessionLoading, router]);

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const response = await apiFetch("/api/admin/database/backup-schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(schedule),
      });
      if (response.ok) {
        toast.success("Đã cập nhật cấu hình lịch sao lưu");
        fetchBackupData();
      } else {
        toast.error("Không thể lưu cấu hình");
      }
    } catch {
      toast.error("Có lỗi xảy ra khi lưu");
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackupLocal = async () => {
    setIsBackingUp(true);
    toast.info("Đang chuẩn bị bản sao lưu để tải về...");
    try {
      const response = await apiDownload("/api/admin/database/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: "local" }),
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      
      const contentDisposition = response.headers.get("content-disposition");
      let filename = "court_backup.json.gz";
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^";]+)"?/i);
        if (match && match[1]) filename = match[1];
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success("Sao lưu cơ sở dữ liệu thành công");
      fetchBackupData();
    } catch (error) {
      console.error(error);
      toast.error("Không thể tải bản sao lưu");
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleBackupCloud = async () => {
    setIsCloudBackingUp(true);
    toast.info("Đang tiến hành sao lưu và lưu trên máy chủ...");
    try {
      const response = await apiFetch("/api/admin/database/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: "server-cloud" }),
      });
      if (response.ok) {
        toast.success("Sao lưu và lưu trên máy chủ thành công");
        fetchBackupData();
      } else {
        toast.error("Sao lưu thất bại");
      }
    } catch (error) {
      console.error(error);
      toast.error("Có lỗi xảy ra khi sao lưu lên máy chủ");
    } finally {
      setIsCloudBackingUp(false);
    }
  };

  const handleRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restoreFile) {
      toast.error("Vui lòng chọn file sao lưu (.json.gz)");
      return;
    }
    if (confirmText !== "RESTORE") {
      toast.error("Vui lòng nhập chính xác chữ RESTORE để xác nhận");
      return;
    }

    setIsRestoring(true);
    const formData = new FormData();
    formData.append("file", restoreFile);
    formData.append("confirm", "RESTORE");

    try {
      const response = await apiFetch("/api/admin/database/restore", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (response.ok && result.success) {
        toast.success("Khôi phục cơ sở dữ liệu thành công");
        setRestoreFile(null);
        setConfirmText("");
        fetchBackupData();
      } else {
        toast.error(result.message || "Khôi phục thất bại");
      }
    } catch {
      toast.error("Có lỗi xảy ra trong quá trình khôi phục");
    } finally {
      setIsRestoring(false);
    }
  };

  if (isSessionLoading || isLoading) {
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
        <DataPageShell
            toolbar={
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between w-full">
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Sao lưu & Khôi phục</h1>
                        <p className="text-xs text-muted-foreground">Quản lý phiên bản dữ liệu và lịch trình sao lưu cơ sở dữ liệu.</p>
                    </div>
                </div>
            }
        >
            <div className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                    {/* Quick Actions / Backup Form */}
                    <Card className="border border-muted/60 shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                                <Download className="h-4.5 w-4.5 text-primary" />
                                Sao lưu thủ công
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Tạo bản sao lưu (.json.gz) để tải về thiết bị của bạn hoặc lưu trữ trực tiếp trên máy chủ.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">Trạng thái lần chạy cuối:</span>
                                    <span className={`font-semibold ${
                                        schedule.lastStatus === "SUCCESS" || schedule.lastStatus === "RESTORED"
                                            ? "text-emerald-600 dark:text-emerald-400" 
                                            : schedule.lastStatus 
                                            ? "text-destructive" 
                                            : "text-muted-foreground"
                                    }`}>
                                        {schedule.lastStatus === "SUCCESS" ? "Thành công" : schedule.lastStatus === "RESTORED" ? "Đã khôi phục" : schedule.lastStatus || "Chưa có"}
                                    </span>
                                </div>
                                {schedule.lastRunAt && (
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground">Thời gian chạy cuối:</span>
                                        <span className="text-foreground">{new Date(schedule.lastRunAt).toLocaleString()}</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-col gap-2">
                                <Button 
                                    onClick={handleBackupLocal} 
                                    disabled={isBackingUp || isCloudBackingUp}
                                    className="w-full flex items-center justify-center gap-2 h-9.5 rounded-lg"
                                >
                                    {isBackingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                    Tải bản sao lưu về máy
                                </Button>
                                <Button 
                                    onClick={handleBackupCloud} 
                                    disabled={isBackingUp || isCloudBackingUp}
                                    variant="outline"
                                    className="w-full flex items-center justify-center gap-2 h-9.5 rounded-lg border-primary/20 hover:border-primary/50 text-primary"
                                >
                                    {isCloudBackingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                                    Sao lưu lên máy chủ ngay
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Backup Schedule Configuration */}
                    <Card className="border border-muted/60 shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                                <Settings className="h-4.5 w-4.5 text-primary" />
                                Lập lịch sao lưu tự động
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Thiết lập tự động sao lưu định kỳ trên máy chủ.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSaveSchedule} className="space-y-4">
                                <div className="flex items-center gap-2 py-1">
                                    <Checkbox 
                                        id="schedule-enabled" 
                                        checked={schedule.enabled}
                                        onCheckedChange={(checked) => setSchedule({ ...schedule, enabled: Boolean(checked) })}
                                    />
                                    <Label htmlFor="schedule-enabled" className="cursor-pointer text-xs font-semibold text-foreground">Bật lịch sao lưu tự động</Label>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="frequency" className="text-xs text-muted-foreground">Tần suất</Label>
                                        <Select
                                            value={schedule.frequency}
                                            onValueChange={(val) => setSchedule({ ...schedule, frequency: val })}
                                            disabled={!schedule.enabled}
                                        >
                                            <SelectTrigger id="frequency" className="h-9 rounded-lg">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="DAILY">Hàng ngày</SelectItem>
                                                <SelectItem value="WEEKLY">Hàng tuần</SelectItem>
                                                <SelectItem value="MONTHLY">Hàng tháng</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="timeOfDay" className="text-xs text-muted-foreground">Thời điểm (Giờ:Phút)</Label>
                                        <Input 
                                            id="timeOfDay"
                                            value={schedule.timeOfDay}
                                            onChange={(e) => setSchedule({ ...schedule, timeOfDay: e.target.value })}
                                            placeholder="23:00"
                                            className="h-9 rounded-lg"
                                            disabled={!schedule.enabled}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="target" className="text-xs text-muted-foreground">Nơi lưu trữ</Label>
                                        <Select
                                            value={schedule.target || "server-cloud"}
                                            onValueChange={(val) => setSchedule({ ...schedule, target: val })}
                                            disabled={!schedule.enabled}
                                        >
                                            <SelectTrigger id="target" className="h-9 rounded-lg">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="server-cloud">Lưu trên máy chủ</SelectItem>
                                                <SelectItem value="local">Tải về máy cá nhân</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="retentionDays" className="text-xs text-muted-foreground">Số ngày giữ bản sao lưu</Label>
                                        <Input 
                                            id="retentionDays"
                                            type="number"
                                            value={schedule.retentionDays}
                                            onChange={(e) => setSchedule({ ...schedule, retentionDays: parseInt(e.target.value) || 7 })}
                                            disabled={!schedule.enabled}
                                            className="h-9 rounded-lg"
                                            min={1}
                                        />
                                    </div>
                                </div>

                                <Button type="submit" disabled={isSaving} className="w-full flex items-center justify-center gap-2 h-9.5 rounded-lg">
                                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    Lưu cấu hình
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    {/* Database Restore Card */}
                    <Card className="md:col-span-2 border-red-200 dark:border-red-950 bg-red-50/10 dark:bg-red-950/5 shadow-sm">
                        <CardHeader className="pb-3 border-b border-red-100 dark:border-red-950/40">
                            <CardTitle className="flex items-center gap-2 text-base font-bold text-red-600 dark:text-red-400">
                                <AlertTriangle className="h-4.5 w-4.5" />
                                Khôi phục cơ sở dữ liệu
                            </CardTitle>
                            <CardDescription className="text-xs text-red-500/80">
                                Tải lên bản sao lưu (.json.gz) để ghi đè cơ sở dữ liệu hiện có. Hành động này sẽ thay thế hoàn toàn dữ liệu cũ!
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <form onSubmit={handleRestore} className="space-y-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="restore-file" className="text-xs text-muted-foreground">Chọn tệp sao lưu (.json.gz)</Label>
                                        <Input 
                                            id="restore-file"
                                            type="file"
                                            accept=".json.gz,.gz"
                                            className="h-9 rounded-lg text-xs"
                                            onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="confirm-text" className="text-xs text-muted-foreground">
                                            Nhập chữ <span className="font-bold text-red-600 dark:text-red-400">RESTORE</span> để xác nhận
                                        </Label>
                                        <Input 
                                            id="confirm-text"
                                            placeholder="Nhập chữ xác nhận..."
                                            value={confirmText}
                                            className="h-9 rounded-lg"
                                            onChange={(e) => setConfirmText(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <Button 
                                    type="submit" 
                                    variant="destructive"
                                    disabled={isRestoring || !restoreFile || confirmText !== "RESTORE"}
                                    className="w-full flex items-center justify-center gap-2 h-9.5 rounded-lg"
                                >
                                    {isRestoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                    Tiến hành khôi phục dữ liệu
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    {/* History of runs */}
                    <div className="md:col-span-2 space-y-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                                    <History className="h-4 w-4 text-muted-foreground" />
                                    Nhật ký sao lưu & khôi phục
                                </h3>
                                <p className="text-xs text-muted-foreground">Danh sách 20 lần chạy sao lưu hoặc khôi phục gần nhất.</p>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={fetchBackupData}>
                                <RefreshCw className="h-4 w-4" />
                            </Button>
                        </div>
                        <TableSurface>
                            <Table>
                                <TableHeader className="bg-muted/10">
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="text-xs font-bold uppercase tracking-wider py-2 text-foreground">Thời gian</TableHead>
                                        <TableHead className="text-xs font-bold uppercase tracking-wider py-2 text-foreground">Tên tệp</TableHead>
                                        <TableHead className="text-xs font-bold uppercase tracking-wider py-2 text-foreground">Kích thước</TableHead>
                                        <TableHead className="text-xs font-bold uppercase tracking-wider py-2 text-foreground">Hình thức</TableHead>
                                        <TableHead className="text-xs font-bold uppercase tracking-wider py-2 text-foreground">Trạng thái</TableHead>
                                        <TableHead className="text-xs font-bold uppercase tracking-wider py-2 text-foreground">Chi tiết</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {runs.length === 0 ? (
                                        <TableRow className="hover:bg-transparent">
                                            <TableCell colSpan={6} className="h-24 text-center text-xs text-muted-foreground">
                                                Chưa có lịch sử chạy sao lưu.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        runs.map((run) => (
                                            <TableRow key={run.id} className="hover:bg-muted/30 transition-colors">
                                                <TableCell className="whitespace-nowrap py-2 text-xs font-medium text-foreground">
                                                    {new Date(run.startedAt).toLocaleString()}
                                                </TableCell>
                                                <TableCell className="font-mono text-xs max-w-[200px] truncate py-2 text-foreground" title={run.filename || ""}>
                                                    {run.filename || "—"}
                                                </TableCell>
                                                <TableCell className="py-2 text-xs text-foreground">
                                                    {run.size ? `${(run.size / 1024 / 1024).toFixed(2)} MB` : "—"}
                                                </TableCell>
                                                <TableCell className="py-2 text-xs text-foreground">
                                                    <span className="text-xs font-medium">
                                                        {run.target === "server-cloud" ? "Lưu trên máy chủ" : (run.target === "local" ? "Tải về máy cá nhân" : run.target)}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="py-2">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                                        run.status === "SUCCESS" || run.status === "RESTORED"
                                                            ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400" 
                                                            : "bg-destructive/10 text-destructive dark:bg-destructive/20"
                                                    }`}>
                                                        {run.status === "SUCCESS" 
                                                            ? "Sao lưu OK" 
                                                            : run.status === "RESTORED" 
                                                            ? "Khôi phục OK" 
                                                            : run.status}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate py-2" title={run.message || ""}>
                                                    {run.message || "—"}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </TableSurface>
                    </div>
                </div>
            </div>
        </DataPageShell>
    );
}
