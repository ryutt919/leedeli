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
  // 캐시 확인: 이번 세션에서 이미 확인된 적이 있는지 (보안은 DB RLS가 담당하므로 UI 캐시는 안전)
  const cached = sessionStorage.getItem(`is_admin_${userId}`);
  if (cached === 'true') return true;

  try {
    const { data, error } = await supabase
      .from('admin_users')
      .select('id, revoked_at')
      .eq('user_id', userId);

    if (error || !data || data.length === 0) return false;

    const isActive = data.some(row => !row.revoked_at);
    if (isActive) {
      sessionStorage.setItem(`is_admin_${userId}`, 'true');
    }
    return isActive;
  } catch (e) {
    return false;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(() => {
    // 초기 상태 설정 시 세션 스토리지를 즉시 참조하여 로딩 시간을 줄임
    const lastUser = localStorage.getItem('sb-tmmkdqpiolyldhngysxh-auth-token');
    if (lastUser) {
      try {
        const parsed = JSON.parse(lastUser);
        const userId = parsed?.user?.id;
        if (userId && sessionStorage.getItem(`is_admin_${userId}`) === 'true') {
          return true;
        }
      } catch (e) { /* ignore */ }
    }
    return null;
  })
  const [loading, setLoading] = useState(isAdmin === null)

  const checkUserAdmin = useCallback(async (user: any, cancelled: { value: boolean }) => {
    if (!user) {
      if (!cancelled.value) {
        setIsAdmin(false);
        setLoading(false);
      }
      return;
    }

    const result = await fetchIsAdmin(user.id);
    if (!cancelled.value) {
      setIsAdmin(result);
      setLoading(false);
    }
  }, []);

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
    const cancelled = { value: false }

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (cancelled.value) return;
      setSession(newSession)

      if (event === 'SIGNED_OUT') {
        setIsAdmin(false)
        setLoading(false)
        return
      }

      if (newSession?.user) {
        // 이미 관리자임을 알고 있다면(캐시) 로딩을 띄우지 않음
        if (sessionStorage.getItem(`is_admin_${newSession.user.id}`) !== 'true') {
          setLoading(true);
        }
        await checkUserAdmin(newSession.user, cancelled);
      } else {
        setIsAdmin(false);
        setLoading(false);
      }
    })

    return () => {
      cancelled.value = true
      listener.subscription.unsubscribe()
    }
  }, [checkUserAdmin])

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
