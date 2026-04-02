import { useEffect, useState } from 'react'
import { supabase } from '../utils/supabase'

export type UseAdminResult = {
  isAdmin: boolean | null
  loading: boolean
}

/**
 * 현재 로그인 사용자가 admin_users 테이블에 존재하는지 확인한다.
 * - 비로그인: isAdmin = false
 * - 조회 중: loading = true, isAdmin = null
 * - 완료: loading = false, isAdmin = true | false
 */
export function useAdmin(): UseAdminResult {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function checkAdmin(): Promise<void> {
      setLoading(true)

      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData?.session?.user

      if (!user) {
        if (!cancelled) {
          setIsAdmin(false)
          setLoading(false)
        }
        return
      }

      try {
        const { data, error } = await supabase
          .from('admin_users')
          .select('id')
          .eq('user_id', user.id)
          .is('revoked_at', null)
          .limit(1)

        if (error) {
          console.error('[useAdmin] admin_users 조회 오류:', error)
          if (!cancelled) {
            setIsAdmin(false)
            setLoading(false)
          }
          return
        }

        if (!cancelled) {
          setIsAdmin(Array.isArray(data) && data.length > 0)
          setLoading(false)
        }
      } catch (err) {
        console.error('[useAdmin] 예기치 않은 오류:', err)
        if (!cancelled) {
          setIsAdmin(false)
          setLoading(false)
        }
      }
    }

    checkAdmin()

    // 인증 상태 변경 시 재확인
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      checkAdmin()
    })

    return () => {
      cancelled = true
      listener.subscription.unsubscribe()
    }
  }, [])

  return { isAdmin, loading }
}
