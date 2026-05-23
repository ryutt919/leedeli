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
  const cached = sessionStorage.getItem(`is_admin_${userId}`)
  if (cached === 'true') {
    console.debug('[Auth] isAdmin: sessionStorage hit')
    return true
  }

  try {
    console.debug('[Auth] fetchIsAdmin: querying DB for', userId.slice(0, 8))
    const { data, error } = await supabase
      .from('admin_users')
      .select('id, revoked_at')
      .eq('user_id', userId)

    if (error) {
      console.error('[Auth] fetchIsAdmin error:', error.message)
      return false
    }
    if (!data || data.length === 0) return false

    const isActive = data.some((row) => !row.revoked_at)
    if (isActive) sessionStorage.setItem(`is_admin_${userId}`, 'true')
    console.debug('[Auth] fetchIsAdmin result:', isActive)
    return isActive
  } catch (e) {
    console.error('[Auth] fetchIsAdmin exception:', e)
    return false
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshAdmin = useCallback(async (): Promise<void> => {
    const { data: sessionData } = await supabase.auth.getSession()
    const user = sessionData?.session?.user
    if (!user) { setIsAdmin(false); return }
    const admin = await fetchIsAdmin(user.id)
    setIsAdmin(admin)
  }, [])

  useEffect(() => {
    let cancelled = false

    // 단일 경로: onAuthStateChange만 사용 (INITIAL_SESSION 포함 처리)
    // 이전 코드는 init()+onAuthStateChange 두 경로가 동시에 실행되어
    // loading 상태가 경쟁 조건으로 true에 멈추는 버그 발생
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (cancelled) return

        console.debug('[Auth] event:', event, '| user:', newSession?.user?.id?.slice(0, 8) ?? 'null')

        setSession(newSession)

        if (!newSession?.user || event === 'SIGNED_OUT') {
          setIsAdmin(false)
          setLoading(false)
          return
        }

        // TOKEN_REFRESHED는 동일 유저의 토큰 갱신 — 관리자 재확인 불필요
        if (event === 'TOKEN_REFRESHED') {
          // sessionStorage 캐시가 있으면 즉시 반환, 없으면 DB 조회
          const result = await fetchIsAdmin(newSession.user.id)
          if (!cancelled) { setIsAdmin(result); setLoading(false) }
          return
        }

        // INITIAL_SESSION, SIGNED_IN, USER_UPDATED
        setLoading(true)
        const result = await fetchIsAdmin(newSession.user.id)
        if (!cancelled) { setIsAdmin(result); setLoading(false) }
      }
    )

    // 안전망: 10초 후에도 loading이 true면 강제 해제
    const safetyTimer = setTimeout(() => {
      if (!cancelled) {
        console.warn('[Auth] safety timeout — forcing loading=false')
        setLoading(false)
      }
    }, 10_000)

    return () => {
      cancelled = true
      clearTimeout(safetyTimer)
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
