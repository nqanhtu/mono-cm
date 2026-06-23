'use client'

import { apiFetch } from '@/lib/api/client'
import { queryClient } from '@/src/lib/query-client'
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'

export interface SessionData {
  id: string
  username: string
  role: string
  fullName: string
}

interface SessionContextType {
  session: SessionData | null
  isLoading: boolean
  isError: unknown
  isAuthenticated: boolean
  refreshSession: () => Promise<void>
  mutate: () => Promise<void>
  logout: () => Promise<void>
}

const SessionContext = createContext<SessionContextType | undefined>(undefined)

export function SessionProvider({
  children,
  initialSession = null,
}: {
  children: React.ReactNode
  initialSession?: SessionData | null
}) {
  const [session, setSession] = useState<SessionData | null>(initialSession)
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState<unknown>(null)

  const refreshSession = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await apiFetch('/api/auth/session')
      if (res.ok) {
        const data = await res.json()
        setSession(data)
      } else {
        setSession(null)
      }
    } catch (err) {
      setIsError(err)
      setSession(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' })
    setSession(null)
    queryClient.clear()
  }, [])

  useEffect(() => {
    refreshSession()
    window.addEventListener('app:refresh-session', refreshSession)
    return () => window.removeEventListener('app:refresh-session', refreshSession)
  }, [refreshSession])

  return (
    <SessionContext.Provider
      value={{
        session,
        isLoading,
        isError,
        isAuthenticated: !!session,
        refreshSession,
        mutate: refreshSession,
        logout,
      }}
    >
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const context = useContext(SessionContext)
  if (context === undefined) {
    throw new Error('useSession phải được đặt bên trong SessionProvider')
  }
  return context
}
