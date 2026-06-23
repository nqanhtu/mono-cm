"use client"

import { Table } from "@tanstack/react-table"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DataTableFacetedFilter } from "@/components/ui/data-table-faceted-filter";
import { useDebouncedCallback } from "use-debounce";

interface AuditTableToolbarProps<TData> {
  table: Table<TData>
  searchTerm: string;
  onSearchChange: (value: string) => void;
  actionFilter: string;
  onActionChange: (value: string) => void;
  userIdFilter: string;
  targetFilter: string;
  ipFilter: string;
  fromFilter: string;
  toFilter: string;
  onFilterChange: (key: string, value: string) => void;
}

export function AuditTableToolbar<TData>({
  searchTerm,
  onSearchChange,
  actionFilter,
  onActionChange,
  userIdFilter,
  targetFilter,
  ipFilter,
  fromFilter,
  toFilter,
  onFilterChange,
}: AuditTableToolbarProps<TData>) {
  // Since we are server-side filtering, we don't check table.getState().columnFilters
  // Instead we rely on the props passed down from the URL/State

  const isFiltered = !!searchTerm || (actionFilter && actionFilter !== 'ALL') || userIdFilter !== 'ALL' || !!targetFilter || !!ipFilter || !!fromFilter || !!toFilter;
  
  const handleReset = () => {
    onSearchChange('');
    onActionChange('ALL');
    onFilterChange('userId', 'ALL');
    onFilterChange('target', '');
    onFilterChange('ip', '');
    onFilterChange('from', '');
    onFilterChange('to', '');
  };

  const debouncedSearch = useDebouncedCallback((value) => {
    onSearchChange(value);
  }, 300);
  const debouncedFilter = useDebouncedCallback((key: string, value: string) => {
    onFilterChange(key, value);
  }, 300);

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <Input
          placeholder="Tìm kiếm người dùng, đối tượng..."
          defaultValue={searchTerm}
          onChange={(event) => debouncedSearch(event.target.value)}
          className="h-8 w-[150px] lg:w-[250px]"
        />

        <Input
          placeholder="Đối tượng"
          defaultValue={targetFilter}
          onChange={(event) => debouncedFilter('target', event.target.value)}
          className="h-8 w-[130px]"
        />

        <Input
          placeholder="IP"
          defaultValue={ipFilter}
          onChange={(event) => debouncedFilter('ip', event.target.value)}
          className="h-8 w-[130px]"
        />

        <Input
          type="date"
          value={fromFilter}
          onChange={(event) => onFilterChange('from', event.target.value)}
          className="h-8 w-[145px]"
        />

        <Input
          type="date"
          value={toFilter}
          onChange={(event) => onFilterChange('to', event.target.value)}
          className="h-8 w-[145px]"
        />
        
        <DataTableFacetedFilter
            title="Hành động"
            options={[
                { label: 'Thêm mới', value: 'CREATE' },
                { label: 'Cập nhật', value: 'UPDATE' },
                { label: 'Xóa', value: 'DELETE' },
                { label: 'Đăng nhập', value: 'LOGIN' },
            ]}
            value={actionFilter && actionFilter !== 'ALL' ? [actionFilter] : []}
            onFilter={(values) => onActionChange(values?.[0] || 'ALL')}
        />

        {isFiltered && (
          <Button
            variant="ghost"
            onClick={handleReset}
            className="h-8 px-2 lg:px-3"
          >
            Đặt lại
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
