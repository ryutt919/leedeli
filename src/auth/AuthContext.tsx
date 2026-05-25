import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
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

  // 내부 admin fetch 상태 ref (React 렌더 사이클 외부에서 관리)
  const adminFetchRef = useRef<{
    userId: string
    cancel: () => void
    retryTimer: ReturnType<typeof setTimeout> | null
  } | null>(null)

  // 특정 userId에 대한 admin fetch + timeout + 재시도를 실행하는 함수
  const runAdminFetch = useCallback((userId: string) => {
    // 이전 fetch/retry 취소
    if (adminFetchRef.current) {
      adminFetchRef.current.cancel()
    }

    let isCancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    const cancel = () => {
      isCancelled = true
      if (retryTimer) clearTimeout(retryTimer)
    }

    adminFetchRef.current = { userId, cancel, retryTimer: null }

    setLoading(true)

    // 10초 타임아웃: 응답 없으면 null로 loading 해제 + 30초 후 재시도
    // ⚠️ isAdmin을 false로 설정하지 않음 — 세션은 유효하므로 비관리자로 처리 금지
    const timeoutId = setTimeout(() => {
      if (isCancelled) return
      console.warn('[Auth] admin fetch timeout — retrying in 30s')
      isCancelled = true // 현재 fetch 응답은 무시
      setIsAdmin(null)  // null = "확인 중/실패" (false와 다름)
      setLoading(false)

      // 30초 후 자동 재시도 (네트워크 복구 대비)
      retryTimer = setTimeout(() => {
        if (adminFetchRef.current?.userId === userId) {
          console.info('[Auth] retrying admin fetch...')
          runAdminFetch(userId)
        }
      }, 30_000)
      if (adminFetchRef.current) adminFetchRef.current.retryTimer = retryTimer
    }, 10_000)

    fetchIsAdmin(userId).then((result) => {
      clearTimeout(timeoutId)
      if (!isCancelled) {
        setIsAdmin(result)
        setLoading(false)
      }
    }).catch(() => {
      clearTimeout(timeoutId)
      if (!isCancelled) {
        console.warn('[Auth] admin fetch error — retrying in 30s')
        setIsAdmin(null)
        setLoading(false)
        // 오류 시도 30초 후 재시도
        retryTimer = setTimeout(() => {
          if (adminFetchRef.current?.userId === userId) {
            runAdminFetch(userId)
          }
        }, 30_000)
        if (adminFetchRef.current) adminFetchRef.current.retryTimer = retryTimer
      }
    })

    return cancel
  }, [])

  const refreshAdmin = useCallback(async (): Promise<void> => {
    const { data } = await supabase.auth.getSession()
    const user = data.session?.user
    if (!user) { setIsAdmin(false); return }
    runAdminFetch(user.id)
  }, [runAdminFetch])

  // Effect 1: 세션 상태 추적 (onAuthStateChange)
  useEffect(() => {
    let cancelled = false

    // 초기 세션 복원
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      const s = data.session
      setSession(s)
      if (!s?.user) {
        setIsAdmin(false)
        setLoading(false)
      }
      // user가 있는 경우 loading은 Effect 2에서 해제
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (cancelled) return
      console.log('[Auth]', event, newSession?.user?.id?.slice(0, 8) ?? 'null')

      if (event === 'SIGNED_OUT') {
        // 진행 중인 admin fetch/재시도 전부 취소
        adminFetchRef.current?.cancel()
        adminFetchRef.current = null
        setSession(null)
        setIsAdmin(false)
        setLoading(false)
        return
      }

      // TOKEN_REFRESHED: 세션 토큰만 갱신됨, user ID 동일 → admin 재조회 불필요
      // (이 이벤트로 setSession 하면 session?.user?.id가 동일하여 Effect 2 재실행 없음)
      if (event === 'TOKEN_REFRESHED') {
        setSession(newSession)
        return
      }

      // SIGNED_IN / INITIAL_SESSION / USER_UPDATED / etc.
      setSession(newSession)

      if (!newSession?.user) {
        setIsAdmin(false)
        setLoading(false)
      }
      // user가 있는 경우 loading은 Effect 2에서 해제
    })

    return () => {
      cancelled = true
      listener.subscription.unsubscribe()
      // 컴포넌트 언마운트 시 진행 중인 모든 fetch/retry 취소
      adminFetchRef.current?.cancel()
    }
  }, [])

  // Effect 2: 세션 유저 ID 변경 시 admin 여부 조회
  // deps: [session?.user?.id] — user ID가 실제로 바뀔 때만 실행
  useEffect(() => {
    if (!session?.user) return
    const cancel = runAdminFetch(session.user.id)
    return cancel
  }, [session?.user?.id, runAdminFetch])

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
