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

// sessionStorage 키: 탭/창 닫으면 자동 소멸 (localStorage와 달리 브라우저 재시작 시 초기화)
const SESSION_ALIVE_KEY = 'leedeli_session_alive'

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

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (cancelled) return

        console.debug('[Auth]', event, newSession?.user?.id?.slice(0, 8) ?? 'null')

        // 로그인 성공 → 이번 브라우저 세션 활성 표시
        if (event === 'SIGNED_IN') {
          sessionStorage.setItem(SESSION_ALIVE_KEY, '1')
        }
        // 로그아웃 → 표시 제거
        if (event === 'SIGNED_OUT') {
          sessionStorage.removeItem(SESSION_ALIVE_KEY)
          setSession(null)
          setIsAdmin(false)
          setLoading(false)
          return
        }

        // INITIAL_SESSION: 브라우저 재시작 감지
        if (event === 'INITIAL_SESSION') {
          const aliveThisSession = !!sessionStorage.getItem(SESSION_ALIVE_KEY)

          if (newSession && !aliveThisSession) {
            // localStorage에 토큰 잔존하지만 이번 세션에서 로그인한 적 없음
            // → 강제 로그아웃 (SIGNED_OUT 이벤트가 뒤따라 발생)
            console.debug('[Auth] stale token detected — signing out')
            await supabase.auth.signOut()
            return
          }

          if (!newSession) {
            // 세션 없음 → 로그인 화면으로
            setSession(null)
            setIsAdmin(false)
            setLoading(false)
            return
          }

          // 유효한 현재 세션 → 그대로 진행
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
