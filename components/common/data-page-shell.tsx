import type React from 'react'

import { cn } from '@/lib/utils'

export function DataPageShell({
  header,
  toolbar,
  children,
  footer,
  className,
}: {
  header?: React.ReactNode
  toolbar?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('flex w-full flex-col gap-4', className)}>
      {header ? <div>{header}</div> : null}
      {toolbar ? <div>{toolbar}</div> : null}
      <div>{children}</div>
      {footer ? <div>{footer}</div> : null}
    </section>
  )
}

export function TableSurface({
  toolbar,
  children,
  className,
}: {
  toolbar?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('overflow-hidden rounded-lg border bg-background', className)}>
      {toolbar ? <div className="border-b bg-muted/20 px-2 py-2">{toolbar}</div> : null}
      <div>{children}</div>
    </div>
  )
}
