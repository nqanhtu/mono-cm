"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { AuditLogWithUser } from "@/lib/hooks/use-audit"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { AuditDetailCell } from "@/components/audit/audit-detail-dialog"

export const columns: ColumnDef<AuditLogWithUser>[] = [
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Thời gian" />
    ),
    cell: ({ row }) => (
      <div className="font-medium text-foreground tabular-nums">
        {format(new Date(row.getValue("createdAt")), 'dd/MM/yyyy HH:mm:ss')}
      </div>
    ),
    enableSorting: false, // Audit list usually sorted by server default
  },
  {
    accessorKey: "user",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Tài khoản" />
    ),
    cell: ({ row }) => {
      const user = row.original.user;
      return (
        <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-xs border border-primary/20">
                {user?.fullName.charAt(0)}
            </div>
            <div>
                <p className="text-sm font-semibold text-foreground">{user?.fullName}</p>
                <p className="text-xs text-muted-foreground">@{user?.username}</p>
            </div>
        </div>
      )
    },
  },
  {
    accessorKey: "action",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Hành động" />
    ),
    cell: ({ row }) => {
      const action = row.getValue("action") as string;
      switch (action) {
        case 'CREATE': return <Badge variant="success">THÊM MỚI</Badge>;
        case 'UPDATE': return <Badge variant="default">CẬP NHẬT</Badge>;
        case 'DELETE': return <Badge variant="destructive">XÓA</Badge>;
        case 'LOGIN': return <Badge variant="secondary">ĐĂNG NHẬP</Badge>;
        default: return <Badge variant="outline">{action}</Badge>;
      }
    },
  },
  {
    accessorKey: "target",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Đối tượng" />
    ),
    cell: ({ row }) => (
      <Badge variant="secondary">
        {row.getValue("target")}
      </Badge>
    ),
  },
  {
    accessorKey: "detail",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Chi tiết" />
    ),
    cell: ({ row }) => <AuditDetailCell log={row.original} />,
  },
]
