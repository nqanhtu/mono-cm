import { apiFetch } from '@/lib/api/client';
import * as React from 'react'
import {
  ColumnFiltersState,
  ColumnDef,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'

import { toast } from "sonner"
import { FolderOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { FileDocument, getColumns, FileWithBox } from "@/components/files/columns"
import { DataTablePagination } from "@/components/ui/data-table-pagination"
import { FileTableToolbar } from '@/components/files/file-table-toolbar'
import Modal from "@/components/modal"
import BorrowForm from "@/components/borrow/borrow-form"
import { Button } from "@/components/ui/button"
import { Skeleton } from '@/components/ui/skeleton'
import { useSearchParams } from '@/src/lib/router'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { queryClient } from '@/src/lib/query-client'
import { queryKeys } from '@/src/lib/query-keys'
import { TableSurface } from '@/components/common/data-page-shell'
import { PrintFileCoversDialog } from './print-file-covers-dialog'

interface FileTableProps {
  files: FileWithBox[]
  isLoading?: boolean
  role?: string // For RBAC display
  canBorrow?: boolean
  canManageFiles?: boolean
  onCreate?: () => void
  total?: number
  page?: number
  pageSize?: number
  onPaginationChange?: (page: number, pageSize: number) => void
  onRefresh?: () => void
  sorting?: SortingState
  onSortingChange?: (sorting: SortingState) => void
}

export function FileTable({
  files,
  isLoading,
  role,
  canBorrow = false,
  canManageFiles = false,
  onCreate,
  total,
  page = 1,
  pageSize = 10,
  onPaginationChange,
  onRefresh,
  sorting,
  onSortingChange,
}: FileTableProps) {
  const searchParams = useSearchParams()
  const [rowSelection, setRowSelection] = React.useState({})
  const [isBorrowModalOpen, setIsBorrowModalOpen] = React.useState(false);
  const [borrowFiles, setBorrowFiles] = React.useState<FileWithBox[]>([]);
  const [isPrintModalOpen, setIsPrintModalOpen] = React.useState(false);
  const [printFiles, setPrintFiles] = React.useState<FileWithBox[]>([]);
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(() => {
      if (typeof window !== 'undefined') {
        const stored = window.localStorage.getItem('files-table-column-visibility')
        if (stored) {
          try {
            return JSON.parse(stored)
          } catch {
            // Ignore
          }
        }
      }
      return {
        defendants_civil: true,
        plaintiffs_victims: true,
      }
    })
  const [density, setDensity] = React.useState<'compact' | 'comfortable'>('comfortable')
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [localSorting, setLocalSorting] = React.useState<SortingState>([])
  const activeSorting = sorting !== undefined ? sorting : localSorting
  const handleSortingChange = onSortingChange !== undefined ? onSortingChange : setLocalSorting
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = React.useState(false)

  // Determine if we are using manual pagination (server-side)
  const isManual = total !== undefined

  React.useEffect(() => {
    const storedVisibility = window.localStorage.getItem('files-table-column-visibility')
    const storedDensity = window.localStorage.getItem('files-table-density')

    if (storedVisibility) setColumnVisibility(JSON.parse(storedVisibility))
    else {
      setColumnVisibility({
        defendants_civil: true,
        plaintiffs_victims: true,
      })
    }
    if (storedDensity === 'compact' || storedDensity === 'comfortable') setDensity(storedDensity)
  }, [])

  React.useEffect(() => {
    window.localStorage.setItem('files-table-column-visibility', JSON.stringify(columnVisibility))
  }, [columnVisibility])

  React.useEffect(() => {
    window.localStorage.setItem('files-table-density', density)
  }, [density])

  const paginationState = {
    pageIndex: page - 1,
    pageSize: pageSize,
  }

  const handleBorrow = (selectedFiles: FileWithBox[]) => {
    const files = selectedFiles;
    const borrowed = files.filter((f) => f.status === "BORROWED");
    if (borrowed.length > 0) {
      toast.error(
        `Có ${borrowed.length} hồ sơ đang được mượn không thể tạo phiếu.`
      );
      return;
    }
    setBorrowFiles(files);
    setIsBorrowModalOpen(true);
  };

  const handleDeleteFile = React.useCallback(async (file: FileDocument) => {
    try {
      const response = await apiFetch(`/api/files/${file.id}`, {
        method: 'DELETE',
      })
      const result = await response.json()

      if (response.ok && result.success) {
        toast.success('Đã lưu trữ hồ sơ')
        queryClient.invalidateQueries({ queryKey: queryKeys.files.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.files.stats })
        queryClient.invalidateQueries({ queryKey: queryKeys.boxes.all })
        onRefresh?.()
        return
      }

      toast.error('Không thể lưu trữ hồ sơ', {
        description: result.message || result.error || 'Vui lòng thử lại.',
      })
    } catch {
      toast.error('Không thể lưu trữ hồ sơ')
    }
  }, [onRefresh]);

  const handlePrintCovers = React.useCallback((selectedFiles: FileWithBox[]) => {
    setPrintFiles(selectedFiles);
    setIsPrintModalOpen(true);
  }, []);

  const columns = React.useMemo<ColumnDef<FileWithBox>[]>(
    () => getColumns(
      undefined,
      () => { },
      canManageFiles,
      handleDeleteFile,
      (file) => handlePrintCovers([file as unknown as FileWithBox]),
      role === 'SUPER_ADMIN'
    ) as unknown as ColumnDef<FileWithBox>[],
    [canManageFiles, handleDeleteFile, handlePrintCovers, role]
  )


  const table = useReactTable({
    data: files,
    columns,
    pageCount: isManual ? Math.ceil(total / pageSize) : undefined,
    state: {
      sorting: activeSorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination: isManual ? paginationState : undefined,
    },
    manualPagination: isManual,
    manualSorting: true,
    onPaginationChange: isManual ? (updater) => {
      if (onPaginationChange) {
        const nextState = typeof updater === 'function' ? updater(paginationState) : updater;
        onPaginationChange(nextState.pageIndex + 1, nextState.pageSize);
      }
    } : undefined,
    onRowSelectionChange: setRowSelection,
    onSortingChange: (updater) => {
      const nextSorting = typeof updater === 'function' ? updater(activeSorting) : updater
      handleSortingChange(nextSorting)
    },
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const selectedRows = table.getFilteredSelectedRowModel().rows

  const handleBulkDelete = React.useCallback(async (selectedFiles: FileWithBox[]) => {
    try {
      await Promise.all(
        selectedFiles.map(file =>
          apiFetch(`/api/files/${file.id}`, { method: 'DELETE' })
        )
      );
      toast.success(`Đã lưu trữ thành công ${selectedFiles.length} hồ sơ`);
      table.resetRowSelection();
      queryClient.invalidateQueries({ queryKey: queryKeys.files.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.files.stats });
      queryClient.invalidateQueries({ queryKey: queryKeys.boxes.all });
      onRefresh?.();
    } catch {
      toast.error('Có lỗi xảy ra khi lưu trữ hồ sơ');
    }
  }, [onRefresh, table]);

  const hasActiveFilters = [
    "q",
    "type",
    "status",
    "year",
    "judgmentNumber",
    "party",
    "warehouse",
    "line",
    "shelf",
    "slot",
    "createdById",
  ].some((key) => !!searchParams.get(key))
  const selectedFiles = selectedRows.map((row) => row.original)
  const actionColumnClassName = "sticky right-0 z-20 bg-background shadow-[-10px_0_16px_-14px_rgba(15,23,42,0.55)]"
  const getStickyActionClassName = (columnId: string) => columnId === "actions" ? actionColumnClassName : undefined

  return (
    <div className="flex flex-col gap-4">
      <FileTableToolbar
        table={table}
        onCreate={onCreate}
        density={density}
        onDensityChange={setDensity}
        role={role}
      />
      <TableSurface
        toolbar={
          selectedRows.length > 0 ? (
            <div className="relative h-10 w-full overflow-hidden">
              <div
                className="absolute inset-0 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 text-slate-900 shadow-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              >
                <div className="flex items-center gap-2 pl-1 text-sm font-semibold">
                  <span className="flex size-5 items-center justify-center rounded bg-primary text-xs text-primary-foreground">
                    {selectedRows.length}
                  </span>
                  <span>hồ sơ đã chọn</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePrintCovers(selectedFiles)}
                    className="h-7 rounded-md bg-background text-xs font-semibold"
                  >
                    In bìa
                  </Button>
                  {canBorrow && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleBorrow(selectedFiles)}
                      className="h-7 rounded-md bg-background text-xs font-semibold"
                    >
                      Tạo phiếu mượn
                    </Button>
                  )}
                  {canManageFiles && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setIsBulkDeleteDialogOpen(true)}
                      className="h-7 rounded-md text-xs font-semibold"
                    >
                      Lưu trữ
                    </Button>
                  )}
                  <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-1" />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => table.resetRowSelection()}
                    className="h-7 rounded-md text-xs font-semibold text-muted-foreground"
                  >
                    Bỏ chọn
                  </Button>
                </div>
              </div>
            </div>
          ) : undefined
        }
      >
        <Table>
          <TableHeader className="bg-muted/10">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      className={cn(
                        "text-xs font-semibold py-2 text-foreground",
                        header.column.id === "actions" && "sticky right-0 z-30 bg-muted/95 shadow-[-10px_0_16px_-14px_rgba(15,23,42,0.55)]"
                      )}
                    >
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
              Array.from({ length: pageSize || 10 }).map((_, rowIndex) => (
                <TableRow key={`skeleton-row-${rowIndex}`} className="hover:bg-transparent animate-pulse">
                  {columns.map((column, cellIndex) => (
                    <TableCell
                      key={`skeleton-cell-${cellIndex}`}
                      className={cn(
                        "px-3",
                        density === 'compact' ? 'py-1.5' : 'py-3',
                        getStickyActionClassName(column.id ?? "")
                      )}
                    >
                      <Skeleton className={cn(
                        "h-4 w-full bg-slate-200/60 dark:bg-slate-800/60 rounded",
                        cellIndex === 0 && "w-6",
                        cellIndex === 1 && "w-24",
                        cellIndex === 2 && "w-4/5",
                        cellIndex === 3 && "w-16",
                        cellIndex === 4 && "w-10",
                        cellIndex === 5 && "w-12 ml-auto",
                        cellIndex === 6 && "w-20",
                        cellIndex === 7 && "w-20"
                      )} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="hover:bg-muted/40 transition-colors data-[state=selected]:bg-primary/[0.04] dark:data-[state=selected]:bg-primary/[0.08] border-b border-muted/60"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        "px-3",
                        density === 'compact' ? 'py-1 text-xs' : 'py-2 text-sm',
                        getStickyActionClassName(cell.column.id)
                      )}
                    >
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
                  className="h-64 text-center"
                >
                  <div className="flex flex-col items-center justify-center space-y-3 py-10">
                    <FolderOpen className="h-10 w-10 text-muted-foreground/45" />
                    <div>
                      <p className="text-base font-semibold text-foreground">
                        {hasActiveFilters ? 'Chưa có hồ sơ phù hợp' : 'Chưa có hồ sơ nào'}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
                        {hasActiveFilters
                          ? 'Thử thay đổi từ khóa tìm kiếm hoặc bấm đặt lại các bộ lọc đang áp dụng.'
                          : 'Tạo hồ sơ đầu tiên để bắt đầu quản lý lưu trữ.'}
                      </p>
                    </div>
                    {hasActiveFilters ? (
                      <Button
                        onClick={() => {
                          const params = new URLSearchParams(searchParams);
                          [
                            "q",
                            "type",
                            "status",
                            "year",
                            "judgmentNumber",
                            "party",
                            "warehouse",
                            "line",
                            "shelf",
                            "slot",
                            "createdById",
                          ].forEach((key) => params.delete(key));
                          params.set("page", "1");
                          window.location.search = params.toString();
                        }}
                        size="sm"
                        variant="outline"
                        className="mt-2 rounded-lg"
                      >
                        Đặt lại bộ lọc
                      </Button>
                    ) : onCreate && (
                      <Button onClick={onCreate} size="sm" className="mt-2 rounded-lg">
                        Tạo hồ sơ đầu tiên
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableSurface>
      <DataTablePagination table={table} totalRows={total} />

      <Modal
        isOpen={isBorrowModalOpen}
        onClose={() => setIsBorrowModalOpen(false)}
        title="Tạo phiếu mượn hồ sơ"
        className="max-w-5xl"
      >
        <BorrowForm
          initialFiles={borrowFiles}
          onSuccess={() => {
            setIsBorrowModalOpen(false);
            setRowSelection({});
            queryClient.invalidateQueries({ queryKey: queryKeys.files.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.files.stats });
            queryClient.invalidateQueries({ queryKey: queryKeys.borrow.all });
            onRefresh?.();
          }}
        />
      </Modal>

      <PrintFileCoversDialog
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        files={printFiles}
      />

      <AlertDialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Lưu trữ {selectedRows.length} hồ sơ?</AlertDialogTitle>
            <AlertDialogDescription>
              Các hồ sơ đã chọn sẽ chuyển sang trạng thái ngừng sử dụng và bị ẩn khỏi danh sách mặc định. Lịch sử mượn/trả vẫn được giữ lại.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => handleBulkDelete(selectedFiles)}
            >
              Lưu trữ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
