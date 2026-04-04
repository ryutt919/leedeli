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
  // 5초 타임아웃 추가
  const timeout = new Promise<boolean>((_, reject) =>
    setTimeout(() => reject(new Error('Admin check timeout')), 5000)
  )

  try {
    const fetchTask = (async () => {
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
    })()

    return await Promise.race([fetchTask, timeout])
  } catch (e) {
    console.error('[AuthContext] admin_users 조회 실패 또는 타임아웃:', e)
    return false
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
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
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError

        const currentSession = sessionData?.session ?? null

        if (cancelled) return
        setSession(currentSession)
        // session 여부가 확정된 즉시 loading 해제 → RequireAuth가 즉시 /login으로 redirect 가능
        if (!cancelled) setLoading(false)

        if (currentSession?.user) {
          const admin = await fetchIsAdmin(currentSession.user.id)
          if (!cancelled) setIsAdmin(admin)
        } else {
          if (!cancelled) setIsAdmin(false)
        }
      } catch (err) {
        console.error('[AuthContext] 초기화 실패:', err)
        if (!cancelled) {
          setSession(null)
          setIsAdmin(false)
          setLoading(false)
        }
      }
    }

    init()

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      // INITIAL_SESSION은 init()과 중복 실행되므로 무시
      if (event === 'INITIAL_SESSION') return
      // TOKEN_REFRESHED / USER_UPDATED: 세션만 갱신, 동일 사용자이므로 admin 재조회 불필요
      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (!cancelled) setSession(newSession)
        return
      }
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
