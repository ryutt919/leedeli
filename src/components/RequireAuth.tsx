import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

/**
 * 인증 보호 래퍼 컴포넌트
 * - AuthContext의 useAuth를 사용하여 세션 상태를 확인
 * - 로그인된 세션이 없으면 /login 페이지로 리다이렉션
 * - 현재 위치를 state.from으로 전달 → 로그인 후 원래 페이지로 돌아올 수 있음
 */
export function RequireAuth({ children }: { children: ReactNode }) {
    const { session, loading } = useAuth()
    const location = useLocation()

    // 세션 확인 중 → null 반환 (스피너 없음)
    // getSession()은 localStorage 읽기(< 50ms)이므로 깜빡임 없이 즉시 전환됨
    if (loading) return null

    // 세션 없음 → 로그인 페이지로 이동 (from 위치 전달)
    if (!session) {
        return <Navigate to="/login" state={{ from: location }} replace />
    }

    // 세션 있음 → 자식 컴포넌트 렌더링
    return <>{children}</>
}
