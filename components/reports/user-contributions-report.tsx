'use client'

import { useState, useMemo } from 'react'
import { useSession } from '@/lib/hooks/use-auth'
import { useUsers } from '@/lib/hooks/use-users'
import { useUserContributions } from '@/lib/hooks/use-reports'
import { format, subDays, startOfMonth } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CalendarRange, Loader2, Award, FileText, ClipboardList } from 'lucide-react'

export function UserContributionsReport() {
  const { session } = useSession()
  const { users } = useUsers()
  
  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(session?.role || '')

  // State filters
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const activeUserId = selectedUserId || session?.id || ''
  const [dateRangePreset, setDateRangePreset] = useState<'7' | '30' | 'month'>('30')

  const dateFilters = useMemo(() => {
    const to = new Date()
    let from = subDays(to, 30)

    if (dateRangePreset === '7') {
      from = subDays(to, 7)
    } else if (dateRangePreset === 'month') {
      from = startOfMonth(to)
    }

    return {
      from: format(from, 'yyyy-MM-dd'),
      to: format(to, 'yyyy-MM-dd'),
    }
  }, [dateRangePreset])

  const { data, isLoading } = useUserContributions({
    userId: activeUserId,
    from: dateFilters.from,
    to: dateFilters.to,
  })

  const contributionsList = data?.contributions || []

  // Totals calculations
  const stats = useMemo(() => {
    let totalFiles = 0
    let totalDocs = 0
    contributionsList.forEach((c) => {
      totalFiles += c.files
      totalDocs += c.documents
    })
    const totalDays = contributionsList.filter(c => c.total > 0).length
    const avgDaily = totalDays > 0 ? Math.round((totalFiles + totalDocs) / totalDays) : 0

    return { totalFiles, totalDocs, total: totalFiles + totalDocs, avgDaily }
  }, [contributionsList])

  // Format chart date
  const chartData = useMemo(() => {
    return contributionsList.map((c) => {
      const [, m, d] = c.date.split('-')
      return {
        ...c,
        formattedDate: `${d}/${m}`,
      }
    })
  }, [contributionsList])

  // Filter active users to list
  const activeUsers = useMemo(() => users.filter(u => u.status), [users])

  return (
    <div className="flex flex-col gap-4">
      {/* Filters Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between border-b pb-3 mb-1">
        <div className="flex items-center gap-2">
          <CalendarRange className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground">Bộ lọc thống kê đóng góp</span>
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {isAdmin && (
            <Select value={activeUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="w-[200px] h-9">
                <SelectValue placeholder="Chọn cán bộ" />
              </SelectTrigger>
              <SelectContent>
                {activeUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.fullName} ({user.username})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          <div className="flex border rounded-md overflow-hidden h-9">
            {[
              { label: '7 ngày qua', value: '7' },
              { label: '30 ngày qua', value: '30' },
              { label: 'Tháng này', value: 'month' },
            ].map((preset) => (
              <button
                key={preset.value}
                className={`px-3 text-xs font-medium border-r last:border-r-0 ${
                  dateRangePreset === preset.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background hover:bg-muted'
                }`}
                onClick={() => setDateRangePreset(preset.value as any)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading Indicator */}
      {isLoading && (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      )}

      {!isLoading && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Tổng hồ sơ đã tạo", value: stats.totalFiles, icon: FileText, className: "border-blue-200/70 bg-blue-50/70 text-blue-900 dark:border-blue-900/70 dark:bg-blue-950/20 dark:text-blue-100" },
              { label: "Tổng văn bản đã tạo", value: stats.totalDocs, icon: ClipboardList, className: "border-emerald-200/70 bg-emerald-50/70 text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-100" },
              { label: "Tổng lượt đóng góp", value: stats.total, icon: Award, className: "border-amber-200/70 bg-amber-50/70 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-100" },
              { label: "Trung bình ngày hoạt động", value: stats.avgDaily, icon: CalendarRange, className: "border-purple-200/70 bg-purple-50/70 text-purple-900 dark:border-purple-900/70 dark:bg-purple-950/20 dark:text-purple-100" },
            ].map((stat, i) => (
              <div key={i} className={`flex min-h-12 items-center gap-3 rounded-lg border px-3 py-2 ${stat.className}`}>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-white/70 shadow-xs dark:bg-white/10">
                  <stat.icon className="size-3.5" />
                </span>
                <div>
                  <div className="text-xs font-semibold">{stat.label}</div>
                  <p className="mt-0.5 text-lg font-semibold leading-none tabular-nums">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Recharts Bar Chart */}
          <Card className="p-4 border rounded-lg bg-card text-card-foreground">
            <h3 className="text-sm font-semibold mb-4">Biểu đồ đóng góp nhập dữ liệu</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <XAxis dataKey="formattedDate" fontSize={11} stroke="#888888" tickLine={false} />
                  <YAxis fontSize={11} stroke="#888888" tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                  <Bar name="Hồ sơ mới" dataKey="files" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                  <Bar name="Văn bản mới" dataKey="documents" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Detailed Table */}
          <Card className="border rounded-lg bg-card">
            <div className="px-4 py-3 border-b">
              <h3 className="text-sm font-semibold">Bảng thống kê chi tiết</h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-1/3">Ngày</TableHead>
                  <TableHead className="text-center">Số hồ sơ</TableHead>
                  <TableHead className="text-center">Số văn bản</TableHead>
                  <TableHead className="text-right">Tổng cộng</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contributionsList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground text-sm">
                      Không có dữ liệu trong khoảng thời gian này.
                    </TableCell>
                  </TableRow>
                ) : (
                  [...contributionsList].reverse().map((row) => {
                    const [y, m, d] = row.date.split('-')
                    const formattedDisplayDate = `${d}/${m}/${y}`
                    return (
                      <TableRow key={row.date} className={row.total > 0 ? '' : 'opacity-60'}>
                        <TableCell className="font-medium">
                          {formattedDisplayDate}
                        </TableCell>
                        <TableCell className="text-center tabular-nums">{row.files}</TableCell>
                        <TableCell className="text-center tabular-nums">{row.documents}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{row.total}</TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  )
}
