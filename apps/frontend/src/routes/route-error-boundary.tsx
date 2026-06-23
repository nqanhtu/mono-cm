import type React from 'react'
import { Component } from 'react'
import { AlertTriangle } from 'lucide-react'

import { Button } from '@/components/ui/button'

type RouteErrorBoundaryState = {
  error: Error | null
}

export class RouteErrorBoundary extends Component<
  { children: React.ReactNode },
  RouteErrorBoundaryState
> {
  state: RouteErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-md rounded-lg border bg-card p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">Không thể hiển thị trang</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Trang gặp lỗi trong lúc tải dữ liệu hoặc giao diện. Vui lòng thử tải lại.
          </p>
          <Button className="mt-5" onClick={() => window.location.reload()}>
            Tải lại trang
          </Button>
        </div>
      </div>
    )
  }
}
