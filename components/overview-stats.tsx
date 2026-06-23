'use client'

import { useState, type ComponentType } from 'react'
import { AlertCircle, Archive, ChevronDown, ChevronUp, FileUp } from 'lucide-react'

import { Skeleton } from '@/components/ui/skeleton'
import { useFileStats } from '@/lib/hooks/use-files'
import { cn } from '@/lib/utils'

type StatItem = {
  label: string
  value: number
  detail: string
  icon: ComponentType<{ className?: string }>
  className: string
  dotClassName: string
}

export function OverviewStats() {
  const { stats, isLoading } = useFileStats()
  const [isExpanded, setIsExpanded] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('dashboard_stats_expanded') === 'true'
    }
    return false
  })

  const toggleExpanded = () => {
    const next = !isExpanded
    setIsExpanded(next)
    localStorage.setItem('dashboard_stats_expanded', String(next))
  }

  const total = stats?.total ?? 0
  const borrowed = stats?.borrowed ?? 0
  const overdue = stats?.overdue ?? 0
  const borrowedRate = total > 0 ? Math.round((borrowed / total) * 100) : 0
  const overdueRate = borrowed > 0 ? Math.round((overdue / borrowed) * 100) : 0

  const items: StatItem[] = [
    {
      label: 'Trong kho',
      value: total,
      detail: 'Tổng hồ sơ đang quản lý',
      icon: Archive,
      className: 'border-emerald-200/70 bg-emerald-50/70 text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-100',
      dotClassName: 'bg-emerald-500',
    },
    {
      label: 'Đang mượn',
      value: borrowed,
      detail: `${borrowedRate}% tổng hồ sơ`,
      icon: FileUp,
      className: 'border-amber-200/80 bg-amber-50/75 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-100',
      dotClassName: 'bg-amber-500',
    },
    {
      label: 'Quá hạn',
      value: overdue,
      detail: overdue > 0 ? `${overdueRate}% hồ sơ đang mượn` : 'Không có hồ sơ quá hạn',
      icon: AlertCircle,
      className: overdue > 0
        ? 'border-red-200/80 bg-red-50/75 text-red-950 dark:border-red-900/70 dark:bg-red-950/20 dark:text-red-100'
        : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-200',
      dotClassName: overdue > 0 ? 'bg-red-500' : 'bg-slate-400',
    },
  ]

  return (
    <section className="rounded-xl border bg-background/90 p-1.5 shadow-sm">
      <div className="flex flex-col gap-1.5 xl:flex-row xl:items-center xl:justify-between">
        <div className="grid min-w-0 flex-1 gap-1.5 md:grid-cols-3">
          {items.map((item) => {
            const Icon = item.icon
            return (
              <div
                key={item.label}
                className={cn(
                  'flex min-h-10 items-center gap-3 rounded-lg border px-3 py-1.5',
                  item.className
                )}
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded bg-white/70 shadow-xs dark:bg-white/10">
                  <Icon className="size-3" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold">
                    <span className={cn('size-1.5 rounded-full', item.dotClassName)} />
                    <span>{item.label}</span>
                  </div>
                  {isLoading ? (
                    <Skeleton className="mt-0.5 h-4 w-12" />
                  ) : (
                    <p className="mt-0.5 text-base font-bold leading-none tabular-nums">{item.value}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <button
          type="button"
          onClick={toggleExpanded}
          className="flex h-6 shrink-0 items-center justify-center gap-1 rounded px-1.5 text-[10px] font-medium text-muted-foreground/75 hover:bg-muted/70 hover:text-foreground transition-colors xl:justify-start"
        >
          {isExpanded ? <ChevronUp className="size-2.5" /> : <ChevronDown className="size-2.5" />}
          {isExpanded ? 'Chi tiết kho' : 'Chi tiết kho'}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-1.5 grid gap-1.5 border-t pt-1.5 md:grid-cols-3">
          {items.map((item) => (
            <div key={item.label} className="rounded bg-muted/40 px-3 py-1.5">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">{item.label}</p>
              <p className="mt-0.5 text-xs font-medium text-foreground">{item.detail}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
