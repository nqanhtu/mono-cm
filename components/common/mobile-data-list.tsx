import type React from 'react'

export function MobileDataList<T>({
  items,
  renderItem,
  empty,
}: {
  items: T[]
  renderItem: (item: T) => React.ReactNode
  empty: React.ReactNode
}) {
  if (items.length === 0) return <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">{empty}</div>
  return <div className="grid gap-3 md:hidden">{items.map(renderItem)}</div>
}
