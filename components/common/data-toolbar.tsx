import type React from 'react'

export function DataToolbar({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm dark:bg-card sm:flex-row sm:items-center">
      {children}
    </div>
  )
}
