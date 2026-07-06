"use client";

import { apiFetch } from '@/lib/api/client';

import { Link } from 'react-router-dom'
import { ColumnDef } from "@tanstack/react-table"
import { Pencil, Trash2, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ChildDocumentFormModal } from "./child-document-form-modal"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from 'sonner'
import { Badge } from "@/components/ui/badge"
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"


import type { FileDto, StorageBoxDto } from "@/lib/api/types"
import { Checkbox } from "../ui/checkbox"

export type FileWithBox = FileDto & {
  box: StorageBoxDto | null
}

export type FileDocument = {
  id: string
  order?: number | null
  title: string
  contentIndex?: string | null
  indexCode?: string | null // For FileWithBox
  code?: string | null
  year?: number | null
  pageCount?: number | null
  note?: string | null
  status?: string | null
  createdBy?: { id: string, username: string, fullName: string } | null
  updatedBy?: { id: string, username: string, fullName: string } | null
  defendants?: string[] | null
  plaintiffs?: string[] | null
  civilDefendants?: string[] | null
}

export const getColumns = (
  fileId: string | undefined,
  mutate: () => void,
  canManageFiles = false,
  onDeleteFile?: (file: FileDocument) => void,
  onPrintFile?: (file: FileDocument) => void,
  isSuperAdmin = false
): ColumnDef<FileDocument>[] => {
  const cols: ColumnDef<FileDocument>[] = [
    {
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
    {
      accessorKey: "code",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Mã VB / MLHS" />
      ),
      cell: ({ row }) => (
        <div className="flex flex-col gap-1 text-xs">
          <span className="font-mono font-semibold tabular-nums text-slate-700 dark:text-slate-200">{row.original.code || "-"}</span>
        </div>
      ),
    },
    {
      accessorKey: "title",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Trích yếu / Tên văn bản" />
      ),
      cell: ({ row }) => {
        const title = row.original.title;
        const contentIndex = row.original.contentIndex || row.original.indexCode;

        return (
          <div className="w-[320px] max-w-[48vw] min-w-0 font-medium leading-5 sm:w-[420px] lg:w-[520px]">
            {!fileId ? (
              <Link
                to={`/files/${row.original.id}`}
                className="block truncate cursor-pointer text-slate-900 transition-colors hover:text-primary hover:underline dark:text-slate-100"
                title={title}
              >
                {title}
              </Link>
            ) : (
              <span className="block truncate" title={title}>{title}</span>
            )}
            {/* Support both contentIndex (Child) and indexCode (Parent) */}
            {contentIndex && (
              <div className="mt-1 truncate text-xs text-muted-foreground" title={`MLVB: ${contentIndex}`}>
                MLVB: {contentIndex}
              </div>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Trạng thái" />
      ),
      cell: ({ row }) => {
        const status = row.original.status || "IN_STOCK"
        const label = status === "BORROWED"
          ? "Đang mượn"
          : status === "ARCHIVED"
            ? "Ngừng sử dụng"
            : status === "LOST"
              ? "Thất lạc"
              : "Trong kho"
        const className = status === "BORROWED"
          ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
          : status === "ARCHIVED" || status === "LOST"
            ? "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
        
        return (
          <Badge variant="outline" className={cn("h-6 rounded-md px-2 font-semibold", className)}>
            {label}
          </Badge>
        )
      },
    },
    {
      id: "defendants_civil",
      accessorFn: (row) => [
        ...(row.defendants || []),
        ...(row.civilDefendants || [])
      ].join(", "),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Bị cáo / Bị đơn" />
      ),
      cell: ({ row }) => {
        const defs = row.original.defendants || [];
        const civilDefs = row.original.civilDefendants || [];
        if (defs.length === 0 && civilDefs.length === 0) return <span className="text-muted-foreground">-</span>;
        
        const allDefs = [
          ...defs.map(d => ({ name: d, type: "def" as const })),
          ...civilDefs.map(cd => ({ name: cd, type: "civil" as const }))
        ];

        const first = allDefs[0];
        const remainingCount = allDefs.length - 1;
        const badgeClass = first.type === "def" 
          ? "bg-red-50/50 border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-800 dark:text-red-300"
          : "bg-orange-50/50 border-orange-200 text-orange-700 dark:bg-orange-950/20 dark:border-orange-800 dark:text-orange-300";

        return (
          <div className="flex items-center gap-1 text-xs">
            <Badge variant="outline" className={cn("font-normal px-2 py-0.5 max-w-[120px] truncate block", badgeClass)} title={first.name}>
              {first.name}
            </Badge>
            {remainingCount > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="cursor-help px-1.5 py-0.5 text-[10px] font-medium bg-muted/65 hover:bg-muted/80 text-muted-foreground border border-muted/85">
                    +{remainingCount} khác
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="p-2.5 max-w-[280px]">
                  <div className="space-y-1">
                    <p className="font-semibold border-b border-muted-foreground/20 pb-1 mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                      Danh sách chi tiết ({allDefs.length})
                    </p>
                    <ul className="list-disc pl-3.5 space-y-1 text-xs font-normal">
                      {allDefs.map((item, i) => (
                        <li key={i} className="break-words">
                          <span className={item.type === "def" ? "text-red-600 dark:text-red-400 font-medium" : "text-orange-600 dark:text-orange-400 font-medium"}>
                            {item.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground ml-1">
                            ({item.type === "def" ? "Bị cáo / Bị đơn" : "Bị đơn dân sự"})
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        );
      }
    },
    {
      id: "plaintiffs_victims",
      accessorFn: (row) => (row.plaintiffs || []).join(", "),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Nguyên đơn / Bị hại" />
      ),
      cell: ({ row }) => {
        const plaintiffs = row.original.plaintiffs || [];
        if (plaintiffs.length === 0) return <span className="text-muted-foreground">-</span>;
        
        const first = plaintiffs[0];
        const remainingCount = plaintiffs.length - 1;
        const badgeClass = "bg-blue-50/50 border-blue-200 text-blue-700 dark:bg-blue-950/20 dark:border-blue-800 dark:text-blue-300";

        return (
          <div className="flex items-center gap-1 text-xs">
            <Badge variant="outline" className={cn("font-normal px-2 py-0.5 max-w-[120px] truncate block", badgeClass)} title={first}>
              {first}
            </Badge>
            {remainingCount > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="cursor-help px-1.5 py-0.5 text-[10px] font-medium bg-muted/65 hover:bg-muted/80 text-muted-foreground border border-muted/85">
                    +{remainingCount} khác
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="p-2.5 max-w-[280px]">
                  <div className="space-y-1">
                    <p className="font-semibold border-b border-muted-foreground/20 pb-1 mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                      Danh sách chi tiết ({plaintiffs.length})
                    </p>
                    <ul className="list-disc pl-3.5 space-y-1 text-xs font-normal">
                      {plaintiffs.map((name, i) => (
                        <li key={i} className="break-words">
                          <span className="text-blue-600 dark:text-blue-400 font-medium">{name}</span>
                          <span className="text-[10px] text-muted-foreground ml-1">(Nguyên đơn / Bị hại)</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        );
      }
    },
    {
      accessorKey: "year",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Thời gian" />
      ),
      cell: ({ row }) => <div className="tabular-nums">{row.original.year || "-"}</div>,
    },
    {
      accessorKey: "pageCount",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Số tờ" className="justify-end" />
      ),
      cell: ({ row }) => <div className="text-right tabular-nums">{row.original.pageCount}</div>,
    },
    {
      id: "createdBy",
      accessorFn: (row) => row.createdBy?.fullName || row.createdBy?.username || "",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Người tạo" />
      ),
      cell: ({ row }) => <div className="text-muted-foreground text-xs truncate max-w-[120px]">{row.original.createdBy?.fullName || row.original.createdBy?.username || "-"}</div>,
    },
    {
      id: "updatedBy",
      accessorFn: (row) => row.updatedBy?.fullName || row.updatedBy?.username || "",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Người cập nhật" />
      ),
      cell: ({ row }) => <div className="text-muted-foreground text-xs truncate max-w-[120px]">{row.original.updatedBy?.fullName || row.original.updatedBy?.username || "-"}</div>,
    },
    {
      accessorKey: "note",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Ghi chú" />
      ),
      cell: ({ row }) => (
        <div
          className="text-muted-foreground text-xs max-w-[200px] truncate"
          title={row.original.note || ""}
        >
          {row.original.note}
        </div>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const doc = row.original

        if (!fileId) {
          return (
            <div className="flex items-center justify-end">
              {onPrintFile && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/50 dark:hover:text-blue-400"
                  onClick={() => onPrintFile(doc)}
                  title="In bìa hồ sơ"
                >
                  <Printer className="h-4 w-4" />
                </Button>
              )}
              {onDeleteFile && isSuperAdmin && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50 dark:hover:text-red-400"
                      title="Lưu trữ hồ sơ"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Lưu trữ hồ sơ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Hồ sơ sẽ chuyển sang trạng thái ngừng sử dụng và bị ẩn khỏi danh sách mặc định. Lịch sử mượn/trả vẫn được giữ lại.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Hủy</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-red-600 hover:bg-red-700"
                        onClick={() => onDeleteFile?.(doc)}
                      >
                        Lưu trữ
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          )
        }

        return (
          <div className="flex items-center">
            <ChildDocumentFormModal
              fileId={fileId ?? ""}
              document={doc}
              trigger={
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950/50 dark:hover:text-amber-400"
                  title="Chỉnh sửa văn bản"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              }
              onSuccess={() => mutate()}
            />
            {isSuperAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50 dark:hover:text-red-400"
                    title="Xóa văn bản"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Xác nhận xóa văn bản?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Hành động này không thể hoàn tác. Văn bản này sẽ bị xóa vĩnh viễn khỏi hồ sơ.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Hủy</AlertDialogCancel>
                    <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={async () => {
                      try {
                        const res = await apiFetch(`/api/documents/${doc.id}`, {
                          method: 'DELETE'
                        })
                        if (res.ok) {
                          toast.success('Xóa thành công')
                          mutate()
                        } else {
                          toast.error('Xóa thất bại')
                        }
                      } catch {
                        toast.error('Xóa thất bại')
                      }
                    }}>Xóa</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        )
      },
    }
  ]

  return canManageFiles ? cols : cols.filter((column) => column.id !== "actions")
}
