'use client'
'use no memo';

import * as React from 'react';
import { BarChart3, TrendingUp, AlertCircle, CheckCircle2, FileClock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useReportStats } from "@/lib/hooks/use-reports";
import {
    flexRender,
    getCoreRowModel,
    useReactTable,
} from '@tanstack/react-table';
import { columns, RecentBorrow } from "@/components/reports/columns";
import { TableSurface } from "@/components/common/data-page-shell";

export function ReportDashboard() {
    const { stats, isLoading } = useReportStats();

    // Memoize the data for the table
    const recentBorrows = React.useMemo(() =>
        (stats?.recentBorrows || []) as RecentBorrow[],
        [stats]);

     
    const table = useReactTable({
        data: recentBorrows,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });



    const { totalBorrows = 0, activeBorrows = 0, overdueBorrows = 0, returnedRate = 0 } = stats || {};

    return (
        <div className="flex flex-col gap-4">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: "Tổng lượt mượn", value: totalBorrows.toString(), icon: TrendingUp, className: "border-blue-200/70 bg-blue-50/70 text-blue-900 dark:border-blue-900/70 dark:bg-blue-950/20 dark:text-blue-100", dotClassName: "bg-blue-500" },
                    { label: "Đang mượn", value: activeBorrows.toString(), icon: FileClock, className: "border-amber-200/70 bg-amber-50/70 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-100", dotClassName: "bg-amber-500" },
                    { label: "Quá hạn", value: overdueBorrows.toString(), icon: AlertCircle, className: "border-red-200/70 bg-red-50/70 text-red-900 dark:border-red-900/70 dark:bg-red-950/20 dark:text-red-100", dotClassName: "bg-red-500" },
                    { label: "Đã trả đúng hạn", value: `${returnedRate}%`, icon: CheckCircle2, className: "border-emerald-200/70 bg-emerald-50/70 text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-100", dotClassName: "bg-emerald-500" },
                ].map((stat, i) => (
                    <div
                        key={i}
                        className={cn(
                            'flex min-h-12 items-center gap-3 rounded-lg border px-3 py-2',
                            stat.className
                        )}
                    >
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-white/70 shadow-xs dark:bg-white/10">
                            <stat.icon className="size-3.5" />
                        </span>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 text-[10px] font-semibold">
                                <span className={cn('size-1.5 rounded-full', stat.dotClassName)} />
                                <span>{stat.label}</span>
                            </div>
                            <p className="mt-0.5 text-lg font-semibold leading-none tabular-nums">{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Data Table Card */}
            <TableSurface
                toolbar={
                    <div className="flex items-center gap-2 py-0.5 font-semibold text-xs text-foreground">
                        <BarChart3 className="w-4 h-4 text-muted-foreground" />
                        <span>Chi tiết giao dịch gần đây</span>
                    </div>
                }
            >
                <Table>
                    <TableHeader className="bg-muted/10">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id} className="hover:bg-transparent">
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead key={header.id} colSpan={header.colSpan} className="text-xs font-bold uppercase tracking-wider py-2">
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                        </TableHead>
                                    )
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow className="hover:bg-transparent">
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-32 text-center"
                                >
                                    <div className="flex items-center justify-center text-slate-400">
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && "selected"}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id} className="px-3 py-2 text-sm">
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow className="hover:bg-transparent">
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-24 text-center text-muted-foreground text-sm"
                                >
                                    Chưa có dữ liệu giao dịch.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableSurface>
        </div>
    );
}
