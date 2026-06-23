'use client';

import { useEffect } from "react";
import { useRouter, useSearchParams } from '@/src/lib/router';
import { History, Loader2, ShieldCheck } from 'lucide-react';
import { AuditList } from '@/components/audit/audit-list';
import { AccessLogList } from '@/components/audit/access-log-list';
import { useSession } from "@/lib/hooks/use-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataPageShell } from "@/components/common/data-page-shell";

export default function AuditLogPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { session, isLoading } = useSession();
    const currentTab = searchParams.get("tab") === "access" ? "access" : "audit";

    useEffect(() => {
        document.title = "Nhật ký hệ thống | Court Management";
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

    if (!session || session.role !== "SUPER_ADMIN") {
        return null;
    }

    const handleTabChange = (value: string) => {
        const params = new URLSearchParams(searchParams);
        if (value === "access") params.set("tab", "access");
        else params.delete("tab");
        params.set("page", "1");
        router.replace(`?${params.toString()}`);
    };

    return (
        <DataPageShell
            toolbar={
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between w-full">
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Nhật ký hệ thống</h1>
                        <p className="text-xs text-muted-foreground">Lịch sử truy vết và thao tác dữ liệu (Security Log).</p>
                    </div>
                </div>
            }
        >
            <div className="space-y-4">
                <Tabs value={currentTab} onValueChange={handleTabChange} className="space-y-4">
                    <TabsList className="bg-muted/30 p-1 rounded-lg w-max">
                        <TabsTrigger value="audit" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded-md">
                            <History className="h-3.5 w-3.5" />
                            Nhật ký thao tác
                        </TabsTrigger>
                        <TabsTrigger value="access" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded-md">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Lịch sử truy cập
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="audit" className="outline-none">
                        <AuditList />
                    </TabsContent>
                    <TabsContent value="access" className="outline-none">
                        <AccessLogList />
                    </TabsContent>
                </Tabs>
            </div>
        </DataPageShell>
    );
}
