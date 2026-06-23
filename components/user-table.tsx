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

import type { UserDto } from '@/lib/api/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { getColumns } from "@/components/users/columns";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { UserTableToolbar } from "@/components/users/user-table-toolbar";
import { Loader2 } from "lucide-react";
import { TableSurface } from '@/components/common/data-page-shell';

interface UserTableProps {
  users: UserDto[];
  isLoading?: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleLock?: (user: UserDto) => void;
  onCreate?: () => void;
  onImport?: () => void;
  currentUserRole?: string;
}

export default function UserTable({ users, isLoading, onEdit, onDelete, onToggleLock, onCreate, onImport, currentUserRole }: UserTableProps) {
  const [rowSelection, setRowSelection] = React.useState({})
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [sorting, setSorting] = React.useState<SortingState>([])

  const isAdmin = currentUserRole === 'SUPER_ADMIN';

  const columns = React.useMemo(() => getColumns({ onEdit, onDelete, onToggleLock, isAdmin, currentUserRole }), [onEdit, onDelete, onToggleLock, isAdmin, currentUserRole]);

   
  const table = useReactTable({
    data: users,
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
      <UserTableToolbar table={table} onCreate={onCreate} onImport={onImport} />
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
  );
}
