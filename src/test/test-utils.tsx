import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type React from 'react'
import { MemoryRouter } from 'react-router-dom'

type MemoryRouterProps = React.ComponentProps<typeof MemoryRouter>

export function renderWithRouter(ui: React.ReactElement, initialEntries: MemoryRouterProps['initialEntries'] = ['/']) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}
