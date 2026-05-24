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

// 페이지 로드마다 초기화되는 모듈 변수 (F5 포함)
// 이번 로드에서 직접 로그인한 경우에만 true
let _loggedInThisLoad = false

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

  useEffect(() => {
    let cancelled = false
    let forcingSignOut = false
    let seenInitialSession = false

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (cancelled) return

        console.log('[Auth]', event, newSession?.user?.id?.slice(0, 8) ?? 'null', forcingSignOut ? '(forcing logout)' : '')

        if (forcingSignOut && event !== 'SIGNED_OUT') return

        if (event === 'SIGNED_IN') {
          _loggedInThisLoad = true
          // INITIAL_SESSION보다 먼저 오는 경우: INITIAL_SESSION에서 처리
          if (!seenInitialSession) return
        }

        if (event === 'SIGNED_OUT') {
          forcingSignOut = false
          _loggedInThisLoad = false
          setSession(null)
          setIsAdmin(false)
          setLoading(false)
          return
        }

        if (event === 'INITIAL_SESSION') {
          seenInitialSession = true
          console.log('[Auth] INITIAL_SESSION — loggedInThisLoad:', _loggedInThisLoad, '| token:', !!newSession)

          if (newSession && !_loggedInThisLoad) {
            // 이전 로드의 잔류 토큰 → 강제 로그아웃
            console.log('[Auth] stale token → force sign out')
            forcingSignOut = true
            setSession(null)
            setIsAdmin(false)
            setLoading(false)
            supabase.auth.signOut({ scope: 'local' }).catch(() => {})
            return
          }

          if (!newSession) {
            setSession(null)
            setIsAdmin(false)
            setLoading(false)
            return
          }
        }

        setSession(newSession)

        if (!newSession?.user) {
          setIsAdmin(false)
          setLoading(false)
          return
        }

        const result = await fetchIsAdmin(newSession.user.id)
        if (!cancelled) { setIsAdmin(result); setLoading(false) }
      }
    )

    const safetyTimer = setTimeout(() => {
      if (!cancelled) {
        console.warn('[Auth] safety timeout — forcing loading=false')
        setLoading(false)
      }
    }, 8_000)

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
