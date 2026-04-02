import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../utils/supabase'

export type AuthContextValue = {
  session: Session | null
  isAdmin: boolean | null
  loading: boolean
  refreshAdmin: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

async function fetchIsAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('admin_users')
    .select('id')
    .eq('user_id', userId)
    .is('revoked_at', null)
    .limit(1)

  if (error) {
    console.error('[AuthContext] admin_users 조회 오류:', error)
    return false
  }
  return Array.isArray(data) && data.length > 0
}

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [session, setSession] = useState<Session | null>(null)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  async function refreshAdmin(): Promise<void> {
    const { data: sessionData } = await supabase.auth.getSession()
    const user = sessionData?.session?.user
    if (!user) {
      setIsAdmin(false)
      return
    }
    const admin = await fetchIsAdmin(user.id)
    setIsAdmin(admin)
  }

  useEffect(() => {
    let cancelled = false

    async function init(): Promise<void> {
      const { data: sessionData } = await supabase.auth.getSession()
      const currentSession = sessionData?.session ?? null

      if (cancelled) return
      setSession(currentSession)

      if (currentSession?.user) {
        const admin = await fetchIsAdmin(currentSession.user.id)
        if (!cancelled) setIsAdmin(admin)
      } else {
        if (!cancelled) setIsAdmin(false)
      }

      if (!cancelled) setLoading(false)
    }

    init()

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (cancelled) return
      setSession(newSession)
      if (newSession?.user) {
        const admin = await fetchIsAdmin(newSession.user.id)
        if (!cancelled) setIsAdmin(admin)
      } else {
        if (!cancelled) setIsAdmin(false)
      }
    })

    return () => {
      cancelled = true
      listener.subscription.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ session, isAdmin, loading, refreshAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
