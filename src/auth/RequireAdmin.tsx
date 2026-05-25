import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { Button, Spin, Typography } from 'antd'
import { useAuth } from './AuthContext'

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { loading, isAdmin, refreshAdmin } = useAuth()

  // 로딩 중
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    )
  }

  // admin 확인 실패 (null) — 세션은 유효하지만 DB 조회 실패
  // 무한 스피너 대신 재시도 UI 표시
  if (isAdmin === null) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', gap: 12 }}>
        <Typography.Text type="secondary">권한 확인 중 오류가 발생했습니다.</Typography.Text>
        <Button onClick={refreshAdmin}>다시 시도</Button>
      </div>
    )
  }

  // 비관리자
  if (!isAdmin) {
    return <Navigate to="/unauthorized" replace />
  }

  return <>{children}</>
}
