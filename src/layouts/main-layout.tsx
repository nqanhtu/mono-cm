import { Outlet } from 'react-router-dom'

import { AppSidebar } from '@/components/app-sidebar'
import { BorrowAlertBanner } from '@/components/borrow/borrow-alert-banner'
import Header from '@/components/header'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { useSession } from '@/lib/hooks/use-auth'
import { CommandPalette } from '@/components/command-palette'

export function MainLayout() {
  const { session } = useSession()

  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 60)',
          '--header-height': 'calc(var(--spacing) * 12)',
        } as React.CSSProperties
      }
    >
      <AppSidebar user={session ?? undefined} />
      <SidebarInset className="h-svh min-h-0 overflow-hidden">
        <Header user={session ?? undefined} />
        <BorrowAlertBanner />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="@container/main min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            <div className="mx-auto flex min-h-full w-full max-w-360 flex-col gap-2 p-4 md:p-6 lg:p-8">
              <Outlet />
            </div>
          </div>
        </div>
      </SidebarInset>
      <CommandPalette />
    </SidebarProvider>
  )
}
