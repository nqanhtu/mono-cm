"use client";

import { Table } from "@tanstack/react-table";
import { SlidersHorizontal, Search, X, Settings, CalendarDays } from "lucide-react";
import { useState } from "react";
import { useRouter, useSearchParams } from '@/src/lib/router';
import { useDebouncedCallback } from "use-debounce";
import useSWR from "swr";
import { apiFetch } from "@/lib/api/client";
import type { UserDto } from "@/lib/api/types";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTableFacetedFilter } from "@/components/ui/data-table-faceted-filter";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface FileTableToolbarProps<TData> {
  table: Table<TData>;
  onCreate?: () => void;
  density?: "compact" | "comfortable";
  onDensityChange?: (density: "compact" | "comfortable") => void;
  role?: string;
}

const statuses = [
  { value: "IN_STOCK", label: "Trong kho" },
  { value: "BORROWED", label: "Đang mượn" },
  { value: "ARCHIVED", label: "Ngừng sử dụng" },
  { value: "LOST", label: "Thất lạc" },
];

const caseTypes = [
  { label: "Hình sự sơ thẩm", value: "Hình sự sơ thẩm" },
  { label: "Dân sự sơ thẩm", value: "Dân sự sơ thẩm" },
  { label: "Hình sự phúc thẩm", value: "Hình sự phúc thẩm" },
  { label: "Dân sự phúc thẩm", value: "Dân sự phúc thẩm" },
  { label: "Hôn nhân phúc thẩm", value: "Hôn nhân phúc thẩm" },
  { label: "Hành chính", value: "Hành chính" },
  { label: "Kinh tế", value: "Kinh tế" },
];

type UsersResponse = UserDto[] | { users?: UserDto[] };

export function FileTableToolbar<TData>({
  table,
  onCreate,
  density = "comfortable",
  onDensityChange,
  role,
}: FileTableToolbarProps<TData>) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const advancedFilterKeys = [
    "year",
    "judgmentNumber",
    "party",
    "warehouse",
    "line",
    "shelf",
    "slot",
  ];
  const hasAdvancedFilters = advancedFilterKeys.some((key) => !!searchParams.get(key));
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(hasAdvancedFilters);

  const isFiltered = [
    "q",
    "type",
    "status",
    ...advancedFilterKeys,
    "createdById",
  ].some((key) => !!searchParams.get(key)) || table.getState().columnFilters.length > 0;

  const isSuperOrAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN';
  const { data: usersData } = useSWR<UsersResponse>(
    isSuperOrAdmin ? '/api/users?purpose=coordinator' : null,
    (url: string) => apiFetch(url).then((r) => r.json())
  );

  const coordinatorsList = Array.isArray(usersData) ? usersData : (usersData?.users || []);
  const coordinatorOptions = coordinatorsList.map((u) => {
    const displayName = u.fullName;
    const label = displayName && u.username ? `${displayName} (${u.username})` : (displayName || u.username || "Unknown");
    return {
      label,
      value: u.id
    }
  });

  const activeFilters = [
    searchParams.get("q") ? { key: "q", label: "Tìm kiếm", value: searchParams.get("q")! } : null,
    searchParams.get("type") ? { key: "type", label: "Loại án", value: searchParams.get("type")! } : null,
    searchParams.get("status") ? { key: "status", label: "Trạng thái", value: statuses.find((status) => status.value === searchParams.get("status"))?.label || searchParams.get("status")! } : null,
    searchParams.get("createdById") ? { key: "createdById", label: "Điều phối", value: coordinatorOptions.find((option) => option.value === searchParams.get("createdById"))?.label || "Đã chọn" } : null,
    searchParams.get("year") ? { key: "year", label: "Năm", value: searchParams.get("year")! } : null,
    searchParams.get("judgmentNumber") ? { key: "judgmentNumber", label: "Số án", value: searchParams.get("judgmentNumber")! } : null,
    searchParams.get("party") ? { key: "party", label: "Đương sự", value: searchParams.get("party")! } : null,
    searchParams.get("warehouse") ? { key: "warehouse", label: "Kho", value: searchParams.get("warehouse")! } : null,
    searchParams.get("line") ? { key: "line", label: "Dãy", value: searchParams.get("line")! } : null,
    searchParams.get("shelf") ? { key: "shelf", label: "Kệ", value: searchParams.get("shelf")! } : null,
    searchParams.get("slot") ? { key: "slot", label: "Ngăn", value: searchParams.get("slot")! } : null,
  ].filter((filter): filter is { key: string; label: string; value: string } => Boolean(filter));

  const setUrlParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.set("page", "1");
    router.replace(`/?${params.toString()}`);
  };

  const handleSearch = useDebouncedCallback((term: string) => {
    setUrlParam("q", term.trim());
  }, 300);

  const handleTextFilter = useDebouncedCallback((key: string, value: string) => {
    setUrlParam(key, value.trim());
  }, 300);

  const handleReset = () => {
    table.resetColumnFilters();
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
    router.replace(`/?${params.toString()}`);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Row 1: Search & Top Actions */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-[12px] h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm hồ sơ, mã hồ sơ, tiêu đề..."
            defaultValue={searchParams.get("q")?.toString()}
            onChange={(event) => handleSearch(event.target.value)}
            className="h-10 w-full pl-9 bg-background border-slate-300 dark:border-slate-700 shadow-xs focus-visible:border-primary focus-visible:ring-primary/20 transition-all font-medium placeholder:text-muted-foreground/60 focus-visible:ring-2"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Select
            value={density}
            onValueChange={(value) => onDensityChange?.(value as "compact" | "comfortable")}
          >
            <SelectTrigger className="h-9 w-28 rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="comfortable">Thoáng</SelectItem>
              <SelectItem value="compact">Gọn</SelectItem>
            </SelectContent>
          </Select>

          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-lg border-slate-300 dark:border-slate-700">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-semibold text-foreground">Cột hiển thị</span>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Tùy chọn cột</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="text-xs">Tùy chỉnh bảng</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => {
                  const columnIdMap: Record<string, string> = {
                    code: 'Mã hồ sơ',
                    title: 'Tiêu đề / Trích yếu',
                    status: 'Trạng thái',
                    year: 'Năm',
                    pageCount: 'Số bút lục',
                    createdBy: 'Người tạo',
                    updatedBy: 'Người cập nhật',
                    note: 'Ghi chú',
                    actions: 'Thao tác',
                    defendants_civil: 'Bị cáo / Bị đơn',
                    plaintiffs_victims: 'Nguyên đơn / Bị hại'
                  }
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) => column.toggleVisibility(!!value)}
                      className="text-xs"
                    >
                      {columnIdMap[column.id] || column.id}
                    </DropdownMenuCheckboxItem>
                  )
                })}
            </DropdownMenuContent>
          </DropdownMenu>

          {table.getFilteredSelectedRowModel().rows.length === 0 && onCreate && (
            <Button className="h-9 font-semibold rounded-lg" onClick={onCreate}>Thêm hồ sơ</Button>
          )}
        </div>
      </div>

      {/* Row 2: Filters and Reset */}
      <div className="flex flex-wrap items-center gap-2">
        <DataTableFacetedFilter
          title="Loại án"
          options={caseTypes}
          value={searchParams.get("type") ? [searchParams.get("type")!] : []}
          onFilter={(values) => setUrlParam("type", values?.[0] || "all")}
        />

        <DataTableFacetedFilter
          title="Trạng thái"
          options={statuses}
          value={searchParams.get("status") ? [searchParams.get("status")!] : []}
          onFilter={(values) => setUrlParam("status", values?.[0] || "all")}
        />

        {isSuperOrAdmin && (
          <DataTableFacetedFilter
            title="Người điều phối"
            options={coordinatorOptions}
            value={
              searchParams.has("createdById") &&
              searchParams.get("createdById") !== "all" &&
              searchParams.get("createdById") !== "none"
                ? searchParams.get("createdById")!.split(",")
                : []
            }
            onFilter={(values) => {
              if (!values || values.length === 0) {
                setUrlParam("createdById", "all");
              } else {
                setUrlParam("createdById", values.join(","));
              }
            }}
            simpleSummary={true}
            alwaysShowActions={true}
          />
        )}

        <div className="relative flex items-center h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus-within:ring-1 focus-within:ring-primary">
          <CalendarDays className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="number"
            placeholder="Năm..."
            defaultValue={searchParams.get("year")?.toString()}
            onChange={(event) => handleTextFilter("year", event.target.value)}
            className="w-14 bg-transparent focus:outline-none placeholder:text-muted-foreground/80 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none font-medium"
          />
          {searchParams.get("year") && (
            <button
              onClick={() => setUrlParam("year", "")}
              className="ml-1 hover:bg-muted p-0.5 rounded-full"
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>

        <Button
          type="button"
          variant={showAdvancedFilters ? "secondary" : "outline"}
          onClick={() => setShowAdvancedFilters((value) => !value)}
          className="h-8 px-2.5 text-xs rounded-md"
        >
          <SlidersHorizontal className="h-3.5 w-3.5 mr-1" />
          Bộ lọc nâng cao
        </Button>

        {isFiltered && (
          <Button variant="ghost" onClick={handleReset} className="h-8 px-2 text-xs rounded-md">
            Đặt lại
            <X className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Render active filter chips if any exist */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mr-1">Đang lọc:</span>
          {activeFilters.map((filter) => (
            <Badge
              key={filter.key}
              variant="secondary"
              className="gap-1 px-1.5 py-0 text-[10px] font-medium bg-muted/65 border border-muted"
            >
              <span className="text-muted-foreground">{filter.label}:</span>
              <span className="text-foreground max-w-[120px] truncate">{filter.value}</span>
              <button
                type="button"
                onClick={() => setUrlParam(filter.key, "")}
                className="ml-1 size-3 rounded-full hover:bg-muted-foreground/20 flex items-center justify-center"
              >
                <X className="size-2 text-muted-foreground hover:text-foreground" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Row 3: Advanced Filters Panel */}
      {showAdvancedFilters && (
        <div className="grid gap-3 rounded-xl border border-muted/80 bg-muted/15 p-2.5 sm:grid-cols-2">
          {/* Group: Thông tin án */}
          <div className="space-y-1.5">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Thông tin án</h4>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-0.5">
                <label className="text-[9px] font-bold text-muted-foreground uppercase">Số bản án/Quyết định</label>
                <Input
                  placeholder="Ví dụ: 12/2026/HS-ST..."
                  defaultValue={searchParams.get("judgmentNumber")?.toString()}
                  onChange={(event) => handleTextFilter("judgmentNumber", event.target.value)}
                  className="h-7 text-xs rounded bg-background"
                />
              </div>
              <div className="space-y-0.5">
                <label className="text-[9px] font-bold text-muted-foreground uppercase">Đương sự</label>
                <Input
                  placeholder="Tên bị cáo, nguyên đơn..."
                  defaultValue={searchParams.get("party")?.toString()}
                  onChange={(event) => handleTextFilter("party", event.target.value)}
                  className="h-7 text-xs rounded bg-background"
                />
              </div>
            </div>
          </div>

          {/* Group: Vị trí lưu trữ */}
          <div className="space-y-1.5 border-t pt-2 sm:border-t-0 sm:pt-0 sm:border-l sm:pl-3">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Vị trí lưu trữ vật lý</h4>
            <div className="grid grid-cols-4 gap-1.5">
              <div className="space-y-0.5">
                <label className="text-[9px] font-bold text-muted-foreground uppercase">Kho</label>
                <Input
                  placeholder="Kho"
                  defaultValue={searchParams.get("warehouse")?.toString()}
                  onChange={(event) => handleTextFilter("warehouse", event.target.value)}
                  className="h-7 text-xs rounded bg-background"
                />
              </div>
              <div className="space-y-0.5">
                <label className="text-[9px] font-bold text-muted-foreground uppercase">Dãy</label>
                <Input
                  placeholder="Dãy"
                  defaultValue={searchParams.get("line")?.toString()}
                  onChange={(event) => handleTextFilter("line", event.target.value)}
                  className="h-7 text-xs rounded bg-background"
                />
              </div>
              <div className="space-y-0.5">
                <label className="text-[9px] font-bold text-muted-foreground uppercase">Kệ</label>
                <Input
                  placeholder="Kệ"
                  defaultValue={searchParams.get("shelf")?.toString()}
                  onChange={(event) => handleTextFilter("shelf", event.target.value)}
                  className="h-7 text-xs rounded bg-background"
                />
              </div>
              <div className="space-y-0.5">
                <label className="text-[9px] font-bold text-muted-foreground uppercase">Ngăn</label>
                <Input
                  placeholder="Ngăn"
                  defaultValue={searchParams.get("slot")?.toString()}
                  onChange={(event) => handleTextFilter("slot", event.target.value)}
                  className="h-7 text-xs rounded bg-background"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
