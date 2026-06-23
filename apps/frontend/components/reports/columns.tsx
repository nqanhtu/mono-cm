"use client"

import { ColumnDef } from "@tanstack/react-table"
import { format } from "date-fns"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"

// We need to define the type based on what ReportDashboard uses
// It seems to be a BorrowSlip-like structure but we should define a compat type or import it
// Based on usage: id, code, items: {file: {code}}, borrowDate, dueDate, returnedDate, status

export type RecentBorrow = {
    id: string;
    code: string;
    items: { file: { code: string } }[];
    borrowDate: Date | string;
    dueDate: Date | string;
    returnedDate: Date | string | null;
    status: string;
}

export const columns: ColumnDef<RecentBorrow>[] = [
  {
    accessorKey: "code",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Mã mượn" />
    ),
    cell: ({ row }) => <div className="font-medium text-slate-800">{row.getValue("code")}</div>,
  },
  {
    accessorKey: "items",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Hồ sơ số" />
    ),
    cell: ({ row }) => {
        const items = row.original.items;
        return (
            <div>{items.length > 0 ? items.map(i => i.file.code).join(", ") : "-"}</div>
        )
    },
  },
  {
    accessorKey: "borrowDate",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Ngày mượn" />
    ),
    cell: ({ row }) => <div>{format(new Date(row.getValue("borrowDate")), "dd/MM/yyyy")}</div>,
  },
  {
    accessorKey: "dueDate",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Hạn trả" />
    ),
    cell: ({ row }) => <div>{format(new Date(row.getValue("dueDate")), "dd/MM/yyyy")}</div>,
  },
  {
    accessorKey: "returnedDate",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Thời gian trả" />
    ),
    cell: ({ row }) => {
        const date = row.getValue("returnedDate") as string | null;
        return <div>{date ? format(new Date(date), "dd/MM/yyyy") : "-"}</div>
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Trạng thái" />
    ),
    cell: ({ row }) => {
        const { status, dueDate } = row.original;
        const isReturned = status === "RETURNED";
        const isOverdue = status === "OVERDUE" || (new Date() > new Date(dueDate) && !isReturned);

        if (isReturned) {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Đã trả
                </span>
            )
        }
        if (isOverdue) {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium border border-red-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> Quá hạn
                </span>
            )
        }
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium border border-amber-200">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Đang mượn
            </span>
        )
    },
  },
]
