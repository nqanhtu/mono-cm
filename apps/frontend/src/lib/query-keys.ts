export const queryKeys = {
  session: ['session'] as const,
  files: {
    all: ['files'] as const,
    list: (params?: string) => ['files', 'list', params || ''] as const,
    detail: (id: string) => ['files', 'detail', id] as const,
    stats: ['files', 'stats'] as const,
    autocompleteSuggestions: ['files', 'autocomplete-suggestions'] as const,
  },
  borrow: {
    all: ['borrow'] as const,
    list: ['borrow', 'list'] as const,
    alerts: ['borrow', 'alerts'] as const,
    history: (id: string) => ['borrow', 'history', id] as const,
  },
  boxes: {
    all: ['boxes'] as const,
    list: (params?: string) => ['boxes', 'list', params || ''] as const,
    qr: (id: string) => ['boxes', 'qr', id] as const,
    layout: ['boxes', 'layout'] as const,
    layoutOccupancy: (params?: string) => ['boxes', 'layout', 'occupancy', params || ''] as const,
  },
  agencies: {
    all: ['agencies'] as const,
    list: ['agencies', 'list'] as const,
  },
  users: {
    all: ['users'] as const,
    list: (purpose?: string) => ['users', 'list', purpose || ''] as const,
  },
  audit: {
    all: ['audit'] as const,
    list: (params?: string) => ['audit', 'list', params || ''] as const,
    accessLogs: (params?: string) => ['audit', 'access-logs', params || ''] as const,
  },
  reports: {
    stats: ['reports', 'stats'] as const,
    files: (params?: string) => ['reports', 'files', params || ''] as const,
    contributions: (params: { userId?: string; from?: string; to?: string }) => 
      ['reports', 'contributions', params.userId || '', params.from || '', params.to || ''] as const,
  },
  backup: {
    schedule: ['backup', 'schedule'] as const,
  },
} as const
