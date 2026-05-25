import { createContext, useContext, useEffect, useState, useCallback } from 'react'
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
  try {
    const { data, error } = await supabase
      .from('admin_users')
      .select('id, revoked_at')
      .eq('user_id', userId)
    if (error || !data || data.length === 0) return false
    return data.some((row) => !row.revoked_at)
  } catch {
    return false
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshAdmin = useCallback(async (): Promise<void> => {
    const { data } = await supabase.auth.getSession()
    const user = data.session?.user
    if (!user) { setIsAdmin(false); return }
    setIsAdmin(await fetchIsAdmin(user.id))
  }, [])

  // Effect 1: 동기 콜백으로 세션 상태만 추적 (DB 쿼리 없음 — 인증 락 블로킹 방지)
  useEffect(() => {
    let cancelled = false

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (cancelled) return
      console.log('[Auth]', event, newSession?.user?.id?.slice(0, 8) ?? 'null')

      if (event === 'SIGNED_OUT') {
        setSession(null)
        setIsAdmin(false)
        setLoading(false)
        return
      }

      setSession(newSession)

      if (!newSession?.user) {
        setIsAdmin(false)
        setLoading(false)
      }
      // 유저가 있는 경우 loading은 Effect 2에서 해제
    })

    return () => {
      cancelled = true
      listener.subscription.unsubscribe()
    }
  }, [])

  // Effect 2: 세션 유저 변경 시 admin 여부 조회 (인증 락 밖에서 실행)
  useEffect(() => {
    if (!session?.user) return

    let cancelled = false

    fetchIsAdmin(session.user.id).then((result) => {
      if (!cancelled) {
        setIsAdmin(result)
        setLoading(false)
      }
    })

    const timer = setTimeout(() => {
      if (!cancelled) {
        console.warn('[Auth] admin fetch timeout')
        setIsAdmin(false)
        setLoading(false)
      }
    }, 8_000)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [session?.user?.id])

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
