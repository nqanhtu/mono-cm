'use client';

import * as React from 'react';
import {
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BorrowSlipWithDetails } from '@/lib/types/borrow';
import { getColumns } from "@/components/borrow/columns";
import { BorrowTableToolbar } from "@/components/borrow/borrow-table-toolbar";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { Loader2 } from "lucide-react";
import { TableSurface } from '@/components/common/data-page-shell';

interface BorrowTableProps {
  borrowSlips: BorrowSlipWithDetails[];
  isLoading?: boolean;
  onReturn: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onExport: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onViewHistory: (id: string) => void;
  onPrint: (slip: BorrowSlipWithDetails) => void;
  onCreate?: () => void;
  canManageBorrow?: boolean;
  canApproveBorrow?: boolean;
}

export default function BorrowTable({
  borrowSlips,
  isLoading,
  onReturn,
  onApprove,
  onReject,
  onExport,
  onEdit,
  onDelete,
  onViewHistory,
  onPrint,
  onCreate,
  canManageBorrow = false,
  canApproveBorrow = false,
}: BorrowTableProps) {
  const [rowSelection, setRowSelection] = React.useState({})
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [sorting, setSorting] = React.useState<SortingState>([])

  const columns = React.useMemo(
    () => getColumns({ onReturn, onApprove, onReject, onExport, onEdit, onDelete, onViewHistory, onPrint, canManageBorrow, canApproveBorrow }),
    [onReturn, onApprove, onReject, onExport, onEdit, onDelete, onViewHistory, onPrint, canManageBorrow, canApproveBorrow]
  );

   
  const table = useReactTable({
    data: borrowSlips,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className="space-y-4">
      <BorrowTableToolbar table={table} onCreate={onCreate} />
      <TableSurface>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} colSpan={header.colSpan}>
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
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  <div className="flex items-center justify-center text-muted-foreground">
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
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  Không có kết quả.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableSurface>
      <DataTablePagination table={table} />
    </div>
  )
}
