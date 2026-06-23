"use client";
"use no memo";

import React from "react";
import { useSearchParams, useRouter } from '@/src/lib/router';
import { useAudit } from "@/lib/hooks/use-audit";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";

import { columns } from "@/components/audit/columns";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { AuditTableToolbar } from "@/components/audit/audit-table-toolbar";
import { TableSurface } from "@/components/common/data-page-shell";

export function AuditList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = Number(searchParams.get("page")) || 1;
  const searchTerm = searchParams.get("q") || "";
  const actionFilter = searchParams.get("action") || "ALL";
  const userIdFilter = searchParams.get("userId") || "ALL";
  const targetFilter = searchParams.get("target") || "";
  const ipFilter = searchParams.get("ip") || "";
  const fromFilter = searchParams.get("from") || "";
  const toFilter = searchParams.get("to") || "";
  const pageSize = Number(searchParams.get("limit")) || 20;

  const { logs, total, isLoading } = useAudit({
    query: searchTerm,
    action: actionFilter,
    userId: userIdFilter,
    target: targetFilter,
    ip: ipFilter,
    from: fromFilter,
    to: toFilter,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  // Server-side state handlers
  const handleSearchChange = (term: string) => {
    const params = new URLSearchParams(searchParams);
    if (term) {
      params.set("q", term);
    } else {
      params.delete("q");
    }
    params.set("page", "1");
    router.replace(`?${params.toString()}`);
  };

  const handleActionChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value && value !== "ALL") {
      params.set("action", value);
    } else {
      params.delete("action");
    }
    params.set("page", "1");
    router.replace(`?${params.toString()}`);
  };

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value && value !== "ALL") params.set(key, value);
    else params.delete(key);
    params.set("page", "1");
    router.replace(`?${params.toString()}`);
  };

  // Helper for DataTablePagination to control URL state
  // We map the "manual" pagination of TanStack to our URL-based logic
  // DataTablePagination uses table.setPageIndex etc.
  const paginationState = {
    pageIndex: page - 1,
    pageSize: pageSize,
  };

   
  const table = useReactTable({
    data: logs,
    columns,
    pageCount: Math.ceil(total / pageSize),
    state: {
      pagination: paginationState,
    },
    manualPagination: true,
    // We override onPaginationChange to update URL
    onPaginationChange: (updater) => {
      // updater can be functional or value
      const nextState =
        typeof updater === "function" ? updater(paginationState) : updater;
      const params = new URLSearchParams(searchParams);
      params.set("page", (nextState.pageIndex + 1).toString());
      params.set("limit", nextState.pageSize.toString());
      router.replace(`?${params.toString()}`);
    },
    getCoreRowModel: getCoreRowModel(),
  });



  return (
    <>
      <AuditTableToolbar
        table={table}
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        actionFilter={actionFilter}
        onActionChange={handleActionChange}
        userIdFilter={userIdFilter}
        targetFilter={targetFilter}
        ipFilter={ipFilter}
        fromFilter={fromFilter}
        toFilter={toFilter}
        onFilterChange={handleFilterChange}
      />
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
                          header.getContext(),
                        )}
                    </TableHead>
                  );
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
                        cell.getContext(),
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
                  Không tìm thấy dữ liệu nhật ký phù hợp.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableSurface>

      <DataTablePagination table={table} totalRows={total} />
    </>
  );
}
