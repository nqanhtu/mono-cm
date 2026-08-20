'use client'

import { useState, useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from 'recharts'
import {
  FileText,
  TrendingUp,
  Calendar,
  Layers,
  Download,
  Printer,
  Loader2,
  CalendarRange,
  Table as TableIcon,
  BarChart3,
  ExternalLink,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useCaseMatrix } from '@/lib/hooks/use-reports'
import { CaseDrilldownDialog } from '@/components/reports/case-drilldown-dialog'
import { apiFetch } from '@/lib/api/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const CASE_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#8b5cf6', // violet
  '#f59e0b', // amber
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#6366f1', // indigo
  '#14b8a6', // teal
  '#84cc16', // lime
]

export function CaseStatsReport() {
  const currentYear = new Date().getFullYear()

  // Preset states
  const [preset, setPreset] = useState<'all' | '5' | '10' | 'custom'>('5')
  const [fromYear, setFromYear] = useState<number>(currentYear - 4)
  const [toYear, setToYear] = useState<number>(currentYear)
  const [isExporting, setIsExporting] = useState(false)

  // Drilldown dialog state
  const [drilldown, setDrilldown] = useState<{
    open: boolean
    year: number | null
    type: string | null
  }>({
    open: false,
    year: null,
    type: null,
  })

  // Handle preset change
  const handlePresetChange = (nextPreset: 'all' | '5' | '10' | 'custom') => {
    setPreset(nextPreset)
    if (nextPreset === '5') {
      setFromYear(currentYear - 4)
      setToYear(currentYear)
    } else if (nextPreset === '10') {
      setFromYear(currentYear - 9)
      setToYear(currentYear)
    }
  }

  // Query parameters
  const queryParams = useMemo(() => {
    if (preset === 'all') return {}
    return { fromYear, toYear }
  }, [preset, fromYear, toYear])

  const { data, isLoading } = useCaseMatrix(queryParams)

  const years = data?.years || []
  const matrix = data?.matrix || []
  const yearTotals = data?.yearTotals || {}
  const grandTotal = data?.grandTotal || 0
  const totalPageCount = data?.totalPageCount || 0
  const topType = data?.topType
  const peakYear = data?.peakYear

  // Generate Year options for dropdowns (e.g., 2000 to currentYear + 1)
  const yearOptions = useMemo(() => {
    const opts: number[] = []
    for (let y = currentYear + 1; y >= 1990; y--) {
      opts.push(y)
    }
    return opts
  }, [currentYear])

  // Transform matrix data for Recharts BarChart
  const chartData = useMemo(() => {
    return years.map((y) => {
      const point: Record<string, string | number> = { year: String(y) }
      matrix.forEach((row) => {
        point[row.type] = row.countsByYear[String(y)] || 0
      })
      return point
    })
  }, [years, matrix])

  // Top types to show in bar chart (max 6 for legibility)
  const topTypesForChart = useMemo(() => {
    return matrix.slice(0, 6).map((r) => r.type)
  }, [matrix])

  // Export Excel
  const exportExcel = async () => {
    setIsExporting(true)
    try {
      const params = new URLSearchParams({ type: 'case-matrix', format: 'xlsx' })
      if (preset !== 'all') {
        params.append('fromYear', String(fromYear))
        params.append('toYear', String(toYear))
      }
      const response = await apiFetch(`/api/reports/export?${params.toString()}`)
      if (!response.ok) throw new Error('Không thể kết xuất báo cáo')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `thong-ke-ho-so-an-${preset === 'all' ? 'toan-bo' : `${fromYear}-${toYear}`}.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      toast.success('Đã xuất báo cáo ma trận hồ sơ án')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Lỗi kết nối')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Top Filter & Action Bar */}
      <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between border-b pb-3 mb-1">
        <div className="flex items-center gap-2">
          <CalendarRange className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground">Bộ lọc thời gian</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Presets */}
          <div className="flex border rounded-md overflow-hidden h-9">
            {[
              { label: '5 năm gần nhất', value: '5' },
              { label: '10 năm gần nhất', value: '10' },
              { label: 'Toàn bộ', value: 'all' },
              { label: 'Tùy chọn', value: 'custom' },
            ].map((p) => (
              <button
                key={p.value}
                className={cn(
                  'px-3 text-xs font-medium border-r last:border-r-0 transition-colors',
                  preset === p.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background hover:bg-muted text-foreground'
                )}
                onClick={() => handlePresetChange(p.value as any)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom Year Pickers */}
          {preset === 'custom' && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Từ</span>
              <Select
                value={String(fromYear)}
                onValueChange={(val) => setFromYear(parseInt(val, 10))}
              >
                <SelectTrigger className="w-[95px] h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)} className="text-xs">
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">Đến</span>
              <Select
                value={String(toYear)}
                onValueChange={(val) => setToYear(parseInt(val, 10))}
              >
                <SelectTrigger className="w-[95px] h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions
                    .filter((y) => y >= fromYear)
                    .map((y) => (
                      <SelectItem key={y} value={String(y)} className="text-xs">
                        {y}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-1.5 ml-auto">
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs"
              onClick={() => window.print()}
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">In</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs"
              onClick={exportExcel}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>Xuất Excel</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                label: 'Tổng số hồ sơ án',
                value: grandTotal.toLocaleString('vi-VN'),
                sub: `${years.length} năm thống kê`,
                icon: FileText,
                className:
                  'border-blue-200/70 bg-blue-50/70 text-blue-900 dark:border-blue-900/70 dark:bg-blue-950/20 dark:text-blue-100',
              },
              {
                label: 'Loại án phổ biến nhất',
                value: topType ? topType.type : '-',
                sub: topType ? `${topType.count} vụ án` : '',
                icon: Layers,
                className:
                  'border-emerald-200/70 bg-emerald-50/70 text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-100',
              },
              {
                label: 'Năm cao điểm thụ lý',
                value: peakYear ? `Năm ${peakYear.year}` : '-',
                sub: peakYear ? `${peakYear.count} vụ án` : '',
                icon: TrendingUp,
                className:
                  'border-amber-200/70 bg-amber-50/70 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-100',
              },
              {
                label: 'Quy mô số hóa tài liệu',
                value: totalPageCount.toLocaleString('vi-VN'),
                sub: 'Tổng trang lưu trữ',
                icon: Calendar,
                className:
                  'border-purple-200/70 bg-purple-50/70 text-purple-900 dark:border-purple-900/70 dark:bg-purple-950/20 dark:text-purple-100',
              },
            ].map((stat, i) => (
              <div
                key={i}
                className={cn(
                  'flex min-h-14 items-center gap-3 rounded-lg border px-3.5 py-2.5 shadow-xs',
                  stat.className
                )}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-white/70 shadow-xs dark:bg-white/10">
                  <stat.icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold tracking-tight">{stat.label}</div>
                  <p className="mt-0.5 text-base sm:text-lg font-bold leading-tight truncate">
                    {stat.value}
                  </p>
                  {stat.sub && (
                    <span className="text-[10px] opacity-75 font-medium">{stat.sub}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Bar Chart Section */}
          {grandTotal > 0 && (
            <Card className="p-4 border rounded-lg bg-card text-card-foreground">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Biểu đồ phân bố số lượng án qua các năm
                  </h3>
                </div>
                <span className="text-[11px] text-muted-foreground">Đơn vị tính: Vụ án</span>
              </div>
              <div className="h-64 sm:h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis
                      dataKey="year"
                      fontSize={11}
                      stroke="#888888"
                      tickLine={false}
                    />
                    <YAxis
                      fontSize={11}
                      stroke="#888888"
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--popover)',
                        borderColor: 'var(--border)',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: 'var(--popover-foreground)',
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                    />
                    {topTypesForChart.map((type, idx) => (
                      <Bar
                        key={type}
                        dataKey={type}
                        name={type}
                        fill={CASE_COLORS[idx % CASE_COLORS.length]}
                        radius={[4, 4, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* Matrix Table */}
          <Card className="border rounded-lg bg-card text-card-foreground overflow-hidden">
            <div className="flex items-center justify-between p-3.5 border-b bg-muted/20">
              <div className="flex items-center gap-2">
                <TableIcon className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Ma trận Thống kê Hồ sơ Án theo Loại và Năm
                </h3>
              </div>
              <span className="text-[11px] text-muted-foreground italic">
                * Nhấp vào số lượng để xem danh sách hồ sơ chi tiết
              </span>
            </div>

            <div className="overflow-x-auto">
              <Table className="w-full border-collapse">
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="sticky left-0 z-10 bg-muted/95 min-w-[200px] text-xs font-bold uppercase tracking-wider py-2.5 pl-4 border-r">
                      Loại hồ sơ án
                    </TableHead>
                    {years.map((y) => (
                      <TableHead
                        key={y}
                        className="text-center min-w-[70px] text-xs font-bold uppercase tracking-wider py-2.5 px-2"
                      >
                        {y}
                      </TableHead>
                    ))}
                    <TableHead className="text-right min-w-[90px] text-xs font-bold uppercase tracking-wider py-2.5 pr-4 bg-muted/60 border-l font-mono">
                      Tổng cộng
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matrix.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={years.length + 2}
                        className="text-center py-8 text-xs text-muted-foreground"
                      >
                        Không có dữ liệu trong khoảng thời gian đã chọn.
                      </TableCell>
                    </TableRow>
                  ) : (
                    matrix.map((row) => (
                      <TableRow key={row.type} className="hover:bg-muted/30 group">
                        <TableCell className="sticky left-0 z-10 bg-background group-hover:bg-muted/30 font-medium text-xs text-foreground pl-4 border-r">
                          {row.type}
                        </TableCell>
                        {years.map((y) => {
                          const count = row.countsByYear[String(y)] || 0
                          return (
                            <TableCell
                              key={y}
                              className="text-center py-2 px-1 text-xs tabular-nums"
                            >
                              {count > 0 ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDrilldown({
                                      open: true,
                                      year: y,
                                      type: row.type,
                                    })
                                  }
                                  className="inline-flex items-center justify-center min-w-8 h-6 px-1.5 rounded text-xs font-semibold text-primary bg-primary/10 hover:bg-primary hover:text-primary-foreground transition-colors group/btn"
                                  title={`Xem chi tiết ${count} vụ án ${row.type} năm ${y}`}
                                >
                                  <span>{count}</span>
                                  <ExternalLink className="w-2.5 h-2.5 ml-1 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                                </button>
                              ) : (
                                <span className="text-muted-foreground/40">-</span>
                              )}
                            </TableCell>
                          )
                        })}
                        <TableCell className="text-right py-2 pr-4 font-bold text-xs tabular-nums bg-muted/10 border-l">
                          {row.total > 0 ? (
                            <span className="font-semibold text-foreground">
                              {row.total}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}

                  {/* Summary Totals Row */}
                  {matrix.length > 0 && (
                    <TableRow className="bg-muted/50 font-bold border-t-2">
                      <TableCell className="sticky left-0 z-10 bg-muted/95 text-xs font-bold text-foreground pl-4 border-r">
                        Tổng cộng theo năm
                      </TableCell>
                      {years.map((y) => {
                        const yTotal = yearTotals[y] || 0
                        return (
                          <TableCell
                            key={y}
                            className="text-center py-2.5 px-1 text-xs font-bold tabular-nums text-foreground"
                          >
                            {yTotal > 0 ? yTotal : '-'}
                          </TableCell>
                        )
                      })}
                      <TableCell className="text-right py-2.5 pr-4 text-xs font-black text-primary tabular-nums bg-primary/10 border-l">
                        {grandTotal}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}

      {/* Drilldown Modal */}
      <CaseDrilldownDialog
        open={drilldown.open}
        onOpenChange={(open) => setDrilldown((prev) => ({ ...prev, open }))}
        year={drilldown.year}
        type={drilldown.type}
      />
    </div>
  )
}
