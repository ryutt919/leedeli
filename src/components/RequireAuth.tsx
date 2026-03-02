import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { Spin } from 'antd'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../utils/supabase'

/**
 * 인증 보호 래퍼 컴포넌트
 * - 로그인된 세션이 없으면 /login 페이지로 리다이렉션
 * - 세션 변경(로그인/로그아웃)을 실시간으로 감지
 */
export function RequireAuth({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null | undefined>(undefined) // undefined = 로딩 중

    useEffect(() => {
        // 현재 세션 가져오기
        supabase.auth.getSession().then(({ data }) => {
            setSession(data.session)
        })

        // 세션 변경 이벤트 구독 (로그인/로그아웃/토큰 갱신)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
        })

        return () => subscription.unsubscribe()
    }, [])

    // 로딩 중 → 스피너 표시
    if (session === undefined) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <Spin size="large" />
            </div>
        )
    }

    // 세션 없음 → 로그인 페이지로 이동
    if (!session) {
        return <Navigate to="/login" replace />
    }

    // 세션 있음 → 자식 컴포넌트 렌더링
    return <>{children}</>
}
