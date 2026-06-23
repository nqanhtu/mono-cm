'use client';

import { useEffect } from "react";
import { useRouter } from '@/src/lib/router';
import { AgencyList } from "@/components/admin/agency-list";
import { useSession } from "@/lib/hooks/use-auth";
import { Loader2 } from "lucide-react";

export default function AgencyPage() {
  const router = useRouter();
  const { session, isLoading } = useSession();

  useEffect(() => {
    document.title = "Quản lý Phông lưu trữ | Court Management";
  }, []);

  useEffect(() => {
    if (!isLoading && (!session || session.role !== "SUPER_ADMIN")) {
      router.replace("/forbidden");
    }
  }, [session, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Prevent rendering protected content while redirecting
  if (!session || session.role !== "SUPER_ADMIN") {
    return null;
  }

  return (
    <div className="flex flex-col">
      <main className="p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight">Quản lý Hệ thống</h1>
            <p className="text-muted-foreground mt-2">
              Thiết lập danh mục phông lưu trữ và lịch sử thay đổi tên cơ quan.
            </p>
          </div>
          <AgencyList />
        </div>
      </main>
    </div>
  );
}
