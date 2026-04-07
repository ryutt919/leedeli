import { InfoCircleOutlined, LoginOutlined, LogoutOutlined } from '@ant-design/icons'
import { Button, Drawer, Flex, Layout, theme } from 'antd'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../utils/supabase'
import { BottomNav } from '../components/BottomNav'
import { PageHeader } from '../components/PageHeader'

export function MobileShell({
  title,
  children,
  right,
}: {
  title: React.ReactNode
  children: ReactNode
  right?: ReactNode
}) {
  const { token } = theme.useToken()
  const loc = useLocation()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const { session } = useAuth()

  const canBack = useMemo(() => loc.pathname !== '/', [loc.pathname])

  return (
    <Layout style={{ minHeight: '100%', background: token.colorBgLayout }}>
      {/* 헤더는 화면 전체 폭을 사용하도록 밖으로 배치 */}
      <Layout.Header
        style={{
          padding: 0,
          height: 52,
          lineHeight: '52px',
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          position: 'sticky',
          top: 0,
          zIndex: 10,
          width: '100%',
        }}
      >
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: 520 }}>
            <PageHeader
              title={title}
              onBack={canBack ? () => nav(-1) : undefined}
              onOpenMenu={() => setOpen(true)}
              right={right}
            />
          </div>
        </div>
      </Layout.Header>

      {/* 콘텐츠는 가운데 정렬되도록 app-max를 사용 */}
      <Layout.Content style={{ padding: 16, paddingBottom: 88, display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 520 }}>{children}</div>
      </Layout.Content>

      <Layout.Footer
        style={{
          padding: 0,
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          background: token.colorBgContainer,
          borderTop: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <div className="app-max">
          <BottomNav />
        </div>
      </Layout.Footer>

      <Drawer
        title="메뉴"
        placement="right"
        open={open}
        onClose={() => setOpen(false)}
        width={320}
      >
        <Flex vertical gap={12}>
          <Flex gap={8} wrap>
            <Button
              icon={<InfoCircleOutlined />}
              onClick={() => {
                setOpen(false)
                nav('/')
              }}
            >
              홈
            </Button>
            {!session && (
              <Button
                icon={<LoginOutlined />}
                type="primary"
                onClick={() => {
                  setOpen(false)
                  nav('/login')
                }}
              >
                로그인
              </Button>
            )}
            {!!session && (
              <Button
                icon={<LogoutOutlined />}
                onClick={async () => {
                  setOpen(false)
                  await supabase.auth.signOut()
                  nav('/login', { replace: true })
                }}
              >
                로그아웃
              </Button>
            )}
          </Flex>
        </Flex>
      </Drawer>
    </Layout>
  )
}
