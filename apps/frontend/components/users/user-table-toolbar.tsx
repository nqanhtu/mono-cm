"use client"

import { Table } from "@tanstack/react-table"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DataTableFacetedFilter } from "@/components/ui/data-table-faceted-filter"

interface UserTableToolbarProps<TData> {
  table: Table<TData>
  onCreate?: () => void
  onImport?: () => void
}

export function UserTableToolbar<TData>({
  table,
  onCreate,
  onImport,
}: UserTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center gap-2">
        <Input
          placeholder="Tìm kiếm người dùng..."
          value={(table.getState().globalFilter as string) ?? ""}
          onChange={(event) =>
            table.setGlobalFilter(event.target.value)
          }
          className="h-8 w-[150px] lg:w-[250px]"
        />
        {table.getColumn("role") && (
          <DataTableFacetedFilter
            column={table.getColumn("role")}
            title="Vai trò"
            options={[
              { label: 'Quản trị toàn hệ thống', value: 'SUPER_ADMIN' },
              { label: 'Quản trị', value: 'ADMIN' },
              { label: 'Điều phối', value: 'COORDINATOR' },
              { label: 'Chỉ xem', value: 'VIEWER' },
            ]}
          />
        )}
        {table.getColumn("status") && (
          <DataTableFacetedFilter
            column={table.getColumn("status")}
            title="Trạng thái"
            options={[
              { label: 'Hoạt động', value: 'true' }, // Assuming boolean string or we need to check how filterFn works in columns.tsx
              { label: 'Bị khoá', value: 'false' },
            ]}
          />
        )}
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => table.resetColumnFilters()}
            className="h-8 px-2 lg:px-3"
          >
            Đặt lại
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        {onImport && (
          <Button size="sm" variant="outline" onClick={onImport}>
            Nhập từ file
          </Button>
        )}
        {onCreate && (
          <Button size="sm" onClick={onCreate}>
            Thêm người dùng
          </Button>
        )}
      </div>
    </div>
  )
}

